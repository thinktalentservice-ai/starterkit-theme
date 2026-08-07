/* Coverage for the 2026-08-07 rewire: `resolveBrand` used to search the light
 * window only and hand the dark window a bare `rampAt()` with no duty check at
 * all. The golden test can't catch a regression here — obsidian's own dark
 * duties are `enforce: "report"`, not `"search"`, so it never exercises this
 * path. These tests build a synthetic preset specifically to exercise it.
 *
 * Ramp values below are measured, not guessed — see the contrast/lightness
 * table in each test's comment. Six steps, lightest first:
 *   0 #eaf2ff  1 #b8d4ff  2 #8fbfff  3 #4e8cff  4 #2e5fcc  5 #153e80
 * against #10121c (dark surface): 16.57 12.35 9.83 5.79 3.22 1.81
 * against #ffffff (light surface): 1.13  1.51  1.90 3.22 5.79 10.33
 * against #0d0f1a (a second dark literal, used to test direction-by-background):
 *                                  16.94 12.63 10.06 5.92 3.29 1.85
 */
import { hexToOklch } from "../color/oklch";
import { contrastRatio } from "../color/contrast";
import { measureGeometry } from "./ramp";
import { resolveBrand } from "./resolve";
import type { Duty, FamilySpec, PresetSpec } from "./spec";

const RAMP_HEXES = ["#eaf2ff", "#b8d4ff", "#8fbfff", "#4e8cff", "#2e5fcc", "#153e80"] as const;
const SEED_INDEX = 2; // "#8fbfff" — arbitrary, only the measured geometry matters

function family(slots: Record<string, number>, extra: Partial<FamilySpec> = {}): FamilySpec {
  return {
    seed: RAMP_HEXES[SEED_INDEX],
    geometry: measureGeometry(RAMP_HEXES, SEED_INDEX),
    slots,
    ...extra,
  };
}

const NEUTRAL_STEP = { dL: 0, cScale: 1, dH: 0 } as const; // identity: ramp[0] === seed, byte-exact

function basePreset(overrides: Partial<PresetSpec>): PresetSpec {
  return {
    id: "test",
    name: "test",
    intensity: 1,
    radius: 8,
    families: { brand: family({ "--x": 4 }) },
    neutral: {
      dark: { seed: "#10121c", slots: { "--surface": NEUTRAL_STEP } },
      light: { seed: "#ffffff", slots: { "--surface": NEUTRAL_STEP } },
    },
    tokens: {},
    provenance: {},
    duties: [],
    acknowledged: [],
    ...overrides,
  };
}

describe("resolveBrand — bidirectional, both-scheme duty search", () => {
  it("searches the dark scheme now, not just light", () => {
    // "--x" starts at dark index 4 ("#2e5fcc"), 3.22:1 on the dark surface —
    // before this rewire this shipped un-searched and un-warned.
    const unsearched = RAMP_HEXES[4];
    expect(contrastRatio(unsearched, "#10121c")).toBeLessThan(4.5);

    const duty: Duty = {
      token: "--x",
      against: "--surface",
      min: 4.5,
      scheme: "dark",
      because: "test",
      enforce: "search",
    };
    const preset = basePreset({ duties: [duty] });
    const brand = resolveBrand(preset);

    const resolved = brand.dark.get("--x")!;
    expect(contrastRatio(resolved, "#10121c")).toBeGreaterThanOrEqual(4.5);
    // It actually moved, and moved LIGHTER (toward index 0) — a dark surface
    // needs a lighter foreground, the opposite direction from the light search.
    expect(resolved).not.toBe(unsearched);
    expect(hexToOklch(resolved).l).toBeGreaterThan(hexToOklch(unsearched).l);
    expect(brand.warnings).toEqual([]);
  });

  it("leaves the dark scheme alone when its duties are report-only, byte for byte", () => {
    // The exact obsidian shape: a dark duty that must NOT move the token, only
    // measure and warn. This is what proves the rewire didn't turn every dark
    // family slot into a moving target.
    const duty: Duty = {
      token: "--x",
      against: "--surface",
      min: 4.5,
      scheme: "dark",
      because: "test",
      enforce: "report",
    };
    const preset = basePreset({ duties: [duty] });
    const brand = resolveBrand(preset);

    expect(brand.dark.get("--x")).toBe(RAMP_HEXES[4]);
    expect(brand.warnings).toHaveLength(1);
    expect(brand.warnings[0]!.token).toBe("--x");
  });

  it("picks direction from background lightness, not from a scheme constant", () => {
    // A `scheme: "light"` duty pointed at a DARK literal background. If
    // direction were hard-picked from scheme (the old bug class), this would
    // walk toward the ramp's dark end and never converge. Direction must come
    // from comparing the background's lightness to the candidate's: dark
    // background here means the fix is "lighten", same as a dark-scheme duty,
    // even though `duty.scheme` says "light".
    //
    // Family's dark slot is 3, so the light window (dark + default shift 1)
    // starts at index 4 ("#2e5fcc") — 3.29:1 on "#0d0f1a".
    const start = RAMP_HEXES[4];
    expect(contrastRatio(start, "#0d0f1a")).toBeLessThan(4.5);

    const duty: Duty = {
      token: "--x",
      against: "#0d0f1a", // literal, not a token — deliberately not "--surface"
      min: 4.5,
      scheme: "light",
      because: "test",
      enforce: "search",
    };
    const preset = basePreset({
      families: { brand: family({ "--x": 3 }) },
      duties: [duty],
    });
    const brand = resolveBrand(preset);

    const resolved = brand.light.get("--x")!;
    expect(contrastRatio(resolved, "#0d0f1a")).toBeGreaterThanOrEqual(4.5);
    expect(hexToOklch(resolved).l).toBeGreaterThan(hexToOklch(start).l);
  });

  it("darkFollow keeps a companion in step with its leader, symmetric to lightFollow", () => {
    const duty: Duty = {
      token: "--x",
      against: "--surface",
      min: 4.5,
      scheme: "dark",
      because: "test",
      enforce: "search",
    };
    const preset = basePreset({
      families: {
        brand: family({ "--x": 4, "--x-dark": 5 }, { darkFollow: { "--x-dark": "--x" } }),
      },
      duties: [duty],
    });
    const brand = resolveBrand(preset);

    // "--x" advances from index 4; whatever that advance is, "--x-dark" (base
    // index 5) must take the SAME advance, not stay pinned at index 5.
    const xResolved = brand.dark.get("--x")!;
    const xAdvance = RAMP_HEXES.indexOf(xResolved as (typeof RAMP_HEXES)[number]) - 4;
    expect(xAdvance).not.toBe(0); // sanity: the leader actually moved
    expect(brand.dark.get("--x-dark")).toBe(RAMP_HEXES[5 + xAdvance]);
  });

  it("bounds the search at the ramp's end instead of throwing on an impossible duty", () => {
    const duty: Duty = {
      token: "--x",
      against: "--surface",
      min: 21, // unreachable — 21:1 is the theoretical max, black-on-white
      scheme: "dark",
      because: "test",
      enforce: "search",
    };
    const preset = basePreset({ duties: [duty] });
    const brand = resolveBrand(preset);

    expect(brand.dark.get("--x")).toBe(RAMP_HEXES[0]); // walked all the way to the lightest entry
    expect(brand.warnings).toHaveLength(1);
    expect(brand.warnings[0]!.ratio).toBeLessThan(21);
  });

  // Regression for a bug Codex's adversarial review caught in the first version
  // of this rewire: `slotIndex()` is unclamped (a `lightShift` or a bad slot
  // number can hand the search a start already past `bound`), and a naive
  // `while (index !== bound)` never terminates when the walk moves AWAY from
  // `bound` instead of toward it. These two must complete (not hang the test
  // run) and must land on the ramp's clamped extreme, matching what `rampAt`
  // was already going to return for that out-of-range index anyway.

  it("terminates instead of looping forever when the darken start is already past the ramp's end", () => {
    const duty: Duty = {
      token: "--x",
      against: "#ffffff",
      min: 21, // unreachable, so the walk must run all the way to the bound and stop
      scheme: "light",
      because: "test",
      enforce: "search",
    };
    const preset = basePreset({
      // dark index 5 (the ramp's last valid entry) + lightShift 10 -> light
      // start = 15, nine past the ramp's actual end (index 5).
      families: { brand: family({ "--x": 5 }, { lightShift: { "--x": 10 } }) },
      duties: [duty],
    });
    const brand = resolveBrand(preset);

    expect(brand.light.get("--x")).toBe(RAMP_HEXES[5]);
    expect(brand.warnings).toHaveLength(1);
  });

  it("terminates instead of looping forever when the lighten start is already before the ramp's start", () => {
    const duty: Duty = {
      token: "--x",
      against: "--surface",
      min: 21, // unreachable, so the walk must run all the way to the bound and stop
      scheme: "dark",
      because: "test",
      enforce: "search",
    };
    // Dark slot index -3: three before the ramp's actual start (index 0).
    const preset = basePreset({ families: { brand: family({ "--x": -3 }) }, duties: [duty] });
    const brand = resolveBrand(preset);

    expect(brand.dark.get("--x")).toBe(RAMP_HEXES[0]);
    expect(brand.warnings).toHaveLength(1);
  });
});
