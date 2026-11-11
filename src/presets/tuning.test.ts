/* The hand-tuned palette — what think and elemetrik actually SHIP.
 *
 * property/golden/fuzz run on `untuned()` presets and prove the engine. This
 * file pins the tuned layer: every tuned value reaches the sheet verbatim, the
 * resolver still derives from it, and its measured shortfalls are EXACTLY the
 * recorded ones — in both directions, so a fixed shortfall that nobody removed
 * from the ledger fails as loudly as a new one.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "../color/contrast";
import { hexToTriple } from "../color/oklch";
import { readTokens } from "../engine/parse";
import { resolveBrand } from "../engine/resolve";
import { serializeBrandCss } from "../engine/serialize";
import { ROLE_NAMES } from "../engine/ladder";
import { CHANNEL_PAIRS } from "../tokens/names";
import { PRESETS } from "./index";
import { untuned } from "./tuning";

const SCHEMES = ["dark", "light"] as const;
const TUNED = Object.values(PRESETS)
  .filter((p): p is NonNullable<typeof p> => p !== undefined)
  .map((preset) => ({ preset, brand: resolveBrand(preset) }));

/** Duty misses the tuning ships: light-mode marks on white for the pale fills.
 *  `preset|scheme|token` -> ratio. */
const DUTY_SHORTFALLS: Record<string, number> = {
  "think|light|--accent": 1.71,
  "think|light|--accent-green": 1.71,
  "think|light|--success": 2.78,
  "think|light|--warning": 2.15,
  "elemetrik|light|--accent-green": 1.71,
  "elemetrik|light|--success": 2.78,
  "elemetrik|light|--warning": 2.15,
};

/** White labels under 4.5:1 (worse of resting and hover). Every fill takes a
 *  white label by design decision; these are the families where that costs
 *  WCAG 1.4.3. `preset|scheme|family` -> ratio. */
const WHITE_LABEL_SHORTFALLS: Record<string, number> = {
  "think|dark|primary": 2.74,
  "think|dark|accent": 1.71,
  "think|dark|success": 2.78,
  "think|dark|warning": 2.15,
  "think|dark|danger": 3.67,
  "think|dark|info": 2.74,
  "think|dark|accent-green": 1.71,
  "think|light|primary": 3.45,
  "think|light|accent": 1.71,
  "think|light|success": 2.78,
  "think|light|warning": 2.15,
  "think|light|danger": 3.67,
  "think|light|info": 3.45,
  "think|light|accent-green": 1.71,
  "elemetrik|dark|success": 2.78,
  "elemetrik|dark|warning": 2.15,
  "elemetrik|dark|danger": 3.67,
  "elemetrik|dark|info": 2.74,
  "elemetrik|dark|accent-green": 1.71,
  "elemetrik|light|success": 2.78,
  "elemetrik|light|warning": 2.15,
  "elemetrik|light|danger": 3.67,
  "elemetrik|light|info": 3.45,
  "elemetrik|light|accent-green": 1.71,
};

describe("tuning — the hand-tuned palette think and elemetrik ship", () => {
  it("every tuned value reaches the resolved map verbatim", () => {
    const wrong: string[] = [];
    for (const { preset, brand } of TUNED) {
      for (const scheme of SCHEMES) {
        for (const [token, value] of Object.entries(preset.overrides?.[scheme] ?? {})) {
          const got = brand[scheme].get(token);
          /* Slot overrides are normalised to lower-case hex. */
          if (got !== value && got !== value.toLowerCase()) wrong.push(`${preset.id}|${scheme}|${token}: ${got} != ${value}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it("the tuning actually moved the sheet (both presets, both schemes)", () => {
    for (const { preset, brand } of TUNED) {
      const engine = resolveBrand(untuned(preset));
      for (const scheme of SCHEMES) {
        const moved = [...brand[scheme]].filter(([t, v]) => engine[scheme].get(t) !== v);
        expect(moved.length, `${preset.id}|${scheme}`).toBeGreaterThan(20);
      }
    }
  });

  it("duty shortfalls are exactly the recorded ones", () => {
    const actual: Record<string, number> = {};
    for (const { preset, brand } of TUNED) {
      for (const w of brand.warnings) actual[`${preset.id}|${w.scheme}|${w.token}`] = +w.ratio.toFixed(2);
    }
    expect(actual).toEqual(DUTY_SHORTFALLS);
  });

  it("white-label shortfalls are exactly the recorded ones", () => {
    const actual: Record<string, number> = {};
    for (const { preset, brand } of TUNED) {
      for (const scheme of SCHEMES) {
        const m = brand[scheme];
        for (const f of ROLE_NAMES) {
          const ink = m.get(`--${f}-on-solid`)!;
          const r = Math.min(
            contrastRatio(ink, m.get(`--${f}-solid`)!),
            contrastRatio(ink, m.get(`--${f}-solid-hover`)!),
          );
          if (r < 4.5) actual[`${preset.id}|${scheme}|${f}`] = +r.toFixed(2);
        }
      }
    }
    expect(actual).toEqual(WHITE_LABEL_SHORTFALLS);
  });

  it("every channel is still the RGB triple of its base, tuned or not", () => {
    const wrong: string[] = [];
    for (const { preset, brand } of TUNED) {
      for (const scheme of SCHEMES) {
        for (const [channel, base] of CHANNEL_PAIRS) {
          const expected = hexToTriple(brand[scheme].get(base)!);
          if (brand[scheme].get(channel) !== expected) {
            wrong.push(`${preset.id}|${scheme}|${channel}: ${brand[scheme].get(channel)} != ${expected}`);
          }
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it("serializes to CSS that parses back to the same tuned values", () => {
    for (const { preset, brand } of TUNED) {
      const css = serializeBrandCss(brand, { order: Object.keys(preset.provenance) });
      const root = readTokens(css, ":root");
      const light = new Map([...root, ...readTokens(css, '[data-mui-color-scheme="light"]')]);
      for (const [t, v] of brand.dark) expect(root.get(t), `${preset.id} dark ${t}`).toBe(v);
      for (const [t, v] of brand.light) expect(light.get(t), `${preset.id} light ${t}`).toBe(v);
    }
  });

  it("every shipped sheet declares the SAME light-block token set", () => {
    /* The tuned presets flip different subsets; gen-preset-css.mjs emits the
       union in every sheet so a host swapping sheets sees one ABI. Reads the
       checked-in files, so a stale or hand-edited sheet fails here too. */
    const dir = resolve(dirname(fileURLToPath(import.meta.url)), "../../presets");
    const sets = TUNED.map(({ preset }) => {
      const css = readFileSync(join(dir, `${preset.id}.css`), "utf8");
      return [preset.id, [...readTokens(css, '[data-mui-color-scheme="light"]').keys()].sort()] as const;
    });
    for (const [id, names] of sets.slice(1)) expect(names, `${id} vs ${sets[0]![0]}`).toEqual(sets[0]![1]);
  });

  it("a tuned mark feeds what derives from it", () => {
    const base = untuned(PRESETS.think!);
    const brand = resolveBrand({ ...base, overrides: { dark: { "--primary": "#123456" } } });
    expect(brand.dark.get("--primary")).toBe("#123456");
    expect(brand.dark.get("--primary-channel")).toBe("18 52 86");
    expect(brand.dark.get("--primary-bg")).toContain("18, 52, 86");
  });

  it("an unknown token or a non-hex slot override is an authoring error", () => {
    const base = untuned(PRESETS.think!);
    expect(() => resolveBrand({ ...base, overrides: { light: { "--nope": "#fff" } } })).toThrow(/unknown token/);
    expect(() => resolveBrand({ ...base, overrides: { light: { "--primary": "rgb(0 0 0)" } } })).toThrow();
  });
});
