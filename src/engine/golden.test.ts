/* THE HARD GATE.
 *
 * `resolveBrand(PRESETS.obsidian)` must reproduce the shipped sheet. Nothing in
 * the starterkit gets touched until this is green, because phase 8 replaces a
 * hand-written stylesheet with this engine's output and there is no way to
 * un-ship a brand that came out slightly wrong on 166 tokens.
 *
 * WHAT THIS TEST DOES AND DOES NOT PROVE. Being honest about this matters more
 * than the green tick:
 *
 *   IT PROVES the STRUCTURAL model. Which token derives from which reference,
 *   the shift-by-one light scheme, the two-step contrast bump on `--mint`, every
 *   channel matching its base, every alpha and glow template, the accent layer
 *   reading the ramp rather than `--mint`. Those are claims that can be wrong,
 *   and several of them nearly were — wiring `--accent-glow` to `--mint` instead
 *   of to mint's ramp index 2 is off by 12 dE00 and this test is what catches it.
 *
 *   IT PROVES the arithmetic survives. A ramp is stored as relative OKLCH
 *   geometry and rebuilt through gamut clamping and 8-bit quantization; that
 *   round trip is not free and it is asserted byte-exact.
 *
 *   IT DOES NOT PROVE the geometry was independently derived. The ramps are the
 *   sheet's own colours. Feeding a preset's own numbers back and finding them
 *   again is not a discovery — it is a regression barrier. The discovery claim
 *   belongs to phase 5, where the same geometry has to produce a legible brand
 *   from five hues it has never seen.
 *
 * The provenance histogram is printed for the same reason: "reproduces 166
 * tokens" would be a misleading headline if most of them were literals.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { contrastRatio } from "../color/contrast";
import { deltaE00Hex } from "../color/deltaE";
import { normalizeHex } from "../color/oklch";
import { buildRamp, measureGeometry } from "./ramp";
import { readTokens } from "./parse";
import { measureAcknowledged, resolveBrand } from "./resolve";
import { serializeBrandCss } from "./serialize";
import { OBSIDIAN, OBSIDIAN_RAMPS, OBSIDIAN_SEED_INDEX } from "../presets/obsidian";
import {
  CHANNEL_PAIRS,
  LIGHT_FLIPPED_TOKEN_NAMES,
  ROOT_TOKEN_NAMES,
  UNPAIRED_CHANNEL_TOKEN_NAMES,
} from "../tokens/names";

const FIXTURE = readFileSync(
  fileURLToPath(new URL("../tokens/__fixtures__/obsidian-2026-08-06.css", import.meta.url)),
  "utf8",
);

const fixtureRoot = readTokens(FIXTURE, ":root");
const fixtureLight = readTokens(FIXTURE, '[data-mui-color-scheme="light"]');

/** What the browser computes for the light scheme: `:root` with the light block
 *  layered on top. Comparing the light DECLARATIONS alone would let a missing
 *  override pass as "no difference". */
const fixtureLightResolved = new Map([...fixtureRoot, ...fixtureLight]);

const brand = resolveBrand(OBSIDIAN);

/* ── Value comparison ─────────────────────────────────────────────────────── */

const HEX = /^#[0-9a-f]{3,8}$/i;
const RGBA = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)/gi;

/** Canonical form for a colourless comparison: collapse whitespace and rewrite
 *  every `rgb()/rgba()` to a fixed shape, so `rgba(0,0,0,.3)` and
 *  `rgba(0, 0, 0, 0.30)` are recognised as the same value. Alignment padding and
 *  alpha spelling are not differences the browser can see. */
function canonical(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(RGBA, (_m: string, r: string, g: string, b: string, a?: string) => {
      const alpha = a === undefined ? 1 : Number(a);
      return `rgba(${Number(r)},${Number(g)},${Number(b)},${alpha})`;
    })
    .toLowerCase();
}

type Diff = { token: string; scheme: string; expected: string; actual: string; note: string };

/** Compare one token. Colours use dE00 <= 1.0 (a just-noticeable difference);
 *  everything else must be canonically identical, because there is no
 *  "perceptually close" reading of a gradient string or a radius. */
function compare(token: string, scheme: string, expected: string, actual: string): Diff | null {
  if (HEX.test(expected) && HEX.test(actual)) {
    const dE = deltaE00Hex(normalizeHex(expected), normalizeHex(actual));
    if (dE <= 1) return null;
    return { token, scheme, expected, actual, note: `dE00 ${dE.toFixed(2)} > 1.0` };
  }
  if (canonical(expected) === canonical(actual)) return null;
  return { token, scheme, expected, actual, note: "not canonically equal" };
}

/* ── Intentional divergence from the 2026-08-06 sheet ─────────────────────── */

/* The fixture is a byte-verified snapshot of the hand-authored sheet, and the
   tests below exist to prove the engine REPRODUCES it. Where we deliberately
   change the design system, the honest record is not to overwrite the snapshot —
   that would quietly retire the reproduction guarantee for those tokens and
   leave nothing saying we ever diverged. It is to list the divergence here, with
   a reason, and keep the snapshot telling the truth about what shipped.

   Keeping the fixture also keeps `gen:tokens` green: `ROOT_TOKEN_NAMES` is
   generated FROM this fixture, so an untouched fixture means an untouched ABI
   list, and the serializer appends unknown names rather than dropping them.

   Both maps are checked in BOTH directions — an entry that no longer diverges
   fails just as loudly as an undeclared divergence. An acknowledgement nobody
   removed is how a reverted change comes back to life unnoticed. */

/** Tokens this engine emits that the 2026-08-06 sheet never had. */
const ADDED_SINCE_FIXTURE = new Map<string, string>([
  ["--brand-fill", "solid-fill stop, pinned to the dark slot so light fills keep the brand hue"],
  ["--brand-fill-end", "second stop of --gradient-primary, pinned with the first"],
  ["--brand-fill-ink", "measured label colour for --gradient-primary (ink vs white)"],
  ["--amber-fill", "solid-fill stop for --gradient-amber"],
  ["--amber-fill-end", "second stop of --gradient-amber"],
  ["--amber-fill-ink", "measured label colour for --gradient-amber"],
  ["--cobalt-fill", "solid-fill stop for --gradient-cobalt"],
  ["--cobalt-fill-end", "second stop of --gradient-cobalt"],
  ["--cobalt-fill-ink", "measured label colour for --gradient-cobalt"],
  ["--electric-fill", "second stop of --gradient-avatar, floored like the other fills"],
  ["--gradient-avatar-ink", "measured initials colour for --gradient-avatar (ink vs white)"],
]);

/** Tokens whose value we deliberately changed. For the three `*-fill` retargets
    the RENDERED dark colour is unchanged — only the reference moved, which an
    old-vs-new resolved diff across all six presets confirmed, and light is what
    moves. `--gradient-avatar` is the exception and is a real recomposition: it
    swaps one stop family outright, so both schemes render differently. */
const RETARGETED_SINCE_FIXTURE = new Map<string, string>([
  ["--gradient-primary", "stops read --brand-fill*, so the light fill stops going olive"],
  ["--gradient-amber", "stops read --amber-fill*"],
  ["--gradient-cobalt", "stops read --cobalt-fill*"],
  ["--gradient-avatar", "recomposed as --cobalt-fill -> --electric-fill; the sheet paired the searched --electric -> --mint"],
]);

/* ── The gate ─────────────────────────────────────────────────────────────── */

describe("golden — resolveBrand(obsidian) reproduces the shipped sheet", () => {
  it("emits exactly the ABI's token set, plus only the declared additions", () => {
    const abi = new Set<string>(ROOT_TOKEN_NAMES);
    const emitted = new Set(brand.dark.keys());
    expect([...abi].filter((n) => !emitted.has(n)), "in the sheet, not emitted").toEqual([]);
    expect(
      [...emitted].filter((n) => !abi.has(n) && !ADDED_SINCE_FIXTURE.has(n)),
      "emitted, not in the sheet and not declared as an addition",
    ).toEqual([]);
    /* The other direction: a declared addition that is no longer emitted is a
       stale entry, not a free pass. */
    expect(
      [...ADDED_SINCE_FIXTURE.keys()].filter((n) => !emitted.has(n)),
      "declared as added but not emitted — delete the entry",
    ).toEqual([]);
  });

  it("reproduces every :root value except the declared retargets", () => {
    const diffs: Diff[] = [];
    for (const token of ROOT_TOKEN_NAMES) {
      if (RETARGETED_SINCE_FIXTURE.has(token)) continue;
      const expected = fixtureRoot.get(token);
      const actual = brand.dark.get(token);
      if (expected === undefined || actual === undefined) continue; // covered by the set test
      const diff = compare(token, "dark", expected, actual);
      if (diff) diffs.push(diff);
    }
    expect(diffs).toEqual([]);
  });

  it("reproduces every computed light-scheme value except the declared retargets", () => {
    const diffs: Diff[] = [];
    for (const token of ROOT_TOKEN_NAMES) {
      if (RETARGETED_SINCE_FIXTURE.has(token)) continue;
      const expected = fixtureLightResolved.get(token);
      const actual = brand.light.get(token);
      if (expected === undefined || actual === undefined) continue;
      const diff = compare(token, "light", expected, actual);
      if (diff) diffs.push(diff);
    }
    expect(diffs).toEqual([]);
  });

  it("every declared retarget actually still differs from the sheet", () => {
    const stale: string[] = [];
    for (const token of RETARGETED_SINCE_FIXTURE.keys()) {
      const expected = fixtureRoot.get(token);
      const actual = brand.dark.get(token);
      expect(expected, `${token} is not in the fixture at all`).toBeDefined();
      if (expected !== undefined && actual !== undefined && canonical(expected) === canonical(actual)) {
        stale.push(token);
      }
    }
    expect(stale, "declared as retargeted but identical to the sheet — delete the entry").toEqual([]);
  });

  it("overrides exactly the tokens the light block overrides", () => {
    /* The sheet declares 80 names in its light block, of which 79 carry a value
       that differs from `:root`. The 80th is `--rose-deep`, restated identically —
       harmless, and not reproduced, because emitting a light rule that repeats a
       `:root` value is how a later brand override silently stops applying in
       light mode. */
    const emitted = ROOT_TOKEN_NAMES.filter(
      (n) => brand.light.get(n) !== undefined && brand.light.get(n) !== brand.dark.get(n),
    );
    const expected = [...LIGHT_FLIPPED_TOKEN_NAMES];
    expect([...expected].filter((n) => !emitted.includes(n)), "sheet flips it, engine does not").toEqual([]);
    expect(emitted.filter((n) => !expected.includes(n as never)), "engine flips it, sheet does not").toEqual([]);
  });

  it("every channel token is the RGB triple of its base, in BOTH schemes", () => {
    /* The invariant that used to be a comment asking the next editor to
       remember. 32 call sites across the button and card packages do
       `rgb(var(--x-channel) / a)`; a channel that disagrees with its hex renders
       a different colour through every one of them with no error anywhere. */
    const wrong: string[] = [];
    for (const [channel, base] of CHANNEL_PAIRS) {
      for (const [scheme, map] of [["dark", brand.dark], ["light", brand.light]] as const) {
        const hex = map.get(base)!;
        const expected = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)).join(" ");
        if (map.get(channel) !== expected) {
          wrong.push(`${scheme} ${channel} = ${map.get(channel)}, base ${base} = ${hex} -> ${expected}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it("leaves the unpaired channel constants alone", () => {
    for (const name of UNPAIRED_CHANNEL_TOKEN_NAMES) {
      expect(brand.dark.get(name)).toBe(brand.light.get(name));
      expect(brand.dark.get(name)).toMatch(/^\d+ \d+ \d+$/);
    }
  });

  it("rebuilds every ramp byte-exactly from its relative geometry", () => {
    /* The claim that makes the geometry usable on a client's hex: converting a
       ramp to OKLCH offsets and back through gamut clamping and 8-bit rounding
       loses nothing. If this drifts, every preset drifts with it. */
    const broken: string[] = [];
    for (const [id, hexes] of Object.entries(OBSIDIAN_RAMPS)) {
      const seedIndex = OBSIDIAN_SEED_INDEX[id as keyof typeof OBSIDIAN_SEED_INDEX];
      const rebuilt = buildRamp(hexes[seedIndex]!, measureGeometry(hexes, seedIndex));
      for (const [i, hex] of hexes.entries()) {
        if (rebuilt[i] !== normalizeHex(hex)) broken.push(`${id}[${i}] ${hex} -> ${rebuilt[i]}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("serializes to CSS that parses back to the same values", () => {
    /* Round-trip through the emitter, so a serialization bug cannot hide behind
       a correct in-memory map. This is the artifact the CDN actually ships. */
    const css = serializeBrandCss(brand);
    const root = readTokens(css, ":root");
    const light = new Map([...root, ...readTokens(css, '[data-mui-color-scheme="light"]')]);

    const diffs: Diff[] = [];
    for (const token of ROOT_TOKEN_NAMES) {
      const d1 = compare(token, "dark", brand.dark.get(token)!, root.get(token)!);
      const d2 = compare(token, "light", brand.light.get(token)!, light.get(token)!);
      if (d1) diffs.push(d1);
      if (d2) diffs.push(d2);
    }
    expect(diffs).toEqual([]);
    expect(css).toContain("color-scheme: light;");
  });

  it("reports only the accessibility failures the preset acknowledges", () => {
    expect(brand.warnings.map((w) => w.message)).toEqual([]);
  });

  it("every acknowledged failure still measures what it says it measures", () => {
    /* An acknowledgement is a person having looked at a number. If the number
       moved, nobody has looked at the current one — and a listed failure that
       now PASSES is worse still, because it means a fix landed and the note
       telling the next reader it is broken never came out. */
    const drifted: string[] = [];
    for (const row of measureAcknowledged(OBSIDIAN, brand)) {
      if (Math.abs(row.actual - row.recorded) > 0.01) {
        drifted.push(`${row.token} (${row.scheme}): recorded ${row.recorded}, measured ${row.actual.toFixed(2)}`);
      }
    }
    expect(drifted).toEqual([]);
  });

  it("the acknowledged failures are exactly the ones the FIXTURE has", () => {
    /* Measured against the sheet itself, not against the engine — so the
       allowlist cannot grow to cover an engine bug. If the engine broke a token
       the fixture gets right, that token fails here even if somebody added it
       to `acknowledged`. */
    const failing: string[] = [];
    for (const duty of OBSIDIAN.duties) {
      for (const scheme of duty.scheme === "both" ? (["dark", "light"] as const) : [duty.scheme]) {
        const map = scheme === "dark" ? fixtureRoot : fixtureLightResolved;
        const fg = map.get(duty.token)!;
        const bg = duty.against.startsWith("--") ? map.get(duty.against)! : duty.against;
        if (contrastRatio(fg, bg) < duty.min) failing.push(`${duty.token}|${scheme}`);
      }
    }
    expect(failing.sort()).toEqual(
      OBSIDIAN.acknowledged.map((a) => `${a.token}|${a.scheme}`).sort(),
    );
  });

  it("reports what fraction of the sheet is actually derived", () => {
    const counts = { derived: 0, structural: 0, fixed: 0 };
    for (const name of ROOT_TOKEN_NAMES) {
      const p = brand.provenance[name];
      if (p) counts[p] += 1;
    }
    const total = counts.derived + counts.structural + counts.fixed;
    console.log(
      `provenance of ${total} tokens — derived (moves with a client seed): ${counts.derived}, ` +
        `structural (template, brand-independent): ${counts.structural}, ` +
        `fixed (categorical, deliberately not branded): ${counts.fixed}`,
    );
    expect(total).toBe(ROOT_TOKEN_NAMES.length);

    /* Asserted exactly, not as a floor. A floor lets a refactor quietly move
       work from "derived" to "fixed" and still pass, which would make the number
       this test prints meaningless — and that number is the only thing keeping
       "reproduces 166 tokens" from being a misleading headline.

       Read it as: 66 tokens are DELIBERATELY not branded (the light dropdown
       island, the categorical avatar and status palettes, the on-fill inks) —
       that is stated design policy, not a shortfall. Of the 100 a brand does
       reach, 63 move when a client changes a seed and 37 are brand-independent
       templates (neutral veils, depth shadows, radii, fonts, gradients).
       Changing any of these three numbers is a design decision and must show up
       in a diff. */
    expect(counts).toEqual({ derived: 63, structural: 37, fixed: 66 });
  });
});
