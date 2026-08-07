/* sRGB gamut mapping in OKLCH.
 *
 * Stepping a ramp in OKLCH routinely lands outside sRGB — raise L on a
 * saturated hue and the required chroma stops existing. The three options are:
 * clip the RGB components (shifts hue, which is how a "blue" brand ramp
 * develops a purple step), scale L (changes the thing the ramp is varying), or
 * reduce chroma at fixed L and H. The third is the standard choice and the only
 * one that preserves both the hue the client picked and the lightness the ramp
 * asked for. Saturation is the negotiable axis; hue is not.
 */
import { oklabToLinearRgb, oklchToOklab, type Oklch } from "./oklch";

/* Slightly loose, because a colour that is 1e-12 outside gamut quantizes to the
 * same byte as one exactly on it, and bisecting toward it would burn iterations
 * to no visible effect. */
const EPSILON = 1e-6;

/** True when the unclamped linear conversion lands inside [0,1] on all three
 *  channels — i.e. sRGB can actually display this colour. */
export function inSrgbGamut(oklch: Oklch): boolean {
  const { r, g, b } = oklabToLinearRgb(oklchToOklab(oklch));
  const ok = (x: number): boolean => x >= -EPSILON && x <= 1 + EPSILON;
  return ok(r) && ok(g) && ok(b);
}

/**
 * Reduce chroma until the colour is displayable, holding L and H.
 *
 * Bisection is valid here because in-gamut-ness at fixed (L, H) is monotone in
 * chroma: c = 0 is always in gamut (it is a grey), and the gamut boundary along
 * a chroma ray is crossed exactly once. Returns the input untouched when it
 * already fits, so this is safe to call unconditionally.
 *
 * 24 iterations resolves chroma to ~2e-8, far finer than the 8-bit quantization
 * downstream, so the result is exact for every colour we can actually emit.
 */
export function clampChroma(oklch: Oklch): Oklch {
  if (inSrgbGamut(oklch)) return oklch;

  let low = 0; // in gamut by construction
  let high = oklch.c; // out of gamut, checked above

  for (let i = 0; i < 24; i += 1) {
    const mid = (low + high) / 2;
    if (inSrgbGamut({ ...oklch, c: mid })) low = mid;
    else high = mid;
  }

  // `low`, never `high` — high is the last value known NOT to fit, and
  // returning it would hand back the out-of-gamut colour this exists to avoid.
  return { ...oklch, c: low };
}
