/* Structural invariants of the resolved catalogue.
 *
 * WHAT THIS FILE USED TO BE, AND WHAT IT NO LONGER IS. It was a golden test in
 * the strict sense: `resolveBrand(PRESETS.obsidian)` had to reproduce
 * `src/tokens/__fixtures__/obsidian-2026-08-06.css` — a byte-verified snapshot
 * of a hand-tuned sheet that PREDATED this engine — value for value, in both
 * schemes. That made it an independent anchor: the engine could not move a
 * colour without the test noticing, because the expected answer came from
 * somewhere the engine had no influence over.
 *
 * That anchor is gone, deliberately, and it is the largest single cost of this
 * change. The brand it anchored has been deleted; there is no hand-tuned sheet
 * for `think` and inventing one by pasting the engine's own output would be a
 * test asserting that the engine produces what the engine produced. Rather than
 * dress that up, the fixture comparisons are DELETED and what remains is stated
 * for what it is: structural invariants, not a reproduction proof.
 *
 * WHAT STILL CATCHES A DRIFTING COLOUR ENGINE. The maths anchors are brand-free
 * and untouched — `contrast.test.ts` (a measured hand-fix reproduced from first
 * principles, ray enumeration, the `minChroma` budget), `deltaE.test.ts`
 * (Sharma/Wu/Dalal published reference data plus a 20,000-pair culori
 * cross-check), `oklch.test.ts`, `gamut.test.ts`. A matrix typo or a wrong
 * transfer function still fails, loudly, against numbers no one here chose.
 * What is genuinely no longer guaranteed is that a specific curated sheet is
 * reproduced. There is no longer such a sheet.
 */
import { describe, expect, it } from "vitest";
import { contrastRatio } from "../color/contrast";
import { hexToTriple, normalizeHex } from "../color/oklch";
import { LADDER, LADDER_REFERENCE, LADDER_SEED_INDEX, ROLE_NAMES } from "./ladder";
import { DEFAULT_PRESET_ID, PRESETS, PRESET_IDS } from "../presets/index";
import {
  CHANNEL_PAIRS,
  ROOT_TOKEN_NAMES,
  UNPAIRED_CHANNEL_TOKEN_NAMES,
} from "../tokens/names";
import { readTokens } from "./parse";
import { buildRamp, measureGeometry } from "./ramp";
import { measureAcknowledged, resolveBrand } from "./resolve";
import { serializeBrandCss } from "./serialize";

/* MEASURED, then written down.
 *
 * Read it as: 48 of the 168 tokens are DELIBERATELY not branded — the light
 * dropdown island (34), the categorical status palette (6+6) and the two fixed
 * overlay channel constants. That is stated design policy, not a shortfall; the
 * dropdown is the escape hatch a client uses when a brand turns out unreadable,
 * so it must not be painted by that brand. Of the 120 a brand does reach, 81
 * move when a seed changes and 39 are brand-independent templates (the neutral
 * veils, the depth shadows, the radii, the fonts, the gradient var() strings).
 *
 * The two avatar variants moved this by 5: `--gradient-avatar-2` and
 * `--gradient-avatar-3` are structural (a `var()` template that reads the same
 * on every brand), and `--gradient-avatar-2-ink`, `--gradient-avatar-3-from`
 * and `--gradient-avatar-3-ink` are derived (all three are resolved from the
 * primary seed).
 *
 * Changing any of these three numbers is a design decision and must show up in
 * a diff. */
const PROVENANCE_HISTOGRAM = { derived: 81, structural: 39, fixed: 48 };

const DEFAULT = PRESETS[DEFAULT_PRESET_ID]!;
const brand = resolveBrand(DEFAULT);

describe(`golden — resolveBrand(${DEFAULT_PRESET_ID})`, () => {
  it("rebuilds the ladder byte-exactly from its relative geometry", () => {
    /* The claim that makes the geometry usable on a client's hex: converting a
       ramp to OKLCH offsets and back, through gamut clamping and 8-bit
       rounding, loses nothing. If this drifts, every family in every preset
       drifts with it — there is exactly one geometry now, so this single
       assertion covers the whole catalogue. */
    const rebuilt = buildRamp(LADDER_REFERENCE[LADDER_SEED_INDEX]!, LADDER);
    expect(rebuilt).toEqual(LADDER_REFERENCE.map((h) => normalizeHex(h)));
  });

  it("rebuilds every preset's every family ramp byte-exactly", () => {
    const broken: string[] = [];
    for (const id of PRESET_IDS) {
      const preset = PRESETS[id];
      if (!preset) continue;
      for (const [f, spec] of Object.entries(preset.families)) {
        const built = buildRamp(spec.seed, spec.geometry);
        const remeasured = buildRamp(built[LADDER_SEED_INDEX]!, measureGeometry(built, LADDER_SEED_INDEX));
        for (const [i, hex] of built.entries()) {
          if (remeasured[i] !== hex) broken.push(`${id}.${f}[${i}] ${hex} -> ${remeasured[i]}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it("emits exactly the ABI's token set", () => {
    /* Both directions. A token in the ABI the engine stopped emitting renders
       whatever a consuming package vendored as its fallback — silently, with no
       console error, on a page that is supposed to be branded. A token the
       engine emits that the ABI never heard of is invisible to every consumer. */
    const emitted = new Set(brand.dark.keys());
    const abi = new Set<string>(ROOT_TOKEN_NAMES);
    expect([...abi].filter((n) => !emitted.has(n)), "in the ABI, not emitted").toEqual([]);
    expect([...emitted].filter((n) => !abi.has(n)), "emitted, absent from the ABI").toEqual([]);
  });

  it("every channel token is the RGB triple of its base, in BOTH schemes", () => {
    /* Structurally guaranteed by the `channel` TokenRule rather than by a
       naming convention, and asserted anyway: 32 call sites across the two
       sibling packages do `rgb(var(--x-channel) / α)`, and a hex written there
       invalidates all of them at computed-value time with no error anywhere. */
    const wrong: string[] = [];
    for (const [channel, base] of CHANNEL_PAIRS) {
      for (const scheme of ["dark", "light"] as const) {
        const map = scheme === "dark" ? brand.dark : brand.light;
        const expected = hexToTriple(map.get(base)!);
        if (map.get(channel) !== expected) {
          wrong.push(`${channel} (${scheme}): ${map.get(channel)} != ${expected} (${base})`);
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

  it("serializes to CSS that parses back to the same values", () => {
    /* Round-trip through the emitter, so a serialization bug cannot hide behind
       a correct in-memory map. This is the artifact that actually ships. */
    const css = serializeBrandCss(brand, { order: Object.keys(DEFAULT.provenance) });
    const root = readTokens(css, ":root");
    const light = new Map([...root, ...readTokens(css, '[data-mui-color-scheme="light"]')]);

    const diffs: string[] = [];
    for (const token of ROOT_TOKEN_NAMES) {
      if (brand.dark.get(token) !== root.get(token)) {
        diffs.push(`${token} (dark): ${brand.dark.get(token)} != ${root.get(token)}`);
      }
      if (brand.light.get(token) !== light.get(token)) {
        diffs.push(`${token} (light): ${brand.light.get(token)} != ${light.get(token)}`);
      }
    }
    expect(diffs).toEqual([]);
    expect(css).toContain("color-scheme: light;");
  });

  it("emits the sheet in the PRESET's declared order, not the ABI's", () => {
    /* The cycle-break, asserted rather than commented. `ROOT_TOKEN_NAMES` is
       generated by parsing this sheet, so if the sheet were ordered by it the
       order would be self-referential — and with the seed fixture deleted it
       would settle on "alphabetical, forever". `sheetOrder()` in
       src/presets/base.ts is the one place the order is decided. */
    const declared = Object.keys(DEFAULT.provenance).filter((n) => brand.dark.has(n));
    const css = serializeBrandCss(brand, { order: Object.keys(DEFAULT.provenance) });
    const emitted = [...readTokens(css, ":root").keys()].filter((n) => !n.startsWith("--tokens-"));
    expect(emitted).toEqual(declared);
  });

  it("reports no accessibility failures at all", () => {
    /* Not "only the ones acknowledged" — none. Every duty is `enforce: "search"`
       and `acknowledged` is empty, which is the whole point of authoring a
       catalogue rather than reproducing one: the previous six presets carried
       four measured, shipping defects between them because searching would have
       restyled live pages under a pixel-identity promise. */
    expect(brand.warnings.map((w) => `${w.token}|${w.scheme}|${w.ratio.toFixed(2)}`)).toEqual([]);
    expect(DEFAULT.acknowledged).toEqual([]);
    expect(measureAcknowledged(DEFAULT, brand)).toEqual([]);
  });

  it("every duty is genuinely met, measured independently of the resolver", () => {
    /* The resolver decides whether a duty is met and then reports it, so
       `warnings: []` is the resolver agreeing with itself. This re-measures
       every duty from the emitted values. */
    const failing: string[] = [];
    for (const duty of DEFAULT.duties) {
      const schemes = duty.scheme === "both" ? (["dark", "light"] as const) : [duty.scheme];
      for (const scheme of schemes) {
        const map = scheme === "dark" ? brand.dark : brand.light;
        const fg = map.get(duty.token)!;
        const bg = duty.against.startsWith("--") ? map.get(duty.against)! : duty.against;
        const ratio = contrastRatio(fg, bg);
        if (ratio < duty.min) {
          failing.push(`${duty.token}|${scheme}: ${ratio.toFixed(2)} < ${duty.min}`);
        }
      }
    }
    expect(failing).toEqual([]);
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
       work from "derived" to "fixed" and still pass, which would make the
       printed number meaningless — and that number is the only thing keeping
       "the engine emits N tokens" from being a misleading headline. */
    expect(counts).toEqual(PROVENANCE_HISTOGRAM);
  });

  it("the six roles are exactly the families every preset declares", () => {
    for (const id of PRESET_IDS) {
      const preset = PRESETS[id];
      if (!preset) continue;
      expect(Object.keys(preset.families).sort(), id).toEqual([...ROLE_NAMES].sort());
    }
  });
});
