/* CIEDE2000 colour difference.
 *
 * Exists for exactly one reason: the golden test. `resolveBrand(PRESETS.obsidian)`
 * has to reproduce a sheet a person hand-tuned over months, and "reproduce" needs
 * a number. Byte equality is too strict — an 8-bit round-trip through OKLCH can
 * land one unit off on one channel, which is invisible and would make the gate
 * fail for a reason nobody should care about. Euclidean RGB distance is too
 * loose and not perceptual: 8 units of blue and 8 units of green are not the same
 * amount of wrong.
 *
 * dE00 <= 1.0 is the standard "just noticeable difference" threshold, so the gate
 * reads as: no human can see that the engine produced this rather than the
 * original. That is the claim the migration rests on.
 *
 * Implemented from Sharma, Wu & Dalal (2005), whose paper is also the source of
 * the 34-pair test set used to verify it — including the four pairs specifically
 * constructed to break naive hue-angle arithmetic near 0/360.
 */
import { hexToRgb, type Rgb } from "./oklch";

/** CIE Lab, D65 2-degree observer. */
export type Lab = { l: number; a: number; b: number };

/* D65 white point, 2-degree observer. */
const XN = 0.95047;
const YN = 1.0;
const ZN = 1.08883;

const toLinear = (channel: number): number =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

/** sRGB -> CIE XYZ (D65) -> CIE Lab. */
export function rgbToLab({ r, g, b }: Rgb): Lab {
  const lr = toLinear(r / 255);
  const lg = toLinear(g / 255);
  const lb = toLinear(b / 255);

  const x = (0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb) / XN;
  const y = (0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb) / YN;
  const z = (0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb) / ZN;

  const f = (t: number): number => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export const hexToLab = (hex: string): Lab => rgbToLab(hexToRgb(hex));

const DEG = Math.PI / 180;

/**
 * CIEDE2000 difference between two Lab colours.
 *
 * The hue terms are where every naive implementation goes wrong: h' is an angle,
 * so its mean and difference both need the 180-degree wrap handled explicitly,
 * and the `C1'*C2' === 0` guard matters because a neutral has no hue to compare
 * and the unguarded formula returns NaN rather than 0.
 */
export function deltaE00(a: Lab, b: Lab): number {
  const kL = 1;
  const kC = 1;
  const kH = 1;

  const c1 = Math.hypot(a.a, a.b);
  const c2 = Math.hypot(b.a, b.b);
  const cBar = (c1 + c2) / 2;

  const cBar7 = cBar ** 7;
  const g = 0.5 * (1 - Math.sqrt(cBar7 / (cBar7 + 25 ** 7)));

  const a1p = (1 + g) * a.a;
  const a2p = (1 + g) * b.a;
  const c1p = Math.hypot(a1p, a.b);
  const c2p = Math.hypot(a2p, b.b);

  // atan2(0, 0) is 0 by definition here — a neutral gets hue 0, not NaN.
  const hp = (ax: number, bx: number): number => {
    if (ax === 0 && bx === 0) return 0;
    const deg = Math.atan2(bx, ax) / DEG;
    return deg >= 0 ? deg : deg + 360;
  };
  const h1p = hp(a1p, a.b);
  const h2p = hp(a2p, b.b);

  const dLp = b.l - a.l;
  const dCp = c2p - c1p;

  let dhp: number;
  if (c1p * c2p === 0) dhp = 0;
  else if (Math.abs(h2p - h1p) <= 180) dhp = h2p - h1p;
  else if (h2p - h1p > 180) dhp = h2p - h1p - 360;
  else dhp = h2p - h1p + 360;

  const dHp = 2 * Math.sqrt(c1p * c2p) * Math.sin((dhp / 2) * DEG);

  const lBarP = (a.l + b.l) / 2;
  const cBarP = (c1p + c2p) / 2;

  let hBarP: number;
  if (c1p * c2p === 0) hBarP = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hBarP = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) hBarP = (h1p + h2p + 360) / 2;
  else hBarP = (h1p + h2p - 360) / 2;

  const t =
    1 -
    0.17 * Math.cos((hBarP - 30) * DEG) +
    0.24 * Math.cos(2 * hBarP * DEG) +
    0.32 * Math.cos((3 * hBarP + 6) * DEG) -
    0.2 * Math.cos((4 * hBarP - 63) * DEG);

  const dTheta = 30 * Math.exp(-(((hBarP - 275) / 25) ** 2));
  const cBarP7 = cBarP ** 7;
  const rC = 2 * Math.sqrt(cBarP7 / (cBarP7 + 25 ** 7));
  const rT = -rC * Math.sin(2 * dTheta * DEG);

  const lBarP50 = (lBarP - 50) ** 2;
  const sL = 1 + (0.015 * lBarP50) / Math.sqrt(20 + lBarP50);
  const sC = 1 + 0.045 * cBarP;
  const sH = 1 + 0.015 * cBarP * t;

  const termL = dLp / (kL * sL);
  const termC = dCp / (kC * sC);
  const termH = dHp / (kH * sH);

  return Math.sqrt(termL ** 2 + termC ** 2 + termH ** 2 + rT * termC * termH);
}

/** dE00 between two `#rrggbb` strings — the form the golden test compares in. */
export const deltaE00Hex = (a: string, b: string): number => deltaE00(hexToLab(a), hexToLab(b));
