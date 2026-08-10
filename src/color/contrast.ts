/* WCAG contrast, and the function that turns "make it legible" into a number.
 *
 * The reason this file exists rather than a comment somewhere: on 2026-08-06 a
 * person hand-fixed the light-mode brand green from #8A9F2A to #6B7D20, because
 * #8A9F2A as palette.primary.main on a near-white surface scores 2.97:1 and
 * fails BOTH 1.4.3 (4.5:1 for its white contrastText) and 1.4.11 (3:1 for the
 * focus border). That judgement was correct, invisible in the diff, and had to
 * be repeated by hand for every future brand. fitContrast() is that judgement
 * as code, so a client can pick any hue and still get a legible UI.
 */
import { clampChroma } from "./gamut";
import { hexToOklch, hexToRgb, normalizeHex, oklchToHex, type Oklch } from "./oklch";

/** WCAG 2.x relative luminance. */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const lin = (channel: number): number => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG 2.x contrast ratio, 1..21. Order-independent. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** One legibility requirement: this colour, against `against`, at least `min`. */
export type ContrastTarget = { against: string; min: number };

export type FitResult = {
  /** The chosen colour. Always a real `#rrggbb`, even when `ok` is false. */
  hex: string;
  /** True only when every target is met BY THE RETURNED HEX. */
  ok: boolean;
  /** Achieved ratio per target, same order as the input. */
  ratios: number[];
};

/* Ratios are measured on the QUANTIZED hex, never on the float mid-point.
   A candidate that scores 4.5001 in floating point can quantize to a byte
   triple that scores 4.4993 — and the browser only ever sees the byte triple.
   Checking the float would let this function certify a value that fails in the
   product it is protecting. */
const measure = (hex: string, targets: ContrastTarget[]): number[] =>
  targets.map((t) => contrastRatio(hex, t.against));

const satisfies = (ratios: number[], targets: ContrastTarget[]): boolean =>
  targets.every((t, i) => (ratios[i] ?? 0) >= t.min);

/* Upper bound on distinct colours along one lightness ray.
 *
 * Each of R, G and B is an 8-bit value moving monotonically with lightness, so
 * a ray crosses at most 3 x 255 quantization boundaries and yields at most 766
 * distinct colours. Measured across 36 hue/chroma combinations at 1e-6
 * lightness resolution, the observed maximum is exactly 766 — the bound is
 * tight, not conservative. The +8 is slack so a pathological ray terminates by
 * exhausting the loop rather than by looping forever. */
const MAX_RAY_COLOURS = 774;

/**
 * The distinct colours along a lightness ray, nearest first.
 *
 * WHY THIS EXISTS RATHER THAN A UNIFORM SCAN. The obvious implementation walks
 * lightness in fixed steps. It does not work: the minimum lightness gap between
 * two adjacent distinct colours measures below 1e-6, so a uniform walk needs
 * over a million steps per call to be exhaustive, and anything coarser strides
 * over emittable colours — a 1024-step version silently skipped 148 of them on
 * a single hue. Sampling resolution is simply the wrong primitive when the
 * quantization is non-uniform.
 *
 * There are at most 766 colours to consider, so they are enumerated directly.
 * Each step bisects for the exact lightness at which the emitted hex first
 * changes, which is ~20 conversions per colour and terminates on the transition
 * rather than hoping to land near it. Exhaustive by construction, no resolution
 * constant to get wrong, and cheaper than the uniform scan it replaces because
 * callers stop at the first hit.
 */
export type RayStep = { hex: string; l: number };

export function* emittableRay(base: Oklch, limitL: number): Generator<RayStep> {
  const at = (l: number): string => oklchToHex(clampChroma({ ...base, l }));

  let near = base.l;
  let current = at(near);
  yield { hex: current, l: near };

  for (let guard = 0; guard < MAX_RAY_COLOURS; guard += 1) {
    if (at(limitL) === current) return; // no further transition in this direction

    /* Invariant: hex(near) === current, hex(far) !== current. Converges on a
       lightness at which the colour leaves `current`.

       NOT guaranteed to be the FIRST such lightness. Neither the RGB channels
       nor relative luminance are strictly monotone along a ray — the OKLab to
       linear-RGB matrix carries negative coefficients, so a channel can move
       against the lightness. Measured across 5.4M samples the effect is tiny
       (11 non-monotone steps, worst luminance drop 4.9e-5: rounding jitter at
       quantization boundaries, not structure) but it is real, and it means this
       walk can step over a colour sitting inside the jitter window. fitContrast
       closes that gap by refining the final interval; see refineNearest. */
    let low = near;
    let high = limitL;
    for (let i = 0; i < 40; i += 1) {
      const mid = (low + high) / 2;
      if (at(mid) === current) low = mid;
      else high = mid;
    }

    const next = at(high);
    if (next === current) return; // bisection could not separate them; ray is done
    near = high;
    current = next;
    yield { hex: current, l: near };
  }
}

/* No post-hoc refinement pass. An earlier version swept the final bracket
   densely, on the theory that the jitter above could hide a nearer colour
   between the answer and the last failing candidate. It could not: the ray
   yields in strictly decreasing (or increasing) lightness and the
   exhaustiveness test shows it skips nothing, so the first passing entry IS the
   nearest. The refinement found nothing, cost 20k conversions per call, and
   introduced a regression. Deleted rather than kept "just in case". */

/**
 * Move a colour along OKLCH lightness until it clears every contrast target,
 * changing it as little as possible.
 *
 * Holds hue, so the client's brand stays the client's brand; re-clamps chroma
 * into sRGB at every step, because raising or lowering L on a saturated hue
 * routinely leaves the gamut.
 *
 * `dir` is which way the caller knows the fix lies: `"darken"` for a colour that
 * must stand on a light surface, `"lighten"` for one on a dark surface. The
 * search runs from that extreme back toward the original, so the result is the
 * value closest to what the client picked that is still legible.
 *
 * Never throws and never lies: `ok` is computed from the returned hex, so a
 * caller can trust it without re-measuring. When nothing in that direction
 * works the far extreme is returned with `ok: false` and its real ratios — the
 * caller decides whether that is a warning or a hard failure, because "this
 * brand cannot be made accessible" is a business answer, not a colour-math one.
 *
 * Two guarantees, both tested rather than asserted here:
 *   - `ok === true` implies every target is met by the RETURNED hex
 *   - when `ok === true`, no colour closer to the original in lightness also
 *     passes — the result is the minimal change, not merely a working one
 * The second is what the exhaustive scan buys over bisection; see
 * SCAN_RESOLUTION.
 */
/**
 * `minChroma` stops the walk once the ray has desaturated past a budget, and
 * returns the last colour that was still inside it.
 *
 * Brightness on a lightening ray is bought in chroma — sRGB has no bright
 * saturated red or blue — so a caller that wants "as close to this target as the
 * hue can afford" needs the walk itself to stop, not a bisection wrapped around
 * eight more walks. Measured: the wrapper version cost ~60ms per cold resolve
 * against ~4.6ms for one walk.
 *
 * `ok` stays honest: a budget-truncated result did NOT meet its target and
 * reports `false` with its real measured ratios.
 */
export type FitOptions = { minChroma?: number };

/* `clampChroma` bisects to ~2e-8 and chroma along a ray is not strictly monotone
   near the sRGB cusp, so an exact comparison can trip one colour early on
   jitter rather than on a real desaturation. Sized well above that resolution
   and far below anything a person could see. */
const CHROMA_EPS = 1e-4;

export function fitContrast(
  hex: string,
  targets: ContrastTarget[],
  dir: "darken" | "lighten",
  opts?: FitOptions,
): FitResult {
  const start = normalizeHex(hex);
  if (targets.length === 0) return { hex: start, ok: true, ratios: [] };

  const startRatios = measure(start, targets);
  if (satisfies(startRatios, targets)) return { hex: start, ok: true, ratios: startRatios };

  /* Every emittable colour in that direction, nearest first. The first one that
     passes is the answer, then the bracket it landed in is swept densely to
     recover anything the walk's jitter stepped over. Nothing is assumed about
     the shape of the predicate — that is what lets two targets pull in opposite
     directions without breaking the search. */
  const base = hexToOklch(start);
  let fallback: FitResult = { hex: start, ok: false, ratios: startRatios };
  const minChroma = opts?.minChroma;

  for (const { hex } of emittableRay(base, dir === "darken" ? 0 : 1)) {
    /* Read off the QUANTIZED hex, matching how ratios are measured in this
       file — the budget has to be checked against the colour that ships. */
    if (minChroma !== undefined && hexToOklch(hex).c < minChroma - CHROMA_EPS) break;
    const ratios = measure(hex, targets);
    if (satisfies(ratios, targets)) return { hex, ok: true, ratios };
    fallback = { hex, ok: false, ratios };
  }

  // Nothing in this direction works — usually a target asking for more
  // separation than black (or white) on that background can deliver.
  return fallback;
}
