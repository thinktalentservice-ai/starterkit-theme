/* Verification for the colour maths, in two tiers.
 *
 * TIER 1 — the published reference. Sharma, Wu & Dalal (2005) supply a test set
 * built specifically to break naive CIEDE2000 implementations: pairs straddling
 * the 0/360 hue discontinuity, pairs where one colour is neutral (C' = 0, which
 * the unguarded formula turns into NaN), and near-black pairs where the L*
 * weighting term dominates. Matching that set is not evidence of correctness,
 * it is the definition of it.
 *
 * TIER 2 — an independent implementation. `culori` is a devDependency ONLY: the
 * engine still ships zero runtime dependencies, because it runs in a build
 * script, a route handler and possibly the edge, and a colour library is a
 * supply-chain surface for arithmetic already written here. What culori buys is
 * a second opinion from a different author over a large sample, which catches
 * the failure a hand-picked table cannot — a systematic transcription error in
 * a matrix that happens to be self-consistent on round-trips.
 *
 * The cross-check paid for itself twice while being written. It caught that the
 * rounded sRGB->XYZ matrix everyone copies disagrees with a reference
 * implementation in the third decimal of a*, and it caught that CSS's Lab is D50
 * while ciede2000 wants D65 — the first version of this file "proved" culori was
 * broken when the harness was handing it the wrong illuminant.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as culori from "culori";
import { deltaE00, deltaE00Hex, hexToLab } from "./deltaE";
import { clampChroma, inSrgbGamut } from "./gamut";
import { hexToOklch, normalizeHex, oklchToHex } from "./oklch";

const culoriDe = culori.differenceCiede2000();
const toLab65 = culori.converter("lab65");
const toOklch = culori.converter("oklch");
const lab65 = (l: number, a: number, b: number) => ({ mode: "lab65" as const, l, a, b });

const FIXTURE_HEXES = [
  ...new Set(
    (
      readFileSync(
        fileURLToPath(new URL("../tokens/__fixtures__/obsidian-2026-08-06.css", import.meta.url)),
        "utf8",
      ).match(/#[0-9a-fA-F]{3,8}\b/g) ?? []
    )
      .filter((h) => h.length === 4 || h.length === 7)
      .map((h) => normalizeHex(h)),
  ),
];

describe("deltaE00 — Sharma/Wu/Dalal reference data", () => {
  /* From the paper's supplementary table. These are NOT adjusted to make an
     implementation pass; if the code disagrees, the code is wrong. */
  const cases: Array<[[number, number, number], [number, number, number], number, string]> = [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425, "hue near the blue discontinuity"],
    [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615, "same, wider"],
    [[50, 2.8361, -74.02], [50, 0, -82.7485], 3.4412, "same, wider still"],
    [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0, "hue straddles 0/360"],
    [[50, 2.5, 0], [50, 0, -2.5], 4.3065, "low chroma, RT rotation term active"],
    [[50, 2.5, 0], [73, 25, -18], 27.1492, "large difference"],
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644, "real surface colours"],
    [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082, "near black, SL dominates"],
  ];

  it.each(cases)("%j vs %j is %f (%s)", (a, b, expected) => {
    const got = deltaE00({ l: a[0], a: a[1], b: a[2] }, { l: b[0], a: b[1], b: b[2] });
    expect(got).toBeCloseTo(expected, 4);
  });

  it("is zero for identical colours and symmetric for every other pair", () => {
    for (const hex of FIXTURE_HEXES) expect(deltaE00Hex(hex, hex)).toBeCloseTo(0, 12);
    for (let i = 1; i < FIXTURE_HEXES.length; i += 1) {
      const a = FIXTURE_HEXES[i - 1]!;
      const b = FIXTURE_HEXES[i]!;
      expect(deltaE00Hex(a, b)).toBeCloseTo(deltaE00Hex(b, a), 10);
    }
  });

  it("puts pure white at exactly L=100, a=0, b=0", () => {
    // Only true when the white point is the conversion matrix's own row sums.
    // Take them from separate sources and dE00 picks up a noise floor.
    const white = hexToLab("#ffffff");
    expect(white.l).toBeCloseTo(100, 10);
    expect(white.a).toBeCloseTo(0, 10);
    expect(white.b).toBeCloseTo(0, 10);
  });
});

describe("cross-check against culori (devDependency, second opinion)", () => {
  it("agrees on Lab for every colour the shipped sheet contains", () => {
    const off: string[] = [];
    for (const hex of FIXTURE_HEXES) {
      const mine = hexToLab(hex);
      const theirs = toLab65(hex)!;
      const gap = Math.max(
        Math.abs(mine.l - theirs.l),
        Math.abs(mine.a - theirs.a!),
        Math.abs(mine.b - theirs.b!),
      );
      if (gap > 1e-9) off.push(`${hex} gap ${gap.toExponential(2)}`);
    }
    expect(off).toEqual([]);
  });

  it("agrees on OKLCH for every colour the shipped sheet contains", () => {
    /* Lightness and chroma are compared tightly; HUE IS NOT, below a chroma
       threshold, and that is a property of the coordinate system rather than a
       concession. Hue is `atan2(b, a)`: as chroma approaches zero the angle
       becomes arbitrarily ill-conditioned, so two implementations agreeing to
       1e-15 on a and b can still report hues degrees apart on a near-grey like
       `#f8fafc`. Asserting hue there would be asserting float noise. Above
       c = 0.01 — ten times what 8-bit quantization can resolve — the angle is
       well determined and is compared.
     *
     * The three tolerances are MEASURED, not chosen. Swept over ~630k sRGB
     * colours the largest disagreements with culori are:
     *
     *     |dL|  6.562e-9   at #ffffc3
     *     |dC|  3.727e-8   at #ffffff   (the grey-chroma floor, exactly the
     *                                   value that set GREY_CHROMA in oklch.ts)
     *     |dH|  2.066e-4 deg at #f6fffc (c only just above the threshold)
     *
     * The bounds below sit 27x-150x above those and 500x-1500x below one 8-bit
     * step, so they are a real gap in both directions rather than a number
     * lowered until the test went green. */
    const off: string[] = [];
    for (const hex of FIXTURE_HEXES) {
      const mine = hexToOklch(hex);
      const theirs = toOklch(hex)!;
      if (Math.abs(mine.l - theirs.l) > 1e-6) off.push(`${hex} L ${mine.l} vs ${theirs.l}`);
      if (Math.abs(mine.c - theirs.c) > 1e-6) off.push(`${hex} C ${mine.c} vs ${theirs.c}`);
      const hueDefined = theirs.h !== undefined && !Number.isNaN(theirs.h);
      if (mine.c > 0.01 && hueDefined && Math.abs(mine.h - theirs.h!) > 1e-2) {
        off.push(`${hex} H ${mine.h} vs ${theirs.h}`);
      }
    }
    expect(off).toEqual([]);
  });

  it("agrees on dE00 across 20k pseudo-random Lab pairs", () => {
    /* Deterministic LCG, not Math.random: a cross-implementation check that
       fails one run in fifty and passes on rerun is worse than no check. Every
       seventh pair is forced neutral (a = b = 0) because that is the branch the
       unguarded formula turns into NaN, and a uniform sample almost never hits
       it. */
    let seed = 0x9e3779b9;
    const rand = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    const pick = (): [number, number, number] => [
      rand() * 100,
      rand() * 256 - 128,
      rand() * 256 - 128,
    ];

    let worst = 0;
    for (let i = 0; i < 20_000; i += 1) {
      const [l1, a1, b1] = i % 7 === 0 ? ([rand() * 100, 0, 0] as const) : pick();
      const [l2, a2, b2] = pick();
      const mine = deltaE00({ l: l1, a: a1, b: b1 }, { l: l2, a: a2, b: b2 });
      const theirs = culoriDe(lab65(l1, a1, b1), lab65(l2, a2, b2));
      worst = Math.max(worst, Math.abs(mine - theirs));
    }
    expect(worst).toBeLessThan(1e-9);
  });

  it("clamps to a colour that is displayable ONCE QUANTIZED, and says how far off the exact bound it is", () => {
    /* Compares the PROPERTY, not the algorithm. culori's clampChroma uses a
       different search and a different stopping rule, so demanding identical
       output would assert an implementation detail.
     *
     * The claim asserted here is deliberately the weaker, TRUE one. culori's
     * `inGamut` uses an exact [0,1] bound; this package uses a 1e-6 tolerance,
     * measured to sit just above the 1.978e-7 round-off floor of the OKLab round
     * trip (below which pure white itself reports as out of gamut). So the two
     * WILL disagree on the last sliver of chroma, and pretending otherwise by
     * loosening the check to `expect(true)` would be worse than measuring it.
     *
     * What must hold, and is checked: the emitted 8-bit colour is inside the
     * gamut with nothing clipped, it is within a just-noticeable difference of
     * what an exact implementation produces, and the residual overshoot stays
     * below one thousandth of an 8-bit step — i.e. unrepresentable, not merely
     * small. */
    const bad: string[] = [];
    const overshoots: number[] = [];
    const inGamut = culori.inGamut("rgb");
    const toRgb = culori.converter("rgb");

    for (let h = 0; h < 360; h += 7) {
      for (const l of [0.15, 0.35, 0.55, 0.75, 0.95]) {
        const request = { l, c: 0.4, h };
        const mine = clampChroma(request);
        const hex = oklchToHex(mine);

        // 1. What actually ships — the quantized colour — is unambiguously fine.
        if (!inGamut(hex)) bad.push(`h=${h} l=${l}: emitted ${hex} is out of gamut`);

        /* 2. It agrees with an independent implementation to within a JND.
              `clampChroma(color, mode, gamut)` — the SECOND argument is the
              space to reduce chroma in, not the destination gamut. Passing
              "rgb" there converts to a mode with no chroma channel and silently
              degrades to clipping, which is how this comparison first "found" a
              12 dE00 disagreement that was entirely the harness's fault. */
        const theirs = culori.formatHex(culori.clampChroma({ mode: "oklch", ...request }, "oklch"));
        const dE = deltaE00Hex(hex, theirs);
        if (dE > 1) bad.push(`h=${h} l=${l}: ${hex} vs culori ${theirs} — dE00 ${dE.toFixed(3)}`);

        // 3. Not needlessly conservative: one visible step more chroma must fail.
        if (mine.c > 0 && inSrgbGamut({ ...mine, c: mine.c + 1e-4 })) {
          bad.push(`h=${h} l=${l}: gave away chroma, c=${mine.c.toFixed(6)}+1e-4 still fits`);
        }

        // 4. Quantify the disagreement instead of asserting it away.
        const rgb = toRgb({ mode: "oklch", l: mine.l, c: mine.c, h: mine.h })!;
        overshoots.push(
          Math.max(0, -rgb.r, -rgb.g, -rgb.b, rgb.r - 1, rgb.g - 1, rgb.b - 1) * 255,
        );
      }
    }

    expect(bad).toEqual([]);
    const worst = Math.max(...overshoots);
    /* Measured at 3.307e-3 of an 8-bit step across this sweep — one three-
       hundredth of the smallest colour a screen can show. The bound is 3x that,
       and it is asserted rather than described so that loosening the gamut
       tolerance in gamut.ts cannot pass unnoticed: raise EPSILON and this number
       moves with it. */
    expect(worst, `worst overshoot in 8-bit units: ${worst.toExponential(3)}`).toBeLessThan(1e-2);
  });

  it("agrees on the hex an in-gamut OKLCH triple renders as", () => {
    const off: string[] = [];
    for (let h = 0; h < 360; h += 11) {
      for (const l of [0.2, 0.5, 0.8]) {
        for (const c of [0.02, 0.1]) {
          const triple = { mode: "oklch" as const, l, c, h };
          if (!culori.inGamut("rgb")(triple)) continue; // clamping is the test above
          const mine = oklchToHex({ l, c, h });
          const theirs = culori.formatHex(triple);
          if (mine !== theirs) off.push(`l=${l} c=${c} h=${h}: ${mine} vs ${theirs}`);
        }
      }
    }
    expect(off).toEqual([]);
  });
});
