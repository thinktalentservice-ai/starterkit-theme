import { clampChroma, inSrgbGamut } from "./gamut";
import { hexToOklch, oklchToHex } from "./oklch";

describe("inSrgbGamut", () => {
  it("accepts every colour that came from a real hex", () => {
    for (const hex of ["#ffffff", "#000000", "#B3D335", "#6B7D20", "#7c3aed", "#e11d48"]) {
      expect(inSrgbGamut(hexToOklch(hex)), hex).toBe(true);
    }
  });

  it("rejects a chroma sRGB cannot display", () => {
    expect(inSrgbGamut({ l: 0.7, c: 0.4, h: 140 })).toBe(false);
  });
});

describe("clampChroma", () => {
  it("leaves an in-gamut colour untouched", () => {
    const inside = hexToOklch("#6B7D20");
    expect(clampChroma(inside)).toEqual(inside);
  });

  it("brings an impossible colour into gamut", () => {
    const outside = { l: 0.7, c: 0.4, h: 140 };
    const fixed = clampChroma(outside);
    expect(inSrgbGamut(fixed)).toBe(true);
    expect(fixed.c).toBeLessThan(outside.c);
  });

  it("holds lightness and hue — only saturation is negotiable", () => {
    // Clipping RGB instead would shift hue, which is how a blue brand ramp
    // grows a purple step.
    const outside = { l: 0.55, c: 0.38, h: 264 };
    const fixed = clampChroma(outside);
    expect(fixed.l).toBe(outside.l);
    expect(fixed.h).toBe(outside.h);
  });

  it("returns a value that actually renders", () => {
    const fixed = clampChroma({ l: 0.85, c: 0.35, h: 30 });
    expect(oklchToHex(fixed)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("survives a degenerate input without looping forever", () => {
    expect(inSrgbGamut(clampChroma({ l: 0, c: 0.3, h: 200 }))).toBe(true);
    expect(inSrgbGamut(clampChroma({ l: 1, c: 0.3, h: 200 }))).toBe(true);
  });
});
