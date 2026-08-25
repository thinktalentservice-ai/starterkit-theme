/* Preset -> two complete token maps.
 *
 * Resolution is a straight walk, in a fixed order, with one rule: NOTHING reads
 * a half-resolved map. Families and neutrals resolve first, then the rules that
 * reference them, then channels last — because a channel is by definition the
 * triple of an already-resolved colour, and a channel computed from a stale
 * value is the single worst failure this sheet can have. It renders no error, no
 * warning and no visual clue beyond a translucent layer being the wrong colour,
 * across 32 call sites in two published packages.
 */
import { contrastRatio, fitContrast } from "../color/contrast";
import { clampChroma } from "../color/gamut";
import { hexToOklch, hexToTriple, normalizeHex, oklchToHex } from "../color/oklch";
import { buildRamp, rampAt, slotIndex } from "./ramp";
import type {
  BrandWarning,
  ColorRef,
  Duty,
  PresetSpec,
  ResolvedBrand,
  Scheme,
  SchemeName,
  TokenRule,
} from "./spec";

const SCHEMES: readonly SchemeName[] = ["dark", "light"];

/**
 * Alpha, printed the way the sheet prints it.
 *
 * Two decimals minimum so `0.2` reads as `0.20` beside `0.12` and a reviewer can
 * scan a column of them; more when the value needs it (`0.035` is a real
 * glass-background alpha and rounding it to `0.04` is a visible change).
 */
export function formatAlpha(a: number): string {
  const clamped = Math.min(1, Math.max(0, a));
  const trimmed = clamped.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  const [int = "0", frac = ""] = trimmed.split(".");
  if (frac === "") return int;
  return frac.length >= 2 ? `${int}.${frac}` : `${int}.${frac.padEnd(2, "0")}`;
}

/** `rgba(r, g, b, a)` — comma-separated, matching the sheet's own style. */
export function rgbaOf(hex: string, alpha: number): string {
  return `rgba(${hexToTriple(hex).replace(/ /g, ", ")}, ${formatAlpha(alpha)})`;
}

const OVERLAY: Record<"flip" | "white" | "black", Scheme<string>> = {
  // White on a dark page, black on a light one — the alpha borders, muted inks
  // and ghost fills. This is the token family a light-first brand breaks if it
  // is left as a literal, which is exactly what happened in the button package.
  flip: { dark: "#ffffff", light: "#000000" },
  // Fixed white in both: the glass backgrounds are a frosted white veil on dark
  // AND on light, so flipping them to black would invert the material.
  white: { dark: "#ffffff", light: "#ffffff" },
  black: { dark: "#000000", light: "#000000" },
};

type Context = {
  preset: PresetSpec;
  /* Per-scheme, because `darkFloor` lifts the SEED of the dark ramp — see the
     FamilySpec doc. The light entry is always built from the untouched seed, so
     a family with no floor holds two structurally identical ramps and every
     `ramp` ref resolves exactly as it did before this split. */
  ramps: Scheme<Record<string, string[]>>;
  neutral: Scheme<Map<string, string>>;
  families: Scheme<Map<string, string>>;
  /* Filled between the two passes. A channel's base can be a plain literal
     (`--status-draft`) rather than a family slot, so pass 2 has to be able to
     read pass 1's output — and nothing else may, which is why this is the only
     way in and why it is undefined during pass 1. */
  resolved?: Scheme<Map<string, string>>;
};

function resolveRef(ref: ColorRef, scheme: SchemeName, ctx: Context): string {
  switch (ref.k) {
    case "fixed":
      return normalizeHex(ref.hex);

    case "overlay":
      return OVERLAY[ref.mode][scheme];

    case "scheme":
      return resolveRef(scheme === "dark" ? ref.dark : ref.light, scheme, ctx);

    case "slot": {
      /* `from` pins the source scheme; both family maps are fully populated by
         the time any token rule resolves, so reading across is safe here and
         only here. See the ColorRef doc for why this is not `ramp`+`shift: 0`. */
      const read = ref.from ?? scheme;
      if (ref.family === "neutral") {
        const hex = ctx.neutral[read].get(ref.token);
        if (hex === undefined) throw new Error(`neutral has no slot ${ref.token}`);
        return hex;
      }
      const hex = ctx.families[read].get(ref.token);
      if (hex === undefined) throw new Error(`family ${ref.family} has no slot ${ref.token}`);
      return hex;
    }

    case "ramp": {
      const ramp = ctx.ramps[scheme][ref.family];
      if (ramp === undefined) throw new Error(`unknown family ${ref.family}`);
      const shift = ref.shift ?? 1;
      return rampAt(ramp, ref.index + (scheme === "light" ? shift : 0));
    }

    case "mix": {
      /* Channel-wise lerp in GAMMA space — see the ColorRef doc for why this
         must not be an OKLCH or linear-light blend. `t` is clamped rather than
         thrown on: a sample list is authoring data, and an out-of-range point
         should read as the endpoint it is nearest, not fail a page. */
      const t = Math.min(1, Math.max(0, ref.t));
      const a = normalizeHex(resolveRef(ref.a, scheme, ctx));
      const b = normalizeHex(resolveRef(ref.b, scheme, ctx));
      const ch = (i: number) => {
        const av = parseInt(a.slice(1 + i * 2, 3 + i * 2), 16);
        const bv = parseInt(b.slice(1 + i * 2, 3 + i * 2), 16);
        return Math.round(av + (bv - av) * t)
          .toString(16)
          .padStart(2, "0");
      };
      return `#${ch(0)}${ch(1)}${ch(2)}`;
    }

    case "lift": {
      const base = resolveRef(ref.ref, scheme, ctx);
      const against = resolveRef(ref.against, scheme, ctx);
      /* The engine's own duty search, reused verbatim: it returns `base`
         untouched when `base` already passes, and otherwise walks the
         emittable ray toward L=1 NEAREST FIRST, re-clamping chroma into sRGB
         at every step. Both halves matter — the first is what makes this a
         no-op for a bright seed, the second is what stops a lifted blue
         turning purple at the top of the ray.

         `ok: false` is deliberately not an error. Same policy as `rampAt`'s
         clamp: an unreachable target should render the lightest emittable
         colour and let the legibility gate REPORT it, rather than turn a
         contrast miss into a thrown page. */
      return liftCached(base, against, ref.min);
    }

    case "sink": {
      const base = resolveRef(ref.ref, scheme, ctx);
      const against = resolveRef(ref.against, scheme, ctx);
      /* Same search, opposite direction — see the `sink` ColorRef doc in
         spec.ts. Shares `lift`'s cache because the two differ only by a walk
         direction, and a second Map would double the eviction pressure on a
         working set that is already bounded on purpose. The direction is part
         of the key, so a base/against/min triple cannot collide across the two.

         `ok: false` is not an error, and unlike `lift` it is also not
         REPORTED: `warnings` carries only declared duties, and no duty covers
         `--primary-solid` against white. So the bailout is deliberately
         fail-open at runtime — a client seed must not be able to kill a page —
         and the arbitrary-seed assertion in `fuzz.test.ts` is what makes it
         non-silent, by requiring every random seed to clear the floor and take
         the white label. Do not "fix" this by throwing. */
      return sinkCached(base, against, ref.min);
    }

    case "lighten": {
      /* Validated here rather than trusted, on the `darkChromaRetention`
         precedent: a `dl` of 0 or NaN produces a silent identity — the exact
         flat-gradient failure this ref exists to make impossible — and a `dl`
         above 1 is meaningless in OKLCH. It is a preset-authoring field no
         tenant document can reach, so a bad value is a bug in this repo and
         throwing is the same treatment a preset missing `--surface` gets. */
      if (!Number.isFinite(ref.dl) || ref.dl <= 0 || ref.dl >= 1) {
        throw new Error(`lighten: dl must be in (0, 1), got ${ref.dl}`);
      }
      const base = hexToOklch(normalizeHex(resolveRef(ref.ref, scheme, ctx)));
      /* A NEAR-WHITE SEED IS WHY THIS IS NOT `Math.min(1, l + dl)`. Clamping at
         the top of the ray returns the input unchanged for any seed within `dl`
         of white — `#ffffff` in, `#ffffff` out — which is precisely the silent
         no-op this ref exists to make impossible, reintroduced at the one end of
         the range nobody tests. `validateBrandDoc` accepts any `#rrggbb`, so a
         white primary is a legal tenant seed, not a hypothetical.
         Stepping the other way is not a fallback, it is the same request read
         correctly: the caller asked for a stop `dl` away from this colour, and
         when there is no room above there is always room below. The result
         differs from the input in L for every seed, which is the invariant
         `property.test.ts` 9c asserts. */
      const l = base.l + ref.dl <= 1 ? base.l + ref.dl : Math.max(0, base.l - ref.dl);
      /* The chroma clamp is what stops a lightened blue from serialising as a
         colour nobody chose — same guard `emittableRay` applies per step. */
      return oklchToHex(clampChroma({ ...base, l }));
    }
  }
}

/* A lift is a pure function of three values, and it is EXPENSIVE: `emittableRay`
   runs a 40-step bisection per colour it yields, and a fill being lifted out of
   a dark-seeded ramp crosses a long stretch of L. Uncached, adding six of these
   to a preset made `resolveBrand` 72x slower (0.22ms -> 15.6ms), which is not
   free — this runs on the per-tenant SSR path and under the live editor's
   slider. Measured, not assumed: the package's own fuzz test timed out first.

   Bounded, and deliberately so. The keys derive from a client-supplied seed, so
   an unbounded map here is the same unbounded-growth bug the host's tenant memo
   already documents. Insertion-ordered eviction keeps the working set (six
   presets x six fills = 36 entries) resident while a fuzz run of arbitrary seeds
   churns through the tail instead of retaining it. */
const LIFT_CACHE = new Map<string, string>();
const LIFT_CACHE_MAX = 512;

function fitCached(
  base: string,
  against: string,
  min: number,
  dir: "darken" | "lighten",
  onFail: "extreme" | "input",
  minChroma?: number,
): string {
  /* `dir` IS IN THE KEY, not appended to a second map. A darkening fit and a
     lightening fit of the same (base, against, min) are different colours, and
     the pair shares one bounded map so the eviction budget stays the budget
     that was measured rather than twice it. */
  const key = `${dir}|${onFail}|${base}|${against}|${min}|${minChroma ?? ""}`;
  const hit = LIFT_CACHE.get(key);
  if (hit !== undefined) return hit;

  /* The engine's own duty search, reused verbatim: it returns `base` untouched
     when `base` already passes, and otherwise walks the emittable ray toward
     L=1 NEAREST FIRST, re-clamping chroma into sRGB at every step. Both halves
     matter — the first is what makes this a no-op for a bright seed, the second
     is what stops a lifted blue turning purple at the top of the ray.

     `ok: false` is deliberately not an error. Same policy as `rampAt`'s clamp:
     an unreachable target should render the lightest emittable colour and let
     the legibility gate REPORT it, rather than turn a contrast miss into a
     thrown page. */
  const fit = fitContrast(base, [{ against, min }], dir, { minChroma });
  const hex = fit.ok || onFail === "extreme" ? fit.hex : base;

  if (LIFT_CACHE.size >= LIFT_CACHE_MAX) {
    const oldest = LIFT_CACHE.keys().next();
    if (!oldest.done) LIFT_CACHE.delete(oldest.value);
  }
  LIFT_CACHE.set(key, hex);
  return hex;
}

/* The two directions, named — and they disagree about failure, on purpose.
   `liftCached` keeps the behaviour every existing call site was written
   against: `fitContrast` walks the whole ray and returns its LAST colour, so an
   unreachable lighten target renders near-white. That is defensible where lift
   is consumed — a gradient START STOP, where the lightest emittable colour is
   still a colour in the right direction, and the legibility gate reports the
   miss.

   `sinkCached` returns the INPUT instead, because its consumer is `fillRef` —
   an action-surface fill. The symmetric behaviour there is to render BLACK when
   a floor cannot be met, which is not a brand colour, not a colour anybody
   chose, and worse than the miss it is trying to fix. Same reasoning
   `liftSeedToFloor` already applies to `darkFloor`, and the same reasoning
   `rampAt`'s clamp is called out for.

   With `SOLID_WHITE_FLOOR` at 4.5 against white this branch is unreachable —
   black is 21:1, so every hue can satisfy it — and it is written anyway,
   because "unreachable today" is a property of one constant, not of the rule. */
const liftCached = (base: string, against: string, min: number, minChroma?: number): string =>
  fitCached(base, against, min, "lighten", "extreme", minChroma);

const sinkCached = (base: string, against: string, min: number): string =>
  fitCached(base, against, min, "darken", "input");

/**
 * A family's `darkFloor`, applied to its seed before the dark ramp is built.
 *
 * Two differences from the fill lift above, both deliberate.
 *
 * It BAILS OUT when the floor is provably unreachable. No colour on a lightening
 * ray can out-contrast white against the same backdrop, so if white itself
 * misses the floor, nothing on the ray reaches it and the scan is pure cost —
 * up to 766 emittable colours, each found by a 40-step bisection, per family.
 * Measured on a fuzz-shaped preset (every seed random INCLUDING the neutral
 * one, so the "dark" surface can itself be light): 10.4ms -> 54.1ms per
 * resolve without this guard, 5.2x, and the package's own fuzz test refused to
 * finish. Real dark surfaces are near-black and take the cheap path.
 *
 * And on failure it returns the seed UNTOUCHED rather than the ray's extreme.
 * `rampAt` clamps to the ramp's end because that is still an entry someone
 * designed; walking a ray to its extreme yields a colour nobody chose, and
 * doing it for a floor that cannot be met buys no legibility while throwing
 * away the brand. Unmet is exactly the state that existed before `darkFloor`,
 * and the duty search and `warnings` already report it.
 *
 * `target` and `retention` add a SECOND, optional stage on top of that floor,
 * and the two-stage shape is the whole correctness argument.
 *
 * The budget is measured from the colour AT THE FLOOR, never from the raw seed.
 * A client seed is typically far below its floor already — meridian's `#0B5FFF`
 * measures 3.56 on its own surface — so the existing floor has spent 19-48% of
 * that seed's chroma before this code is reached. Budgeting against the seed
 * budgets the lift that already shipped: at 20% it walked meridian BACKWARDS
 * from 8.05 to 5.06, i.e. the guard made the brand darker than doing nothing.
 * Measuring from the floor makes the floor a guarantee the budget cannot cross,
 * so the worst case of this whole mechanism is "no improvement", never a
 * regression.
 *
 * The climb is a SECOND ray walk, not a bisection over eight: `minChroma` stops
 * `fitContrast` at the budget and hands back the brightest colour still inside
 * it. So a cold floored-and-targeted family costs two walks — one to the floor,
 * one to the aspiration — both bounded and both memoized. The bisection version
 * was written first and measured ~60ms per cold resolve against ~2.1ms for all
 * six presets this way.
 *
 * The floor cannot be undercut by the climb: the budget is a fraction of the
 * chroma AT the floor, so the floor colour itself always satisfies it, and a
 * nearest-first walk reaches the floor before anything beyond it. That is the
 * argument — but the return compares against the floor colour's OWN measured
 * ratio rather than against `min`, because the two differ by quantisation and
 * only the former makes "never worse than the floor" exactly true.
 */
function liftSeedToFloor(
  seed: string,
  against: string,
  min: number,
  target?: number,
  retention?: number,
): string {
  const base = normalizeHex(seed);
  const seedRatio = contrastRatio(base, against);
  const aspiration = target !== undefined && target > min ? target : min;

  /* Clears everything asked of it — the incumbent's case, and the reason it is
     a byte-identical no-op by construction rather than by luck. */
  if (seedRatio >= aspiration) return base;

  const white = contrastRatio("#ffffff", against);
  if (white < min) return base;

  const floored = seedRatio >= min ? base : liftCached(base, against, min);

  /* No aspiration, no budget, or an aspiration nothing on the ray can reach:
     ship the guaranteed floor. Bailing on an unreachable target matters for the
     same reason the `white < min` guard does — it is the difference between a
     cheap path and 766 emittable colours at a 40-step bisection each. */
  if (retention === undefined || aspiration === min || white < aspiration) return floored;

  /* An authoring bug, not a client input: `darkChromaRetention` is a FamilySpec
     field and no tenant document can reach it. Unvalidated, `2` or `NaN` yields a
     negative-or-NaN guard that every colour on the ray satisfies, silently
     disabling the budget and shipping the pastel it exists to prevent — measured:
     retention `2` takes meridian to 10.905 at chroma 0.083. Throwing matches how
     this file already treats a preset missing its `--surface`. */
  if (!Number.isFinite(retention) || retention <= 0 || retention >= 1) {
    throw new Error(`darkChromaRetention must be a number in (0, 1), got ${retention}`);
  }

  const flooredChroma = hexToOklch(floored).c;
  const guard = flooredChroma > 0 ? flooredChroma * (1 - retention) : undefined;
  const climbed = liftCached(base, against, aspiration, guard);

  /* A truncated climb reports the brightest in-budget colour; an untruncated one
     reports the target. Either way it should be at or above the floor — but the
     floor is the promise, so it is asserted rather than assumed, and asserted
     against what the floor colour ACTUALLY measures rather than against `min`.
     Those differ by quantisation: a floor colour landing at 8.05 for a declared
     8.0 would let a climb returning 8.01 through as "at least the floor" while
     being visibly dimmer than the colour it replaced. */
  return contrastRatio(climbed, against) >= contrastRatio(floored, against) ? climbed : floored;
}

function resolveRule(name: string, rule: TokenRule, scheme: SchemeName, ctx: Context): string {
  const { intensity } = ctx.preset;

  switch (rule.kind) {
    case "solid":
      return resolveRef(rule.ref, scheme, ctx);

    case "alpha": {
      if (scheme === "light" && rule.lightLiteral !== undefined) return rule.lightLiteral;
      const a = rule.a[scheme] * (rule.scaled ? intensity : 1);
      return rgbaOf(resolveRef(rule.ref, scheme, ctx), a);
    }

    case "shadow": {
      const hex = resolveRef(rule.ref, scheme, ctx);
      const layers = rule.layers[scheme].map(
        (layer) => `${layer.geometry} ${rgbaOf(hex, layer.alpha * (rule.scaled ? intensity : 1))}`,
      );
      const tail = rule.tail?.[scheme];
      return tail === undefined ? layers.join(", ") : `${layers.join(", ")}, ${tail}`;
    }

    case "literal":
      return rule.value[scheme];

    case "ink": {
      if (rule.over.length === 0 || rule.candidates.length === 0) {
        throw new Error(`${name}: ink rule needs at least one backdrop and one candidate`);
      }
      const backdrops = rule.over.map((ref) => resolveRef(ref, scheme, ctx));
      /* Score on the WORST backdrop, not the average: a gradient label that is
         legible on one stop and invisible on the other is illegible. */
      let best: string | undefined;
      let bestScore = -Infinity;
      for (const ref of rule.candidates) {
        const hex = resolveRef(ref, scheme, ctx);
        const score = Math.min(...backdrops.map((bg) => contrastRatio(hex, bg)));
        if (score > bestScore) {
          bestScore = score;
          best = hex;
        }
      }
      return best!;
    }

    case "channel": {
      /* Read from the pass-1 output, not from the family maps: several channel
         bases are plain literals (`--status-draft`) rather than family slots,
         and silently falling back to "family value or nothing" is how a channel
         ends up describing a colour the sheet does not contain. */
      const value = ctx.resolved?.[scheme].get(rule.of);
      if (value === undefined) throw new Error(`${name}: channel base ${rule.of} not resolved`);
      return hexToTriple(value);
    }
  }
}

/** Radii step off `--radius`; the chip and card offsets are the sheet's own. */
function radiusTokens(radius: number): Record<string, string> {
  return {
    "--radius": `${radius}px`,
    "--radius-chip": `${radius + 4}px`,
    "--radius-card": `${radius + 8}px`,
    "--radius-pill": "9999px",
  };
}

function checkDuties(
  duties: readonly Duty[],
  resolved: Scheme<Map<string, string>>,
  acknowledgedKeys: ReadonlySet<string>,
): BrandWarning[] {
  const out: BrandWarning[] = [];
  for (const duty of duties) {
    const schemes: SchemeName[] = duty.scheme === "both" ? ["dark", "light"] : [duty.scheme];
    for (const scheme of schemes) {
      const fg = resolved[scheme].get(duty.token);
      if (fg === undefined) throw new Error(`duty on unknown token ${duty.token}`);
      const bg = duty.against.startsWith("--")
        ? resolved[scheme].get(duty.against)
        : duty.against;
      if (bg === undefined) throw new Error(`duty background ${duty.against} not resolved`);

      const ratio = contrastRatio(fg, bg);
      if (ratio >= duty.min) continue;
      if (acknowledgedKeys.has(`${duty.token}|${scheme}`)) continue;
      out.push({
        token: duty.token,
        scheme,
        ratio,
        min: duty.min,
        against: duty.against,
        message: `${duty.token} is ${ratio.toFixed(2)}:1 on ${duty.against} in ${scheme} — needs ${duty.min}:1 (${duty.because})`,
      });
    }
  }
  return out;
}

/**
 * Resolve a preset into the two token maps a stylesheet needs.
 *
 * Never throws on a legibility problem: an unreachable contrast target comes
 * back in `warnings`, because "this brand cannot be made accessible" is a
 * business answer, not a colour-math one. It DOES throw on a structural
 * problem — an unknown family, an unresolved channel base — since those are
 * authoring bugs that would otherwise ship a stylesheet with a hole in it.
 */
export function resolveBrand(preset: PresetSpec): ResolvedBrand {
  /* NEUTRALS FIRST, and that ordering is load-bearing now: a family's
     `darkFloor` is measured against the dark `--surface`, so the surface has to
     exist before any ramp is built. Before `darkFloor` the two blocks were
     independent and ramps came first. */
  const neutral: Scheme<Map<string, string>> = { dark: new Map(), light: new Map() };
  for (const scheme of SCHEMES) {
    const spec = preset.neutral[scheme];
    for (const [token, step] of Object.entries(spec.slots)) {
      neutral[scheme].set(token, buildRamp(spec.seed, { seedIndex: 0, steps: [step] })[0]!);
    }
  }

  const darkSurface = neutral.dark.get("--surface");
  if (darkSurface === undefined) throw new Error("neutral.dark has no --surface");

  /* One ramp per scheme. Light is ALWAYS the untouched seed: `darkFloor` fixes a
     dark-window problem and a light window that inherited the lift would render
     a washed-out brand on white — the exact failure `lightShift: 2` produced
     when obsidian's answer was applied to a client hue. */
  const ramps: Scheme<Record<string, string[]>> = { dark: {}, light: {} };
  for (const [id, family] of Object.entries(preset.families)) {
    ramps.light[id] = buildRamp(family.seed, family.geometry);
    /* Returns the seed UNTOUCHED when it already clears the floor, so a preset
       seeded bright enough — the incumbent, by definition, since the floors are
       read off its own measured ratios — gets a byte-identical ramp rather than
       a re-quantised near-miss. */
    const darkSeed =
      family.darkFloor === undefined
        ? family.seed
        : liftSeedToFloor(
            family.seed,
            darkSurface,
            family.darkFloor,
            family.darkTarget,
            family.darkChromaRetention,
          );
    ramps.dark[id] = buildRamp(darkSeed, family.geometry);
  }

  /* Every family window is SEARCHED, not declared, in BOTH schemes.
   *
   * Until this rewrite, only the light window searched — dark was a bare
   * `rampAt(slotIndex(...))` with no duty check at all. That gap was invisible
   * for obsidian (its lime sits at 10.92:1 on `--surface` in dark, so nothing
   * ever looked wrong) and would have shipped a silently illegible dark-mode
   * primary for the first dual-mode or AAA preset built from a client hue.
   *
   * The light window starts one ramp step deeper than the dark window — measured,
   * that reproduces 11 of obsidian's 12 family slots byte for byte — and then
   * advances while the slot still fails a contrast duty it owes. For obsidian's
   * `--mint` the search lands on exactly the value a person picked by hand on
   * 2026-08-06: one step gives `#8A9F2A` at 2.97:1, which fails 1.4.3 and 1.4.11
   * for `palette.primary.main`, so it takes a second step to `#6B7D20` at 4.59:1.
   *
   * Writing that as `lightShift: 2` also reproduced the sheet, and was wrong.
   * The constant is obsidian's ANSWER, not the rule — apply it blindly to a
   * client's `#0B5FFF` and light `--mint` lands on `#00246b` at 14.34:1, a
   * near-black "blue" nobody asked for. The fixture cannot catch that, because
   * the fixture only ever exercises the one seed the constant was fitted to.
   * Searching costs a few ramp lookups and makes the model mean what it says.
   *
   * DIRECTION IS NOT PICKED FROM SCHEME. It is picked by comparing the
   * background's OKLCH lightness to the candidate's: a lighter background needs
   * a darker foreground (walk toward the ramp's high-index / dark end), a darker
   * background needs a lighter one (walk toward index 0). Every duty declared so
   * far targets a surface token as `against` — near-white in light, near-black in
   * dark — so scheme and direction agree today, but that is a fact about the
   * duties written so far, not a rule this code is allowed to assume. `scheme`
   * only picks which `families` map a result is written into. */
  const searchDuty = new Map<string, Duty>();
  for (const d of preset.duties) {
    if (d.enforce !== "search") continue;
    const schemes: readonly SchemeName[] = d.scheme === "both" ? SCHEMES : [d.scheme];
    for (const scheme of schemes) searchDuty.set(`${scheme}|${d.token}`, d);
  }

  const families: Scheme<Map<string, string>> = { dark: new Map(), light: new Map() };
  for (const scheme of SCHEMES) {
    for (const [id, family] of Object.entries(preset.families)) {
      const ramp = ramps[scheme][id]!;
      const advance = new Map<string, number>();

      for (const token of Object.keys(family.slots)) {
        const start = slotIndex(family, token, scheme);
        const duty = searchDuty.get(`${scheme}|${token}`);
        let index = start;

        if (duty !== undefined) {
          const bg = duty.against.startsWith("--")
            ? (neutral[scheme].get(duty.against) ?? families[scheme].get(duty.against))
            : duty.against;
          if (bg === undefined) throw new Error(`${scheme} duty background ${duty.against} not resolved`);

          // Ties keep the incumbent's direction (darken) rather than picking
          // arbitrarily: a background exactly as light as the candidate is the
          // boundary case the duty exists to move away from, not a coin flip.
          const darken = hexToOklch(bg).l >= hexToOklch(rampAt(ramp, start)).l;
          const bound = darken ? ramp.length - 1 : 0;
          const step = darken ? 1 : -1;

          // Bounded by the ramp: when nothing in it clears the duty, the
          // extreme entry ships and `checkDuties` reports the shortfall. A
          // brand that cannot be made accessible is a business answer, not a
          // crash.
          //
          // Inequality, not `!== bound`: `start` is `slotIndex()`, unclamped —
          // a `lightShift` (or a future preset's typo) can hand this a start
          // already past `bound` on the WRONG side, and `index += step` from
          // there moves away from `bound` forever. `<`/`>` degrade to "loop
          // never runs, `rampAt` clamps the out-of-range index downstream"
          // instead of spinning. This is exactly what the pre-rewire light-only
          // loop did (`index < ramp.length - 1`) — generalized to both directions.
          while (
            (darken ? index < bound : index > bound) &&
            contrastRatio(rampAt(ramp, index), bg) < duty.min
          ) {
            index += step;
          }
        }
        advance.set(token, index - start);
        families[scheme].set(token, rampAt(ramp, index));
      }

      const follow = scheme === "light" ? family.lightFollow : family.darkFollow;
      for (const [token, leader] of Object.entries(follow ?? {})) {
        const extra = advance.get(leader);
        if (extra === undefined) throw new Error(`${token} follows unknown slot ${leader}`);
        families[scheme].set(token, rampAt(ramp, slotIndex(family, token, scheme) + extra));
      }
    }
  }

  const ctx: Context = { preset, ramps, neutral, families };
  const out: Scheme<Map<string, string>> = { dark: new Map(), light: new Map() };

  for (const scheme of SCHEMES) {
    for (const [token, hex] of neutral[scheme]) out[scheme].set(token, hex);
    for (const [token, hex] of families[scheme]) out[scheme].set(token, hex);
    for (const [token, value] of Object.entries(radiusTokens(preset.radius))) {
      out[scheme].set(token, value);
    }
  }

  // Pass 1: everything except channels. Pass 2: channels, which read pass 1.
  ctx.resolved = out;
  const entries = Object.entries(preset.tokens);
  for (const pass of [0, 1] as const) {
    for (const [token, rule] of entries) {
      if ((rule.kind === "channel") !== (pass === 1)) continue;
      for (const scheme of SCHEMES) out[scheme].set(token, resolveRule(token, rule, scheme, ctx));
    }
  }

  const acknowledgedKeys = new Set(preset.acknowledged.map((a) => `${a.token}|${a.scheme}`));

  return {
    id: preset.id,
    dark: out.dark,
    light: out.light,
    warnings: checkDuties(preset.duties, out, acknowledgedKeys),
    provenance: preset.provenance,
  };
}

/**
 * Ratios for every acknowledged failure, measured now rather than trusted.
 *
 * The point of an acknowledgement is that somebody looked at a number and
 * decided to ship it. That decision expires: if the ratio has moved, the note
 * beside it is describing a colour the preset no longer has. The property tests
 * compare these against the recorded values and fail on drift in EITHER
 * direction — including a listed failure that now passes, because an
 * acknowledgement nobody removed is how a fixed bug quietly comes back.
 */
export function measureAcknowledged(
  preset: PresetSpec,
  resolved: ResolvedBrand,
): Array<{ token: string; scheme: SchemeName; recorded: number; actual: number }> {
  const byToken = new Map(preset.duties.map((d) => [d.token, d]));
  return preset.acknowledged.map((ack) => {
    const duty = byToken.get(ack.token);
    if (duty === undefined) throw new Error(`acknowledged failure has no duty: ${ack.token}`);
    const map = ack.scheme === "dark" ? resolved.dark : resolved.light;
    const fg = map.get(ack.token)!;
    const bg = duty.against.startsWith("--") ? map.get(duty.against)! : duty.against;
    return { token: ack.token, scheme: ack.scheme, recorded: ack.measured, actual: contrastRatio(fg, bg) };
  });
}
