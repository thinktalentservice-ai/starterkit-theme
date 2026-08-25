/* Fuzz coverage: "what if a client picked THIS colour", not "what if the
 * preset's own structure were different". Every family's `seed` (and both
 * neutral seeds) are replaced by one random hex per iteration; geometry,
 * slots, duties, tokens, provenance are untouched — that is the whole point
 * of `deriveFamily`'s "our geometry, their colour" model, being exercised
 * against colours no preset author ever picked or eyeballed.
 */
import fc from "fast-check";
import { contrastRatio } from "../color/contrast";
import { PRESETS } from "../presets/index";
import { SOLID_WHITE_FLOOR } from "./ladder";
import { resolveBrand } from "./resolve";
import type { FamilySpec, PresetSpec } from "./spec";

const PRESET_LIST: readonly PresetSpec[] = Object.values(PRESETS).filter(
  (p): p is PresetSpec => p !== undefined,
);

const hexArb = fc
  .tuple(fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }))
  .map(([r, g, b]) => `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`);

const HEX = /^#[0-9a-f]{6}$/i;

/** Same preset, every seed swapped for one client hex. Nothing else moves. */
function withSeed(preset: PresetSpec, seed: string): PresetSpec {
  const families: Record<string, FamilySpec> = {};
  for (const [id, family] of Object.entries(preset.families)) {
    families[id] = { ...family, seed };
  }
  return {
    ...preset,
    families,
    neutral: {
      dark: { ...preset.neutral.dark, seed },
      light: { ...preset.neutral.light, seed },
    },
  };
}

describe("fuzz — resolveBrand survives an arbitrary client seed", () => {
  it("never throws, only ever emits round-trippable sRGB hexes, and every warning is internally consistent", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: PRESET_LIST.length - 1 }), hexArb, (presetIndex, seed) => {
        const base = PRESET_LIST[presetIndex];
        if (base === undefined) throw new Error("empty preset catalogue");
        const preset = withSeed(base, seed);

        const brand = resolveBrand(preset);

        for (const map of [brand.dark, brand.light]) {
          for (const [token, value] of map) {
            if (value.startsWith("#")) {
              expect(value, `${preset.id}/${token} = ${value}`).toMatch(HEX);
            }
          }
        }

        for (const w of brand.warnings) {
          expect(w.ratio, `${preset.id} ${w.token}|${w.scheme} ratio vs min`).toBeLessThan(w.min);
          expect(w.message.length, `${preset.id} ${w.token}|${w.scheme} empty message`).toBeGreaterThan(0);
        }

        /* THE FILL FLOOR HOLDS FOR AN ARBITRARY CLIENT SEED, AND THIS IS THE
           ONLY THING THAT SAYS SO. `sink` returns its INPUT when the target is
           unreachable — deliberately, because painting an action surface black
           is worse than the miss — but nothing reports that: `warnings` only
           carries DECLARED duties and no duty is declared on `--primary-solid`
           against white. So the bailout is a fail-OPEN path, and a fail-open
           path with no assertion over it is indistinguishable from working.
           Found by Codex review, not by the suite, which is exactly the gap.

           Reachability is not the argument for leaving it unasserted. It is
           true — every hue reaches ~21:1 against white on the way to black, so
           4.5 is always attainable — but that is a property of ONE constant,
           and this test is what turns "raise SOLID_WHITE_FLOOR past what a hue
           can give" into a failure rather than a silently unfloored button.

           The ink assertion is the stronger half: SOLID_WHITE_FLOOR sits above
           the white-vs-FILL_INK crossover, so a satisfied floor forces white.
           `#ffffff` for EVERY seed, on every preset, in both schemes. */
        /* Scheme equality is the third leg: both of `fillRef`'s inputs are
           scheme-invariant, so a floored fill that differs between schemes means
           the sink started reading `ctx.ramps[scheme]` — the same silent split
           `seedFillRef`'s own comment warns a `darkFloor` would introduce. */
        expect(
          brand.dark.get("--primary-solid"),
          `${preset.id} seed ${seed}: --primary-solid is not scheme-invariant`,
        ).toBe(brand.light.get("--primary-solid"));

        for (const scheme of ["dark", "light"] as const) {
          const map = scheme === "dark" ? brand.dark : brand.light;
          const fill = map.get("--primary-solid")!;
          expect(
            contrastRatio(fill, "#ffffff"),
            `${preset.id}|${scheme} seed ${seed}: --primary-solid ${fill} missed the fill floor`,
          ).toBeGreaterThanOrEqual(SOLID_WHITE_FLOOR - 1e-9);
          expect(
            map.get("--primary-on-solid"),
            `${preset.id}|${scheme} seed ${seed}: fill ${fill} did not force the white label`,
          ).toBe("#ffffff");
        }
      }),
      { numRuns: 500 },
    );
    /* 60s, raised from the 20s default, and the number is a measurement rather
       than a shrug. `darkFloor` adds one `fitContrast` scan per floored family
       per novel seed, which is ~2ms in production — 0.244ms -> 0.296ms warm for
       the six shipped presets, 2.45ms -> 4.59ms for a seed nobody has resolved
       before. Here it is far worse, and only here: `withSeed` replaces the
       NEUTRAL seeds too, so the "dark" surface is itself a random hex. When it
       lands light, no amount of lightening reaches the floor against it and the
       ray is walked to exhaustion — the worst case, on most iterations. Real
       dark surfaces are near-black and the scan stops early.

       Coverage stays at 500 runs on purpose. Cutting them would have hidden the
       cost instead of paying it, and this test's timeout is the tripwire that
       caught a 72x regression once already — a real one would take this from
       31s to well past a minute regardless of where the bar sits. */
  }, 60_000);
});
