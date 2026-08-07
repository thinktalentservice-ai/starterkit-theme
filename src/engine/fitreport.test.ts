/* TEMPORARY measurement harness — deleted once the ramp geometry is fitted. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { contrastRatio, fitContrast } from "../color/contrast";
import { deltaE00Hex } from "../color/deltaE";
import { hexToOklch, normalizeHex, oklchToHex } from "../color/oklch";
import { clampChroma } from "../color/gamut";

const css = readFileSync(
  fileURLToPath(new URL("../tokens/__fixtures__/obsidian-2026-08-06.css", import.meta.url)),
  "utf8",
);

function ruleBody(source: string, selector: string): string {
  const at = source.indexOf(selector);
  let i = source.indexOf("{", at);
  let depth = 0;
  const start = i + 1;
  for (; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i);
    }
  }
  throw new Error("unbalanced");
}
function customProps(body: string): Map<string, string> {
  const out = new Map<string, string>();
  let i = 0;
  while (i < body.length) {
    const at = body.indexOf("--", i);
    if (at < 0) break;
    let p = at - 1;
    while (p >= 0 && /\s/.test(body[p]!)) p -= 1;
    if (p >= 0 && ![";", "{", "*", "/"].includes(body[p]!)) {
      i = at + 2;
      continue;
    }
    const colon = body.indexOf(":", at);
    if (colon < 0) break;
    const name = body.slice(at, colon).trim();
    if (!/^--[a-z0-9-]+$/i.test(name)) {
      i = at + 2;
      continue;
    }
    let depth = 0;
    let j = colon + 1;
    for (; j < body.length; j += 1) {
      const ch = body[j]!;
      if (ch === "(") depth += 1;
      else if (ch === ")") depth -= 1;
      else if (ch === ";" && depth === 0) break;
    }
    out.set(name, body.slice(colon + 1, j).trim());
    i = j + 1;
  }
  return out;
}

const root = customProps(ruleBody(css, ":root"));
const light = customProps(ruleBody(css, '[data-mui-color-scheme="light"]'));
const v = (map: Map<string, string>, n: string): string => map.get(n) ?? root.get(n)!;

describe("MEASURE", () => {
  it("fitContrast vs the hand-fix", () => {
    const fit = fitContrast("#8A9F2A", [{ against: "#ffffff", min: 4.5 }], "darken");
    console.log(
      `fitContrast(#8A9F2A, 4.5 on #fff) = ${fit.hex} (${fit.ratios[0]!.toFixed(3)}:1)  ` +
        `dE00 vs #6B7D20 = ${deltaE00Hex(fit.hex, "#6B7D20").toFixed(3)}`,
    );
    const fitBg = fitContrast("#8A9F2A", [{ against: "#f6f7fb", min: 4.5 }], "darken");
    console.log(`  ... vs --background #f6f7fb = ${fitBg.hex} (${fitBg.ratios[0]!.toFixed(3)})`);
    console.log(`dE00(#8A9F2A, #6B7D20) = ${deltaE00Hex("#8A9F2A", "#6B7D20").toFixed(3)}`);
    console.log(`dE00(#8A9F2A, #56631A) = ${deltaE00Hex("#8A9F2A", "#56631A").toFixed(3)}`);
  });

  it("contrast duties of every light main on white", () => {
    for (const n of ["--mint", "--electric", "--amber-brand", "--rose", "--cobalt", "--sky", "--cyan",
      "--mint-dark", "--amber-deep", "--rose-deep", "--cobalt-deep", "--electric-deep"]) {
      const hex = v(light, n);
      console.log(`  light ${n.padEnd(16)} ${hex.padEnd(9)} on #fff = ${contrastRatio(hex, "#ffffff").toFixed(2)}  on #f6f7fb = ${contrastRatio(hex, "#f6f7fb").toFixed(2)}`);
    }
  });

  it("shift-by-one hypothesis: light slot === dark slot one step deeper", () => {
    const pairs: Array<[string, string, string]> = [
      ["electric-light", "--electric-light", "--electric-text"],
      ["electric-text", "--electric-text", "--electric"],
      ["electric-main", "--electric", "--electric-deep?"],
      ["mint-soft", "--mint-soft", "--mint-text"],
      ["mint-text", "--mint-text", "--mint"],
      ["amber-soft", "--amber-soft", "--amber-text"],
      ["amber-text", "--amber-text", "--amber-brand"],
      ["amber-main", "--amber-brand", "--amber-deep"],
      ["cobalt-light", "--cobalt-light", "--cobalt"],
      ["cobalt-text", "--cobalt-text", "--cobalt-light"],
      ["cobalt-soft", "--cobalt-soft", "--cobalt-text"],
      ["cobalt-main", "--cobalt", "--cobalt-deep"],
    ];
    for (const [label, lightName, darkName] of pairs) {
      const l = v(light, lightName);
      const d = darkName.endsWith("?") ? "(none)" : v(root, darkName);
      console.log(`  ${label.padEnd(16)} light ${l.padEnd(9)} vs dark ${darkName.padEnd(18)} ${d.padEnd(9)} ${normalizeHex(l) === (d === "(none)" ? "" : normalizeHex(d)) ? "MATCH" : "differ"}`);
    }
  });

  it("ramp reconstruction: OKLCH deltas from seed, re-applied, byte-exact?", () => {
    const ramps: Record<string, string[]> = {
      mint: ["#DDF09A", "#C8E05E", "#B3D335", "#8A9F2A", "#6B7D20", "#56631A"],
      electric: ["#c4b5fd", "#a78bfa", "#8b5cf6", "#7c3aed", "#6d28d9", "#5b21b6"],
      amber: ["#fcd34d", "#fbbf24", "#f59e0b", "#d97706", "#b45309"],
      cobalt: ["#80C8FF", "#4DB3FF", "#37A3FE", "#008AFF", "#006ACC", "#005FB8"],
      rose: ["#f43f5e", "#e11d48"],
    };
    for (const [fam, hexes] of Object.entries(ramps)) {
      const seedIdx = { mint: 2, electric: 2, amber: 2, cobalt: 3, rose: 0 }[fam]!;
      const seed = hexToOklch(hexes[seedIdx]!);
      const bad: string[] = [];
      const geom: string[] = [];
      for (const [i, hex] of hexes.entries()) {
        const o = hexToOklch(hex);
        let dh = o.h - seed.h;
        if (dh > 180) dh -= 360;
        if (dh < -180) dh += 360;
        const step = { dL: o.l - seed.l, cScale: o.c / seed.c, dH: dh };
        geom.push(`{dL:${step.dL.toFixed(4)},cScale:${step.cScale.toFixed(4)},dH:${step.dH.toFixed(3)}}`);
        const back = oklchToHex(
          clampChroma({ l: seed.l + step.dL, c: seed.c * step.cScale, h: (seed.h + step.dH + 360) % 360 }),
        );
        if (back !== normalizeHex(hex)) bad.push(`  idx${i} ${hex} -> ${back}`);
      }
      console.log(` ${fam} seedIdx=${seedIdx}\n   ${geom.join("\n   ")}`);
      console.log(bad.length ? `   RECONSTRUCTION FAILURES:\n${bad.join("\n")}` : "   reconstruction byte-exact");
    }
  });

  it("alpha token inventory", () => {
    const names = [...new Set([...root.keys(), ...light.keys()])];
    for (const n of names) {
      const rv = root.get(n);
      const lv = light.get(n);
      if (rv && /rgba?\(/.test(rv)) console.log(`  ${n.padEnd(28)} DARK  ${rv}`);
      if (lv && /rgba?\(/.test(lv)) console.log(`  ${n.padEnd(28)} LIGHT ${lv}`);
    }
  });
});
