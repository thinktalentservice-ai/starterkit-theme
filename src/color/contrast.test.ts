import { contrastRatio, emittableRay, fitContrast, relativeLuminance } from "./contrast";
import { clampChroma } from "./gamut";
import { hexToOklch, oklchToHex } from "./oklch";

describe("contrastRatio", () => {
  /* Measured against the real token sheet. These are the values that decided
     the 2026-08-06 light-mode retune, so they are authoritative here. */
  const cases: Array<[string, string, number]> = [
    ["#000000", "#ffffff", 21.0],
    ["#ffffff", "#ffffff", 1.0],
    ["#6B7D20", "#ffffff", 4.59],
    ["#56631A", "#ffffff", 6.57],
    ["#8A9F2A", "#ffffff", 2.97],
    ["#B3D335", "#ffffff", 1.71],
    ["#7c3aed", "#ffffff", 5.7],
    ["#b45309", "#ffffff", 5.02],
    ["#e11d48", "#ffffff", 4.7],
    ["#005FB8", "#ffffff", 6.31],
  ];

  it.each(cases)("%s on %s is %f:1", (fg, bg, expected) => {
    expect(contrastRatio(fg, bg)).toBeCloseTo(expected, 2);
  });

  it("is order-independent", () => {
    for (const [fg, bg] of cases) {
      expect(contrastRatio(fg, bg)).toBeCloseTo(contrastRatio(bg, fg), 10);
    }
  });

  it("bounds luminance to 0..1", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 10);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 10);
  });
});

describe("fitContrast", () => {
  it("reproduces the 2026-08-06 hand-fix", () => {
    /* A person moved the light-mode brand green from #8A9F2A (2.97:1 on white
       — fails WCAG 1.4.3 AND 1.4.11) to #6B7D20 (4.59:1). This is that
       judgement as code. NOT asserted equal to #6B7D20: the function returns
       the LIGHTEST passing value, i.e. it lands just past the threshold, while
       the human picked a rounder number with more headroom. Landing in the same
       place for the same reason is the claim; matching their rounding is not. */
    const fit = fitContrast("#8A9F2A", [{ against: "#ffffff", min: 4.5 }], "darken");

    expect(fit.ok).toBe(true);
    expect(contrastRatio(fit.hex, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(fit.hex, "#ffffff")).toBeLessThanOrEqual(4.9);
    // Same brand, just legible: hue must survive.
    expect(hexToOklch(fit.hex).h).toBeCloseTo(hexToOklch("#8A9F2A").h, 0);
  });

  it("reports ratios measured on the returned hex, not on a float mid-point", () => {
    const fit = fitContrast("#8A9F2A", [{ against: "#ffffff", min: 4.5 }], "darken");
    expect(fit.ratios[0]).toBeCloseTo(contrastRatio(fit.hex, "#ffffff"), 10);
  });

  it("leaves a colour that already passes completely alone", () => {
    const fit = fitContrast("#56631A", [{ against: "#ffffff", min: 4.5 }], "darken");
    expect(fit.ok).toBe(true);
    expect(fit.hex).toBe("#56631a");
  });

  it("satisfies several targets at once", () => {
    // The real shape: legible as text on the surface AND distinguishable as a
    // 3:1 focus border. 1.4.3 plus 1.4.11.
    const targets = [
      { against: "#ffffff", min: 4.5 },
      { against: "#f6f7fb", min: 4.5 },
    ];
    const fit = fitContrast("#B3D335", targets, "darken");
    expect(fit.ok).toBe(true);
    expect(contrastRatio(fit.hex, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(fit.hex, "#f6f7fb")).toBeGreaterThanOrEqual(4.5);
  });

  it("lightens for a dark surface", () => {
    const fit = fitContrast("#005FB8", [{ against: "#0d0f1a", min: 4.5 }], "lighten");
    expect(fit.ok).toBe(true);
    expect(contrastRatio(fit.hex, "#0d0f1a")).toBeGreaterThanOrEqual(4.5);
  });

  it("reaches AAA when asked", () => {
    // The `beacon` preset targets 7:1 rather than 4.5:1.
    const fit = fitContrast("#B3D335", [{ against: "#ffffff", min: 7 }], "darken");
    expect(fit.ok).toBe(true);
    expect(contrastRatio(fit.hex, "#ffffff")).toBeGreaterThanOrEqual(7);
  });

  it("returns ok:false instead of throwing when the target is unreachable", () => {
    // Nothing is 4.5:1 against white by getting lighter.
    const fit = fitContrast("#ffffff", [{ against: "#ffffff", min: 4.5 }], "lighten");
    expect(fit.ok).toBe(false);
    expect(fit.hex).toMatch(/^#[0-9a-f]{6}$/);
    expect(fit.ratios[0]).toBeLessThan(4.5);
  });

  it("never certifies a value that misses the target", () => {
    /* The property that carries the whole module: ok === true must imply every
       target is met BY THE RETURNED HEX. Swept over the hue circle and the
       three thresholds the presets actually use, in both directions. A
       false positive here ships an illegible brand with a green build. */
    const failures: string[] = [];
    for (let h = 0; h < 360; h += 11) {
      for (const min of [3, 4.5, 7]) {
        for (const [dir, against] of [
          ["darken", "#ffffff"],
          ["lighten", "#0d0f1a"],
        ] as const) {
          const start = oklchToHex({ l: dir === "darken" ? 0.8 : 0.35, c: 0.15, h });
          const fit = fitContrast(start, [{ against, min }], dir);
          if (!fit.ok) continue;
          const got = contrastRatio(fit.hex, against);
          if (got < min) failures.push(`${dir} h=${h} min=${min}: ${start} -> ${fit.hex} = ${got.toFixed(3)}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("returns the NEAREST passing colour, not merely a passing one", () => {
    /* The guarantee bisection could not give: the result is the minimal change
       to the client's colour, not just some legible colour.

       Brute-forces the search range at 16x the function's own resolution and
       asserts no DISTINCT emittable colour, closer in lightness, also passes.
       Distinct is the operative word — many float lightnesses quantize to the
       same #rrggbb, and a candidate that renders as the identical colour is not
       a closer answer, it is the same answer with a different intermediate. An
       earlier version of this test compared lightness instead of output and
       reported 38 "failures" in which the two hexes were character-for-
       character equal. */
    const shortfalls: string[] = [];
    for (let h = 0; h < 360; h += 29) {
      for (const min of [3, 4.5, 7]) {
        for (const [dir, against, limit] of [
          ["darken", "#ffffff", 0],
          ["lighten", "#0d0f1a", 1],
        ] as const) {
          const start = oklchToHex({ l: dir === "darken" ? 0.8 : 0.3, c: 0.15, h });
          const targets = [{ against, min }];
          const fit = fitContrast(start, targets, dir);
          if (!fit.ok) continue;

          /* Compared in the RAY's own coordinates, not by re-deriving lightness
             from the quantized answer. `hexToOklch(fit.hex).l` is the lightness
             of the ROUNDED colour, which is not the ray parameter that produced
             it — an earlier version of this test conflated the two and reported
             14 "failures" where the supposedly-closer colour was in fact one
             step FARTHER along the ray. */
          const ray = [...emittableRay(hexToOklch(start), limit)];
          const firstPassing = ray.find((step) => contrastRatio(step.hex, against) >= min);
          const chosenIndex = ray.findIndex((step) => step.hex === fit.hex);

          if (firstPassing?.hex !== fit.hex) {
            shortfalls.push(
              `${dir} h=${h} min=${min}: chose ${fit.hex} (ray #${chosenIndex}) but ` +
                `${firstPassing?.hex ?? "none"} (ray #${ray.indexOf(firstPassing!)}) passes and is nearer`,
            );
          }
        }
      }
    }
    expect(shortfalls).toEqual([]);
  });

  it("enumerates every emittable colour along the ray, skipping none", () => {
    /* The property the whole search rests on. A uniform-lightness walk cannot
       have it: the minimum gap between adjacent distinct colours measures below
       1e-6, so any practical fixed step strides over emittable colours — the
       1024-step version this replaced skipped 148 on a single hue.

       Brute-forces 200k lightness samples per ray and asserts the enumerator
       yields everything they found. A superset is fine and expected (the
       enumerator resolves transitions the sampler is too coarse to see); a
       missing colour is a colour fitContrast could never return. */
    for (const h of [0, 60, 140, 210, 300]) {
      const base = { l: 0.85, c: 0.15, h };
      const enumerated = new Set([...emittableRay(base, 0)].map((step) => step.hex));

      const dense = new Set<string>();
      const N = 200_000;
      for (let i = 0; i <= N; i += 1) {
        dense.add(oklchToHex(clampChroma({ ...base, l: (base.l * (N - i)) / N })));
      }

      const missed = [...dense].filter((hex) => !enumerated.has(hex));
      expect(missed, `hue ${h} — colours the enumerator skipped`).toEqual([]);
      // 3 x 255 quantization boundaries is the hard ceiling for one ray.
      expect(enumerated.size, `hue ${h} — enumerated count`).toBeLessThanOrEqual(766);
    }
  });

  it("terminates on a ray with nowhere to go", () => {
    expect([...emittableRay({ l: 0, c: 0.1, h: 200 }, 0)].map((s) => s.hex)).toEqual(["#000000"]);
    expect([...emittableRay({ l: 1, c: 0.1, h: 200 }, 1)].map((s) => s.hex)).toEqual(["#ffffff"]);
  });

  it("is correct when two targets pull in opposite directions", () => {
    /* The case that breaks bisection. Darkening raises contrast against the
       light surface and LOWERS it against the dark ink, so the passing set is
       not an interval anchored at the search extreme and there is no single
       boundary to bracket. An exhaustive scan does not care. */
    const targets = [
      { against: "#ffffff", min: 4.5 }, // legible as text on the light surface
      { against: "#0d0f1a", min: 1.6 }, // still separable from the dark ink
    ];
    for (let h = 0; h < 360; h += 13) {
      const start = oklchToHex({ l: 0.82, c: 0.14, h });
      const fit = fitContrast(start, targets, "darken");
      if (!fit.ok) continue;
      expect(contrastRatio(fit.hex, "#ffffff"), `h=${h} vs white`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(fit.hex, "#0d0f1a"), `h=${h} vs ink`).toBeGreaterThanOrEqual(1.6);
    }
  });

  it("reports ok:false rather than a wrong answer when the targets conflict outright", () => {
    // Impossible: 7:1 on white AND 7:1 on near-black at the same time.
    const fit = fitContrast("#B3D335", [
      { against: "#ffffff", min: 7 },
      { against: "#0d0f1a", min: 7 },
    ], "darken");
    expect(fit.ok).toBe(false);
    expect(fit.hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("handles an empty target list", () => {
    const fit = fitContrast("#B3D335", [], "darken");
    expect(fit).toEqual({ hex: "#b3d335", ok: true, ratios: [] });
  });

  describe("minChroma", () => {
    /* meridian's seed on its own dark surface: a vivid blue that cannot reach a
       high contrast target without going pastel, which is the entire reason the
       option exists. */
    const SEED = "#0B5FFF";
    const SURFACE = "#0e1522";

    it("is inert when absent — the 2026-08-06 hand-fix is byte-identical", () => {
      const withOpt = fitContrast("#8A9F2A", [{ against: "#ffffff", min: 4.5 }], "darken", {});
      const without = fitContrast("#8A9F2A", [{ against: "#ffffff", min: 4.5 }], "darken");
      expect(withOpt).toEqual(without);
    });

    it("is inert when set below anything the walk would reach", () => {
      const bounded = fitContrast(SEED, [{ against: SURFACE, min: 8 }], "lighten", { minChroma: 0 });
      const plain = fitContrast(SEED, [{ against: SURFACE, min: 8 }], "lighten");
      expect(bounded).toEqual(plain);
    });

    it("truncates the walk and returns the BRIGHTEST colour still inside the budget", () => {
      /* Unbounded, reaching 10.9 costs this hue most of its chroma. Bounded at
         the chroma it has at 8.0, the walk stops partway and reports honestly. */
      const atFloor = fitContrast(SEED, [{ against: SURFACE, min: 8 }], "lighten").hex;
      const budget = hexToOklch(atFloor).c * 0.8;

      const unbounded = fitContrast(SEED, [{ against: SURFACE, min: 10.9 }], "lighten");
      expect(unbounded.ok).toBe(true);
      expect(hexToOklch(unbounded.hex).c).toBeLessThan(budget);

      const bounded = fitContrast(SEED, [{ against: SURFACE, min: 10.9 }], "lighten", {
        minChroma: budget,
      });
      // Missed the target, and says so rather than certifying a value it did not reach.
      expect(bounded.ok).toBe(false);
      expect(hexToOklch(bounded.hex).c).toBeGreaterThanOrEqual(budget - 1e-3);
      // Still climbed well past the floor it started from.
      const climbed = contrastRatio(bounded.hex, SURFACE);
      expect(climbed).toBeGreaterThan(contrastRatio(atFloor, SURFACE));
      expect(climbed).toBeLessThan(10.9);
    });

    it("returns the input untouched when even the first ray step is over budget", () => {
      /* Above the seed's OWN chroma, so nothing on a lightening ray can satisfy
         it. The result is the input, not the ray's extreme — same policy as
         `liftSeedToFloor`'s unreachable-floor bail: a colour nobody chose is
         worse than no change. */
      const bounded = fitContrast(SEED, [{ against: SURFACE, min: 10.9 }], "lighten", {
        minChroma: hexToOklch(SEED).c * 1.05,
      });
      expect(bounded.hex).toBe("#0b5fff");
      expect(bounded.ok).toBe(false);
    });

    it("tolerates one step of ray jitter rather than stopping on it", () => {
      /* `clampChroma` bisects to ~2e-8 and chroma is not strictly monotone near
         the sRGB cusp, so an exact comparison would end the walk on numerical
         noise. Budgeted at exactly the seed's chroma, the walk is allowed the
         first step and no more — CHROMA_EPS working, asserted rather than
         assumed. */
      const bounded = fitContrast(SEED, [{ against: SURFACE, min: 10.9 }], "lighten", {
        minChroma: hexToOklch(SEED).c,
      });
      expect(bounded.ok).toBe(false);
      expect(contrastRatio(bounded.hex, SURFACE)).toBeLessThan(
        contrastRatio(SEED, SURFACE) + 0.15,
      );
    });
  });
});
