/* Ramp construction — turning one hex into a family.
 *
 * This is `deriveFamily` from the plan, and it is deliberately small. It is not
 * a design-system generator: presets stay hand-authored and reviewed. Its only
 * job is that a client who moves ONE colour never gets a half-branded UI, which
 * is the failure this whole package exists to prevent.
 */
import { clampChroma } from "../color/gamut";
import { hexToOklch, normalizeHex, oklchToHex } from "../color/oklch";
import { DEFAULT_LIGHT_SHIFT, type FamilyGeometry, type FamilySpec, type RampStep } from "./spec";

/**
 * Wrap a hue difference into (-180, 180].
 *
 * `+540` rather than `+360`: it re-centres the modulo on 180 so the subtraction
 * lands in the signed range in one step, and it survives inputs below -360.
 */
export function wrapHue(degrees: number): number {
  const d = ((degrees % 360) + 540) % 360 - 180;
  // d === -180 only when the inputs are exactly antipodal; either sign is
  // correct there, and +180 keeps the range half-open as documented.
  return d === -180 ? 180 : d;
}

/** Signed hue delta from `from` to `to`, taking the short way round. */
export const hueDelta = (from: number, to: number): number => wrapHue(to - from);

/**
 * Measure the geometry of an existing, hand-authored ramp.
 *
 * Used by the preset geometry generator, not at runtime. Kept beside `buildRamp`
 * on purpose: these two are inverses, and the golden test asserts exactly that —
 * `buildRamp(seed, measureGeometry(hexes))` must return `hexes` byte for byte.
 * Split them across files and the pair silently drifts.
 */
export function measureGeometry(hexes: readonly string[], seedIndex: number): FamilyGeometry {
  const seedHex = hexes[seedIndex];
  if (seedHex === undefined) throw new Error(`seedIndex ${seedIndex} outside ramp of ${hexes.length}`);
  const seed = hexToOklch(seedHex);
  if (seed.c === 0) throw new Error(`ramp seed ${seedHex} is a pure grey — chroma ratios are undefined`);

  return {
    seedIndex,
    steps: hexes.map((hex) => {
      const o = hexToOklch(hex);
      return { dL: o.l - seed.l, cScale: o.c / seed.c, dH: hueDelta(seed.h, o.h) };
    }),
  };
}

/**
 * Apply a ramp geometry to a seed.
 *
 * Chroma is re-clamped into sRGB at every step: raising or lowering L on a
 * saturated hue routinely leaves the gamut, and clipping RGB there is what turns
 * a blue ramp purple at its light end. `clampChroma` holds L and H and gives up
 * saturation instead, which is the axis a client will not notice losing.
 */
export function buildRamp(seedHex: string, geometry: FamilyGeometry): string[] {
  const seed = hexToOklch(normalizeHex(seedHex));
  return geometry.steps.map((step) =>
    oklchToHex(
      clampChroma({
        l: seed.l + step.dL,
        c: Math.max(0, seed.c * step.cScale),
        h: ((seed.h + step.dH) % 360 + 360) % 360,
      }),
    ),
  );
}

/** Which ramp index a slot reads, per scheme. */
export function slotIndex(family: FamilySpec, token: string, scheme: "dark" | "light"): number {
  const dark = family.slots[token];
  if (dark === undefined) throw new Error(`unknown slot ${token}`);
  if (scheme === "dark") return dark;
  const shift = family.lightShift?.[token] ?? DEFAULT_LIGHT_SHIFT;
  return dark + shift;
}

/**
 * Resolve one ramp index, clamped to the ends.
 *
 * Clamping rather than throwing: a light window that runs off the dark end of a
 * short ramp should render the darkest colour the family has, not crash a page.
 * The contrast gate is what reports whether that value is good enough — a hard
 * failure here would turn a legibility warning into a 500.
 */
export function rampAt(ramp: readonly string[], index: number): string {
  const i = Math.min(ramp.length - 1, Math.max(0, index));
  const hex = ramp[i];
  if (hex === undefined) throw new Error("empty ramp");
  return hex;
}

/**
 * Build a complete family from a client's single hex.
 *
 * `geometry` is the role's own shape — a client replacing `primary` inherits
 * obsidian's mint geometry, one replacing `secondary` inherits electric's. That
 * is the sellable part: the ramp shape is design-system IP, the hue is theirs.
 */
export function deriveFamily(
  seed: string,
  template: Omit<FamilySpec, "seed">,
): FamilySpec {
  return { ...template, seed: normalizeHex(seed) };
}

export type { RampStep };
