/* sRGB <-> OKLab <-> OKLCH, vendored. Zero dependencies by design: this package
 * is consumed by a build script, a route handler and possibly the edge, and a
 * colour library is a supply-chain surface for ~120 lines of arithmetic.
 *
 * WHY OKLCH AND NOT HSL. The engine's core operation is "darken this brand hue
 * until it clears 4.5:1 on the client's surface". HSL lightness is not
 * perceptual — two colours at the same HSL L can differ by a factor of three in
 * relative luminance — so the predicate "contrast >= target" is not monotone in
 * HSL L and bisection on it is unsound. OKLCH L is monotone with luminance at
 * fixed hue, which is exactly the property fitContrast() needs. This is a
 * correctness requirement, not a taste one.
 *
 * Matrices and transfer functions are Björn Ottosson's published sRGB<->OKLab
 * pair. The sRGB transfer function is the real piecewise one, NOT a plain 2.2
 * power — the cheap approximation is wrong by enough near black to move a
 * contrast ratio across a WCAG threshold, which is the one thing that must not
 * happen here.
 */

/** 0..255, integral after any conversion back from float. */
export type Rgb = { r: number; g: number; b: number };

/** l 0..1 (perceptual lightness), c 0..~0.4 (chroma), h degrees 0..360. */
export type Oklch = { l: number; c: number; h: number };

/** OKLab. Intermediate; exported because gamut mapping works in it. */
export type Oklab = { l: number; a: number; b: number };

const HEX6 = /^#[0-9a-f]{6}$/i;
const HEX3 = /^#[0-9a-f]{3}$/i;

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** sRGB 0..1 -> linear-light 0..1. */
function toLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** linear-light 0..1 -> sRGB 0..1. */
function toGamma(channel: number): number {
  return channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;
}

/**
 * Parse `#rgb` or `#rrggbb`, case-insensitive.
 *
 * Throws rather than coercing. This function is on the path from a client's
 * brand document to a stylesheet: a silently-coerced colour ships a wrong brand
 * with no error anywhere, which is precisely the failure mode this package
 * exists to remove.
 */
export function hexToRgb(hex: string): Rgb {
  const value = hex.trim();
  if (HEX3.test(value)) {
    const r = value[1] as string;
    const g = value[2] as string;
    const b = value[3] as string;
    return {
      r: Number.parseInt(r + r, 16),
      g: Number.parseInt(g + g, 16),
      b: Number.parseInt(b + b, 16),
    };
  }
  if (!HEX6.test(value)) {
    throw new Error(`not a hex colour: ${JSON.stringify(hex)} (expected #rgb or #rrggbb)`);
  }
  return {
    r: Number.parseInt(value.slice(1, 3), 16),
    g: Number.parseInt(value.slice(3, 5), 16),
    b: Number.parseInt(value.slice(5, 7), 16),
  };
}

/** Lowercase `#rrggbb`. Components are rounded and clamped, so an out-of-gamut
 *  conversion still yields a legal colour rather than `#NaNNaNNaN`. */
export function rgbToHex({ r, g, b }: Rgb): string {
  const byte = (x: number): string =>
    Math.min(255, Math.max(0, Math.round(x))).toString(16).padStart(2, "0");
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

/** Expand `#rgb` to `#rrggbb` and lowercase. Round-trip comparisons need a
 *  canonical form on both sides. */
export function normalizeHex(hex: string): string {
  return rgbToHex(hexToRgb(hex));
}

export function rgbToOklab({ r, g, b }: Rgb): Oklab {
  const lr = toLinear(r / 255);
  const lg = toLinear(g / 255);
  const lb = toLinear(b / 255);

  const long = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const medium = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const short = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  // Math.cbrt is signed, which matters: the LMS values can go slightly negative
  // for near-gamut-edge colours and `** (1/3)` would return NaN there.
  const l_ = Math.cbrt(long);
  const m_ = Math.cbrt(medium);
  const s_ = Math.cbrt(short);

  return {
    l: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

/** Unclamped linear sRGB. Components outside [0,1] mean out of gamut — the
 *  gamut module reads exactly that, so this must NOT clamp. */
export function oklabToLinearRgb({ l, a, b }: Oklab): { r: number; g: number; b: number } {
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const long = l_ * l_ * l_;
  const medium = m_ * m_ * m_;
  const short = s_ * s_ * s_;

  return {
    r: 4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
    g: -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
    b: -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short,
  };
}

export function oklabToRgb(lab: Oklab): Rgb {
  const { r, g, b } = oklabToLinearRgb(lab);
  return {
    r: clamp01(toGamma(r)) * 255,
    g: clamp01(toGamma(g)) * 255,
    b: clamp01(toGamma(b)) * 255,
  };
}

/* Below this chroma a colour is a grey and its hue is float noise.
 *
 * Measured, not guessed: across all 256 pure greys #000000..#ffffff the matrix
 * round-off leaves at most 3.73e-8 of residual chroma — enough for atan2 to
 * report a confident, meaningless hue (#808080 comes out at 89.9deg). A real
 * brand hue carries ~0.178, and 8-bit quantization cannot resolve a chroma
 * difference below ~1e-3. So 1e-6 sits 27x above the noise floor and 1000x
 * below anything renderable: a genuine gap, not a threshold tuned until the
 * test passed.
 *
 * It matters because the neutral ramps ARE greys. A surface that reports hue
 * 89.9deg instead of 0 makes "hold the hue, move the lightness" rotate a
 * client's neutral toward green. */
const GREY_CHROMA = 1e-6;

export function oklabToOklch({ l, a, b }: Oklab): Oklch {
  const c = Math.hypot(a, b);
  const h = c < GREY_CHROMA ? 0 : ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return { l, c, h };
}

export function oklchToOklab({ l, c, h }: Oklch): Oklab {
  const rad = (h * Math.PI) / 180;
  return { l, a: c * Math.cos(rad), b: c * Math.sin(rad) };
}

export const rgbToOklch = (rgb: Rgb): Oklch => oklabToOklch(rgbToOklab(rgb));
export const oklchToRgb = (oklch: Oklch): Rgb => oklabToRgb(oklchToOklab(oklch));
export const hexToOklch = (hex: string): Oklch => rgbToOklch(hexToRgb(hex));
export const oklchToHex = (oklch: Oklch): string => rgbToHex(oklchToRgb(oklch));

/**
 * `"R G B"` — the space-separated triple the token sheet publishes for every
 * `--x-channel`.
 *
 * 32 call sites across the button and card packages do
 * `rgb(var(--x-channel) / <alpha>)`. A brand that writes a hex into a channel
 * token invalidates all of them at computed-value time, with no console error
 * and no visual clue beyond a missing translucent layer. Every channel token in
 * a generated sheet goes through this function, so the format cannot drift.
 */
export function rgbToTriple({ r, g, b }: Rgb): string {
  return `${Math.round(r)} ${Math.round(g)} ${Math.round(b)}`;
}

export const hexToTriple = (hex: string): string => rgbToTriple(hexToRgb(hex));
