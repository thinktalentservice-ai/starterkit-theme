/* Cross-preset invariants — both presets, both schemes.
 *
 * The previous version of this file iterated six presets and carried two
 * measured shortfall ledgers, because two of its checks had real, non-empty
 * exception sets: white-on-primary was unachievable in dark for every preset,
 * and `contrast(on-role, role)` failed for a subset of (preset, scheme, pair)
 * combinations inherited from the incumbent's hand-picked `--on-*` literals.
 *
 * BOTH LEDGERS ARE GONE, AND NEITHER WAS DELETED TO MAKE A TEST PASS. They
 * described one defect with two faces: a single token doing the job of both a
 * text colour and a fill, so it was solved for the stricter duty and then spent
 * on the other. `--<f>` (the mark, 3:1) is now separate from `--<f>-text`
 * (4.5:1) and from `--<f>-solid` (the fill, never darkened), and the label on a
 * fill is `--<f>-on-solid`, chosen by MEASUREMENT over both fill states rather
 * than hand-picked per hue. There is nothing left for a ledger to record — which
 * is the claim assertion 8 below exists to keep honest, since an empty ledger
 * and an unasserted invariant look identical in a green run.
 *
 * What replaces them is assertion 12: the two presets must emit the IDENTICAL
 * token name set. "The same component code works with both themes" is a hope
 * unless something checks it, and this is where it is checked.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "../color/contrast";
import { hexToOklch, hexToTriple } from "../color/oklch";
import { PRESETS } from "../presets/index";
import { CHANNEL_PAIRS, ROOT_TOKEN_NAMES } from "../tokens/names";
import { HOVER_MIX, ROLE_NAMES, type RoleName } from "./ladder";
import { measureAcknowledged, resolveBrand } from "./resolve";

const SCHEMES = ["dark", "light"] as const;

const PRESET_ENTRIES = Object.entries(PRESETS).filter(
  (e): e is [string, NonNullable<(typeof PRESETS)[keyof typeof PRESETS]>] => e[1] !== undefined,
);

const RESOLVED = PRESET_ENTRIES.map(([id, preset]) => ({ id, preset, brand: resolveBrand(preset) }));

/** The three avatar sweeps, as `[gradient, startToken, endToken, inkToken]`.
 *
 *  The START-STOP TOKEN, not the ref it derives from: `--gradient-avatar-from`
 *  and `--gradient-avatar-3-from` are `--primary-solid` transformed two
 *  different ways, and measuring the untransformed seed would test gradients
 *  the sheet does not contain. */
const AVATAR_SWEEPS = [
  ["--gradient-avatar", "--gradient-avatar-from", "--primary-solid", "--gradient-avatar-ink"],
  ["--gradient-avatar-2", "--primary-solid", "--primary-solid-hover", "--gradient-avatar-2-ink"],
  ["--gradient-avatar-3", "--gradient-avatar-3-from", "--primary-solid", "--gradient-avatar-3-ink"],
] as const;

/**
 * MEASURED SUB-AA TROUGHS, by `preset|scheme|gradient`, with the ratio read at
 * the time of writing.
 *
 * ROOT CAUSE, one for all four entries: `--gradient-avatar` and
 * `--gradient-avatar-3` both END on `--primary-solid`, and elemetrik's primary
 * is a dark violet (`#6832FF`) that reads 3.18:1 against the dark fill ink and
 * 3.48:1 against white. No ink clears 4.5:1 anywhere on a blend containing it.
 * The only fix is to move `--primary-solid`, which is the fill under every
 * primary button and is deliberately never darkened for contrast — so this is
 * acknowledged rather than searched.
 *
 * OWNER: whoever picks which avatar sweep the app renders.
 * `--gradient-avatar-2` has no entry here and needs none — it clears AA on both
 * brands by construction, and it is the one to reach for if the avatar is going
 * to carry initials. These two are for the case where it carries a photo, a
 * glyph, or nothing.
 *
 * Both schemes are listed even though the four ratios come in identical pairs.
 * Solid fills are scheme-invariant BY DESIGN, so the pairs matching is a
 * property worth failing on if it ever stops holding, not a redundancy to
 * collapse.
 */
const AVATAR_SHORTFALLS: Record<string, number> = {
  "elemetrik|dark|--gradient-avatar": 3.48,
  "elemetrik|light|--gradient-avatar": 3.48,
  "elemetrik|dark|--gradient-avatar-3": 3.42,
  "elemetrik|light|--gradient-avatar-3": 3.42,
};

/** How far a recorded ratio may move before it must be re-read and re-decided.
 *  Wide enough to absorb an 8-bit rounding step, far too narrow to absorb a
 *  seed change. */
const AVATAR_DRIFT = 0.05;

/** Every (preset, scheme, family) triple, which is what most of these iterate. */
function* cells() {
  for (const { id, preset, brand } of RESOLVED) {
    for (const scheme of SCHEMES) {
      const map = scheme === "dark" ? brand.dark : brand.light;
      for (const f of ROLE_NAMES) yield { id, preset, scheme, map, f: f as RoleName };
    }
  }
}

describe("property — invariants across every preset, both schemes", () => {
  it("1. there are exactly two presets and they are think and elemetrik", () => {
    /* A count assertion looks like bureaucracy until a preset is added without
       the parity check below being extended to it. */
    expect(PRESET_ENTRIES.map(([id]) => id).sort()).toEqual(["elemetrik", "think"]);
  });

  it("2. body text clears AAA and secondary text clears AA against --background", () => {
    const bad: string[] = [];
    for (const { id, brand } of RESOLVED) {
      for (const scheme of SCHEMES) {
        const map = scheme === "dark" ? brand.dark : brand.light;
        const bg = map.get("--background")!;
        const fg1 = contrastRatio(map.get("--fg1")!, bg);
        const fg2 = contrastRatio(map.get("--fg2")!, bg);
        if (fg1 < 7) bad.push(`${id}|${scheme}|--fg1 ${fg1.toFixed(2)} < 7`);
        if (fg2 < 4.5) bad.push(`${id}|${scheme}|--fg2 ${fg2.toFixed(2)} < 4.5`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("3. every --<f> clears 3:1 on --surface — the non-text mark duty", () => {
    /* WCAG 1.4.11. `--<f>` is what a border, an icon and `palette.<f>.main`
       render as, in both schemes. Measured here from the emitted values rather
       than read off `warnings`, so the resolver cannot pass by agreeing with
       itself. */
    const bad: string[] = [];
    for (const { id, scheme, map, f } of cells()) {
      const r = contrastRatio(map.get(`--${f}`)!, map.get("--surface")!);
      if (r < 3.0) bad.push(`${id}|${scheme}|--${f} ${r.toFixed(2)} < 3.0`);
    }
    expect(bad).toEqual([]);
  });

  it("4. every --<f>-text clears 4.5:1 on --surface — the text duty", () => {
    const bad: string[] = [];
    for (const { id, scheme, map, f } of cells()) {
      const r = contrastRatio(map.get(`--${f}-text`)!, map.get("--surface")!);
      if (r < 4.5) bad.push(`${id}|${scheme}|--${f}-text ${r.toFixed(2)} < 4.5`);
    }
    expect(bad).toEqual([]);
  });

  it("5. --<f>-text and --<f> stay distinct, and their order SWAPS between schemes", () => {
    /* THE ASSERTION THAT CATCHES THE FAILURE MODE THIS DESIGN INVENTED. The two
       slots cross over: on a near-black surface the text rung must be LIGHTER
       than the mark, on white it must be DARKER. That is why `text` takes a
       three-step light advance and `main` takes one.
       Both halves matter. Equal values clear every contrast floor exactly as
       well as distinct ones do, so no duty, no warning and no ledger sees a
       collapse — the previous catalogue rendered three designed steps as one hex
       in three presets and every check stayed green. And if the crossover fails,
       the light scheme is rendering a text colour lighter than its own mark,
       which reads as a washed-out brand rather than as a bug. */
    const bad: string[] = [];
    for (const { id, scheme, map, f } of cells()) {
      const text = map.get(`--${f}-text`)!;
      const mark = map.get(`--${f}`)!;
      if (text === mark) {
        bad.push(`${id}|${scheme}|--${f}-text collapsed onto --${f} (${mark})`);
        continue;
      }
      const lText = hexToOklch(text).l;
      const lMark = hexToOklch(mark).l;
      if (scheme === "dark" && lText <= lMark) {
        bad.push(`${id}|dark|--${f}-text L${lText.toFixed(3)} not lighter than --${f} L${lMark.toFixed(3)}`);
      }
      if (scheme === "light" && lText >= lMark) {
        bad.push(`${id}|light|--${f}-text L${lText.toFixed(3)} not darker than --${f} L${lMark.toFixed(3)}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("6. --<f>-solid is the family's exact seed, in BOTH schemes", () => {
    /* The fill is the brand colour, not an approximation of it. The previous
       engine could not promise this: `darkFloor` lifted the SEED to rescue a
       rung that had to carry the text duty, which moved the brand hue itself and
       then needed `--brand-fill` invented to pin the unmoved colour back.
       Splitting text from mark removes the need for either — and this assertion
       is what stops a `darkFloor` being reintroduced without anyone noticing
       that `{ k: "ramp", shift: 0 }` silently stops being scheme-invariant when
       one is (it reads `ctx.ramps[scheme]`). */
    const bad: string[] = [];
    for (const { id, preset, scheme, map, f } of cells()) {
      const seed = preset.families[f]!.seed;
      const solid = map.get(`--${f}-solid`)!;
      if (solid !== seed) bad.push(`${id}|${scheme}|--${f}-solid ${solid} != seed ${seed}`);
    }
    expect(bad).toEqual([]);
  });

  it("7. --<f>-solid-hover is scheme-invariant, distinct from the fill, and darker", () => {
    const bad: string[] = [];
    for (const { id, brand } of RESOLVED) {
      for (const f of ROLE_NAMES) {
        const d = brand.dark.get(`--${f}-solid-hover`)!;
        const l = brand.light.get(`--${f}-solid-hover`)!;
        if (d !== l) bad.push(`${id}|--${f}-solid-hover differs by scheme: ${d} vs ${l}`);
        const solid = brand.dark.get(`--${f}-solid`)!;
        if (d === solid) bad.push(`${id}|--${f}-solid-hover collapsed onto the fill (${d})`);
        if (hexToOklch(d).l >= hexToOklch(solid).l) {
          bad.push(`${id}|--${f}-solid-hover is not darker than --${f}-solid`);
        }
      }
    }
    expect(bad).toEqual([]);
    expect(HOVER_MIX).toBeGreaterThan(0);
  });

  it("8. --<f>-on-solid clears 4.5:1 on BOTH fill states, every family, every preset", () => {
    /* THE INVARIANT THAT REPLACES TWO LEDGERS. A label spans the resting fill
       and the hovered one, so the weakest of the two decides — which is exactly
       what `HOVER_MIX` is set from, and this is the check that keeps that
       setting honest. There is no ledger and no tolerance: a failure here means
       either the hover step grew or a seed landed in the dead band where neither
       ink nor white reads, and both are authoring decisions to make deliberately
       rather than record. */
    const bad: string[] = [];
    for (const { id, scheme, map, f } of cells()) {
      const ink = map.get(`--${f}-on-solid`)!;
      for (const on of [`--${f}-solid`, `--${f}-solid-hover`]) {
        const r = contrastRatio(ink, map.get(on)!);
        if (r < 4.5) bad.push(`${id}|${scheme}|--${f}-on-solid on ${on}: ${r.toFixed(2)} < 4.5`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("9. every avatar sweep's ink is measured across the WHOLE blend, and its shortfalls are exactly the recorded ones", () => {
    /* MEASURING A GRADIENT AT ITS ENDPOINTS DOES NOT BOUND IT — sRGB decode is
       convex and luminance weights the channels very unevenly, so a blend across
       a hue can dip BELOW both ends. 21 samples here against the 11 each preset
       measures at: the test must be strictly finer than the thing it is testing,
       or it only proves the preset agrees with itself at the points it chose.

       WHY THIS IS A LEDGER AND NOT `expect(bad).toEqual([])`. It used to be the
       stricter assertion, and it could be, because the one avatar sweep ended on
       `--accent-solid` and a lift on the START was enough to clear the whole
       blend. Two of the three sweeps now end on `--primary-solid` itself, which
       is an ACTION-SURFACE FILL the engine is not allowed to move — so on a
       dark-seeded brand no ink clears 4.5:1 anywhere across them, and no floor,
       lift or candidate list can change that. The honest options were to delete
       the variants or to record what they cost. They are recorded, with the
       measured ratio, so drift in EITHER direction fails: a regression pushes a
       ratio out of tolerance, and a fix leaves a stale entry that this test
       reports as loudly as a new failure. An acknowledgement nobody removes is
       how a fixed bug gets re-shipped. */
    const bad: string[] = [];
    const lerp = (a: string, b: string, t: number) => {
      const h = (x: string) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16));
      const [ar, ag, ab] = h(a);
      const [br, bg, bb] = h(b);
      const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
      return `#${c(ar!, br!)}${c(ag!, bg!)}${c(ab!, bb!)}`;
    };
    const unseen = new Set(Object.keys(AVATAR_SHORTFALLS));
    for (const { id, brand } of RESOLVED) {
      for (const scheme of SCHEMES) {
        const map = scheme === "dark" ? brand.dark : brand.light;
        for (const [gradient, fromToken, toToken, inkToken] of AVATAR_SWEEPS) {
          const ink = map.get(inkToken)!;
          /* The START-STOP TOKEN, never the raw seed it derives from. They are
             the same colour for think and deliberately differ for elemetrik, and
             measuring the underived stop would test a gradient the page never
             renders. */
          const from = map.get(fromToken)!;
          const to = map.get(toToken)!;
          let worst = Infinity;
          let at = 0;
          for (let i = 0; i <= 20; i += 1) {
            const r = contrastRatio(ink, lerp(from, to, i / 20));
            if (r < worst) {
              worst = r;
              at = i / 20;
            }
          }
          const key = `${id}|${scheme}|${gradient}`;
          const ack = AVATAR_SHORTFALLS[key];
          if (worst >= 4.5) {
            if (ack !== undefined) {
              bad.push(`${key}: now measures ${worst.toFixed(2)} and PASSES — delete the stale shortfall entry (${ack})`);
            }
            continue;
          }
          unseen.delete(key);
          if (ack === undefined) {
            bad.push(`${key}: ${worst.toFixed(2)} at t=${at.toFixed(2)} — unrecorded sub-AA trough`);
          } else if (Math.abs(worst - ack) > AVATAR_DRIFT) {
            bad.push(`${key}: ${worst.toFixed(2)} drifted from recorded ${ack}`);
          }
        }
      }
    }
    for (const key of unseen) bad.push(`${key}: recorded shortfall never measured — the sweep or preset is gone`);
    expect(bad).toEqual([]);
  });

  it("9b. --gradient-avatar-2-ink IS --primary-on-solid, in every preset and scheme", () => {
    /* Not a tautology, and worth its own assertion: `--gradient-avatar-2`'s two
       stops ARE `--primary-solid` and `--primary-solid-hover`, so the ink that
       is correct for a primary button is by definition the ink that is correct
       for this sweep. The two rules reach it differently — the family ink scores
       over the two endpoints, this one over 11 samples of the blend between them
       — so a divergence would not be cosmetic. It would mean `--primary-on-solid`
       is under-sampling its own hover blend and every solid primary button in
       the app carries a trough nobody measured. */
    const bad: string[] = [];
    for (const { id, brand } of RESOLVED) {
      for (const scheme of SCHEMES) {
        const map = scheme === "dark" ? brand.dark : brand.light;
        const sweep = map.get("--gradient-avatar-2-ink");
        const family = map.get("--primary-on-solid");
        if (sweep !== family) bad.push(`${id}|${scheme}: ${sweep} != ${family}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("9c. --gradient-avatar-3's start stop moves on EVERY brand, which is the only reason it exists", () => {
    /* The defect this variant was added to avoid is silent: a contrast-floored
       start stop no-ops on a brand whose seed already passes, so
       `--gradient-avatar` renders start === end — a flat fill emitted as a
       `linear-gradient`, with nothing in the sheet or the warnings saying the
       sweep is gone. think is exactly that brand, so asserting "3's stops differ"
       without also asserting "and 1's do not, on think" would pass on a
       `lighten` that had quietly become a no-op. Both halves, or neither. */
    const bad: string[] = [];
    for (const { id, brand } of RESOLVED) {
      for (const scheme of SCHEMES) {
        const map = scheme === "dark" ? brand.dark : brand.light;
        const primary = map.get("--primary-solid")!;
        if (map.get("--gradient-avatar-3-from") === primary) {
          bad.push(`${id}|${scheme}|--gradient-avatar-3: start stop equals --primary-solid (${primary}) — the sweep is flat`);
        }
      }
    }
    expect(bad).toEqual([]);
    /* The documented flat case, asserted so it stays a known cost rather than
       becoming a surprise: think's seed clears AVATAR_FROM's floor, so
       `--gradient-avatar` IS flat there. If this ever stops being true the floor
       or the seed moved, and the comment on AVATAR_FROM is out of date. */
    const think = RESOLVED.find((r) => r.id === "think")!;
    expect(think.brand.dark.get("--gradient-avatar-from")).toBe(think.brand.dark.get("--primary-solid"));
  });

  it("10. every channel token is the RGB triple of its base, in both schemes, every preset", () => {
    const bad: string[] = [];
    for (const { id, brand } of RESOLVED) {
      for (const [channel, base] of CHANNEL_PAIRS) {
        for (const scheme of SCHEMES) {
          const map = scheme === "dark" ? brand.dark : brand.light;
          const expected = hexToTriple(map.get(base)!);
          if (map.get(channel) !== expected) {
            bad.push(`${id}|${scheme}|${channel}: ${map.get(channel)} != ${expected}`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("11. both presets declare the IDENTICAL duty set — a duty nobody wrote cannot be reported", () => {
    /* The failure this prevents, measured on the catalogue it replaces: the
       incumbent declared a dark duty on its secondary and the other five
       declared none, so three presets shipped a measured 4.42:1 secondary with
       `warnings` EMPTY. Asserting on the resolved OUTPUT can never catch that —
       a missing duty produces no warning, which is indistinguishable from
       passing. Only asserting on the DECLARATION can. */
    const shape = (p: (typeof RESOLVED)[number]["preset"]) =>
      p.duties
        .map((d) => `${d.token}|${d.against}|${d.min}|${d.scheme}|${d.enforce}`)
        .sort();
    const [first, ...rest] = RESOLVED;
    for (const other of rest) {
      expect(shape(other.preset), `${other.id} vs ${first!.id}`).toEqual(shape(first!.preset));
    }
    /* FOUR per family, not two, and NONE of them `scheme: "both"`.
       A duty names one backdrop, and which of --background / --surface / --card
       is the WORST one flips with the scheme: in dark the brand token is
       lighter than all three so --card (the lightest) is worst; in light it is
       darker than all three so --background (the darkest) is worst. "both"
       cannot express that, and declaring both schemes against --surface checked
       the middle backdrop in dark and the best one in light — which shipped an
       outline border at 2.96:1 while its duty reported PASS at 3.17:1.
       So: mark + text, each per scheme, all searching. */
    expect(first!.preset.duties).toHaveLength(ROLE_NAMES.length * 4);
    expect(first!.preset.duties.every((d) => d.enforce === "search")).toBe(true);
    expect(first!.preset.duties.every((d) => d.scheme !== "both")).toBe(true);
    for (const d of first!.preset.duties) {
      expect(d.against, `${d.token}|${d.scheme}`).toBe(d.scheme === "dark" ? "--card" : "--background");
    }
  });

  it("12. both presets emit the IDENTICAL token name set, in both schemes", () => {
    /* "The same component code works with both themes" is a hope unless
       something checks it. A component may reference any token in the ABI; if
       one preset defines a token the other lacks, that component renders
       unstyled — or worse, renders a consuming package's vendored fallback —
       on exactly one brand. Nothing else in this repo would notice. */
    const names = (b: (typeof RESOLVED)[number]["brand"], s: (typeof SCHEMES)[number]) =>
      [...(s === "dark" ? b.dark : b.light).keys()].sort();
    const [first, ...rest] = RESOLVED;
    for (const other of rest) {
      for (const scheme of SCHEMES) {
        expect(names(other.brand, scheme), `${other.id} vs ${first!.id} (${scheme})`).toEqual(
          names(first!.brand, scheme),
        );
      }
    }
  });

  it("13. zero warnings and zero acknowledged failures, every preset", () => {
    const bad: string[] = [];
    for (const { id, preset, brand } of RESOLVED) {
      for (const w of brand.warnings) bad.push(`${id}|${w.token}|${w.scheme}|${w.ratio.toFixed(2)}`);
      for (const a of preset.acknowledged) bad.push(`${id}|acknowledged ${a.token}|${a.scheme}`);
      for (const row of measureAcknowledged(preset, brand)) bad.push(`${id}|drifted ${row.token}`);
    }
    expect(bad).toEqual([]);
  });

  it("14. no token value leaks a preset id or a raw ramp index", () => {
    /* Components may reference tier-2 role tokens and nothing else. A value that
       names a preset is a theme-specific branch that has escaped into the sheet,
       which is the first thing to go wrong when a third brand is added. */
    const bad: string[] = [];
    for (const { id, brand } of RESOLVED) {
      for (const scheme of SCHEMES) {
        for (const [token, value] of scheme === "dark" ? brand.dark : brand.light) {
          for (const other of PRESET_ENTRIES.map(([pid]) => pid)) {
            if (value.includes(other)) bad.push(`${id}|${scheme}|${token} names preset "${other}"`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("15. ROOT_TOKEN_NAMES is a superset of every host token the sibling packages alias", () => {
    /* Sibling checkout, not a hardcoded absolute path: this repo and the three
       design-system packages are siblings under one parent (the CLAUDE.md
       layout). pnpm consumes the PUBLISHED packages, but this reads their raw
       source, which is what catches an ABI break before either is published —
       npm-installed dist output cannot.
       This is also the one assertion here that spans repos, so it is the one
       that fails first when the packages have not been updated in lockstep with
       a rename. That is the intended behaviour, not a flake. */
    const abi = new Set<string>(ROOT_TOKEN_NAMES);
    const siblingRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

    const scrape = (relativePath: string, alias: string): string[] => {
      const path = resolve(siblingRoot, relativePath);
      let css: string;
      try {
        css = readFileSync(path, "utf8");
      } catch (err) {
        throw new Error(
          `expected a sibling checkout at ${path} — starterkit-theme, starterkit-button-component, ` +
            `starterkit-card-component and starterkit-layout must sit under the same parent ` +
            `directory for this ABI check to run (${(err as Error).message})`,
        );
      }
      const matches = css.match(new RegExp(String.raw`${alias}[\w-]+`, "g")) ?? [];
      return [...new Set(matches)].map((m) => "--" + m.slice(alias.length));
    };

    const button = scrape("starterkit-button-component/styles.css", "--ib-t-");
    const card = scrape("starterkit-card-component/styles.css", "--ic-t-");
    /* `--il-t-` and NOT `--il-`. The layout package's one-dash `--il-*` vars are
       SHELL GEOMETRY (`--il-sidebar-width`, `--il-topbar-height`), deliberately
       absent from the ABI and hand-declared on `.il-shell`; the extra dash is
       what keeps a scraper off them. Widening this regex would report ten
       geometry vars as missing tokens. */
    const layout = scrape("starterkit-layout/styles.css", "--il-t-");

    const missing = [...button, ...card, ...layout].filter((n) => !abi.has(n));
    expect(missing, "aliased by a package, absent from ROOT_TOKEN_NAMES").toEqual([]);
    /* An empty scrape would make the assertion above vacuously true. */
    expect(button.length).toBeGreaterThan(0);
    expect(card.length).toBeGreaterThan(0);
    expect(layout.length).toBeGreaterThan(0);
  });

  it("16. every token THIS package's own styles.css reads is one it emits", () => {
    /* WRITTEN BECAUSE ITS ABSENCE COST SOMETHING. The semantic-role rename
       moved every token in `presets/*.css`, and all 139 assertions here stayed
       green while this package's OWN shared utility layer kept reading
       `--glow-mint`, `--glow-violet`, `--glow-amber` and a per-tone gradient-ink
       block keyed on tone words no component sends any more. `.glow-mint` did
       not error, did not warn and did not fall back — it resolved to nothing
       and rendered no shadow at all.

       Assertion 15 covers the three CONSUMING packages and could never catch
       this: it scrapes their `--ib-t-` / `--ic-t-` alias prefixes, and this
       file aliases nothing, it reads the host tokens directly. A package that
       checks its consumers' contract and not its own is checking the easier
       half.

       `--ib-*` / `--ic-*` (one dash) are the button and card packages' OWN
       scoped properties, set by those packages on their own elements; this
       sheet legitimately overrides them. `--il-*` likewise. Everything else
       must be a token the engine emits. */
    const stylesPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../styles.css");
    const css = readFileSync(stylesPath, "utf8");
    /* Strip comments first. This file explains its own history and names the
       dead tokens while doing it, which is exactly the prose a raw regex would
       report as a defect. */
    const code = css.replace(/\/\*[\s\S]*?\*\//g, "");

    const abi = new Set<string>(ROOT_TOKEN_NAMES);
    const read = [...code.matchAll(/var\(\s*(--[a-z0-9-]+)/g)].map((m) => m[1]!);
    const unknown = [...new Set(read)].filter(
      (n) => !abi.has(n) && !/^--(?:ib|ic|il)-/.test(n),
    );
    expect(unknown, "read by styles.css, never emitted by the engine").toEqual([]);
    expect(read.length, "scrape found nothing — the assertion would be vacuous").toBeGreaterThan(10);
  });
});
