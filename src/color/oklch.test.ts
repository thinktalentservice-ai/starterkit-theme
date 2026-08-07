import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  hexToOklch,
  hexToRgb,
  hexToTriple,
  normalizeHex,
  oklchToHex,
  rgbToHex,
  rgbToOklch,
  oklchToRgb,
} from "./oklch";

describe("hex parsing", () => {
  it("reads #rrggbb and #rgb, case-insensitively", () => {
    expect(hexToRgb("#B3D335")).toEqual({ r: 179, g: 211, b: 53 });
    expect(hexToRgb("#b3d335")).toEqual({ r: 179, g: 211, b: 53 });
    expect(hexToRgb("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb("#0a0")).toEqual({ r: 0, g: 170, b: 0 });
  });

  it("throws on anything else rather than coercing", () => {
    // A silently-coerced colour ships a wrong brand with no error anywhere.
    for (const bad of ["", "#", "B3D335", "#12", "#12345", "#gggggg", "rgb(1,2,3)", "#1234567"]) {
      expect(() => hexToRgb(bad), bad).toThrow(/not a hex colour/);
    }
  });

  it("normalizes to lowercase 6-digit", () => {
    expect(normalizeHex("#FFF")).toBe("#ffffff");
    expect(normalizeHex("#B3D335")).toBe("#b3d335");
  });

  it("clamps and rounds on the way back out", () => {
    expect(rgbToHex({ r: -20, g: 300, b: 127.6 })).toBe("#00ff80");
  });
});

describe("channel triples", () => {
  // 32 call sites across the button and card packages do
  // `rgb(var(--x-channel) / a)`. Space-separated, no commas, no hex.
  it("emits space-separated R G B", () => {
    expect(hexToTriple("#B3D335")).toBe("179 211 53");
    expect(hexToTriple("#6B7D20")).toBe("107 125 32");
    expect(hexToTriple("#56631A")).toBe("86 99 26");
    expect(hexToTriple("#000000")).toBe("0 0 0");
  });

  it("matches the triples the shipped sheet publishes", () => {
    // Straight from src/tokens/__fixtures__ — --mint / --mint-channel and
    // --mint-dark / --mint-dark-channel in the light scheme.
    expect(hexToTriple("#6B7D20")).toBe("107 125 32");
    expect(hexToTriple("#56631A")).toBe("86 99 26");
  });
});

describe("OKLCH reference values", () => {
  // Björn Ottosson's published sRGB primaries. If the implementation disagrees
  // by more than this tolerance the implementation is wrong — the table is the
  // external anchor and does not get adjusted to make a test pass.
  const cases: Array<[string, number, number, number | null]> = [
    ["#ffffff", 1.0, 0, null],
    ["#000000", 0.0, 0, null],
    ["#ff0000", 0.628, 0.2577, 29.23],
    ["#00ff00", 0.8664, 0.2948, 142.5],
    ["#0000ff", 0.452, 0.3132, 264.05],
  ];

  it.each(cases)("%s", (hex, l, c, h) => {
    const got = hexToOklch(hex);
    expect(got.l).toBeCloseTo(l, 2);
    expect(got.c).toBeCloseTo(c, 3);
    if (h !== null) expect(got.h).toBeCloseTo(h, 1);
  });

  it("reports hue 0 for every pure grey instead of an atan2 artefact", () => {
    /* Matrix round-off leaves greys with ~1e-8 of chroma, which atan2 turns
       into a confident nonsense hue (#808080 lands at 89.9deg). The neutral
       surface ramps are greys, so a nonzero hue there would make "hold the hue,
       move the lightness" rotate a client's neutral toward green. */
    const rotated = [];
    for (let v = 0; v <= 255; v += 1) {
      const hex = `#${v.toString(16).padStart(2, "0").repeat(3)}`;
      if (hexToOklch(hex).h !== 0) rotated.push(hex);
    }
    expect(rotated).toEqual([]);
  });
});

describe("round-trip over the real token sheet", () => {
  /* The primary correctness test, and self-verifying: it needs no expected
     values from anyone. Every colour the shipped sheet actually contains must
     survive hex -> OKLCH -> hex unchanged. A matrix typo or a wrong transfer
     function moves at least one byte on at least one of ~150 real colours. */
  const css = readFileSync(
    fileURLToPath(new URL("../tokens/__fixtures__/obsidian-2026-08-06.css", import.meta.url)),
    "utf8",
  );
  const hexes = [
    ...new Set(
      (css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [])
        .filter((h) => h.length === 4 || h.length === 7)
        .map((h) => normalizeHex(h)),
    ),
  ];

  it("found a realistic number of colours to test", () => {
    // Guards against a green run that asserted nothing because the regex broke.
    expect(hexes.length).toBeGreaterThan(80);
  });

  it("survives hex -> OKLCH -> hex exactly", () => {
    const broken = hexes.filter((hex) => oklchToHex(hexToOklch(hex)) !== hex);
    expect(broken).toEqual([]);
  });

  it("survives hex -> RGB -> OKLCH -> RGB -> hex exactly", () => {
    const broken = hexes.filter((hex) => rgbToHex(oklchToRgb(rgbToOklch(hexToRgb(hex)))) !== hex);
    expect(broken).toEqual([]);
  });
});
