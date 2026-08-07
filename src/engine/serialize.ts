/* Resolved brand -> CSS text.
 *
 * Two decisions worth stating, because both are load-bearing:
 *
 * ONLY DIFFERENCES GO IN THE LIGHT BLOCK. `resolveBrand` returns a COMPLETE map
 * per scheme — every token, both schemes — and this function emits the light
 * block as the set difference. Emitting the full light map would work in a
 * standalone sheet and break the moment a brand is delivered as an override
 * layer: a light rule that restates a token at the same specificity would win
 * over a later `:root` brand override, so a tenant colour would apply in dark
 * and silently not in light. That is the exact shape of the bug the button
 * package shipped, one layer up.
 *
 * THE LIGHT SELECTOR IS A LIST. MUI writes `data-mui-color-scheme`, but both
 * published component packages also key off `[data-theme="light"]`, and a sheet
 * that emits only one of them leaves half the design system on the dark values.
 * The default here is what the current sheet ships — one selector — so the
 * golden test compares like with like; adding the second is a caller's choice,
 * not a silent upgrade.
 */
import { ROOT_TOKEN_NAMES } from "../tokens/names";
import type { ResolvedBrand } from "./spec";

export type SerializeOptions = {
  /** Selectors for the light block. Comma-joined, so all get the same rule. */
  lightSelectors?: readonly string[];
  /** Emit `--tokens-version` / `--tokens-brand`. The CDN publisher sets these;
   *  a brand document has no business claiming a sheet version. */
  provenance?: { version: string; brand: string };
  /** Prepended verbatim. */
  header?: string;
  indent?: string;
};

const DEFAULT_LIGHT_SELECTORS = ['[data-mui-color-scheme="light"]'] as const;

/* Sheet order, then anything the preset added that the ABI does not know about.
   Sorting by the ABI keeps a regenerated sheet diffable against the old one; the
   tail is deliberately visible rather than dropped, so a token the engine emits
   and the ABI has never heard of shows up in review instead of vanishing. */
function orderedNames(map: Map<string, string>): string[] {
  const known = ROOT_TOKEN_NAMES.filter((n) => map.has(n));
  const extra = [...map.keys()].filter((n) => !(ROOT_TOKEN_NAMES as readonly string[]).includes(n));
  return [...known, ...extra.sort((a, b) => a.localeCompare(b))];
}

export function serializeBrandCss(brand: ResolvedBrand, options: SerializeOptions = {}): string {
  const indent = options.indent ?? "  ";
  const selectors = options.lightSelectors ?? DEFAULT_LIGHT_SELECTORS;
  const decl = (name: string, value: string): string => `${indent}${name}: ${value};`;

  const rootLines: string[] = [];
  if (options.provenance) {
    rootLines.push(
      decl("--tokens-version", JSON.stringify(options.provenance.version)),
      decl("--tokens-brand", JSON.stringify(options.provenance.brand)),
    );
  }
  for (const name of orderedNames(brand.dark)) rootLines.push(decl(name, brand.dark.get(name)!));

  const lightLines: string[] = [];
  for (const name of orderedNames(brand.light)) {
    const value = brand.light.get(name)!;
    if (brand.dark.get(name) === value) continue;
    lightLines.push(decl(name, value));
  }
  // `color-scheme` makes the UA paint scrollbars and form controls light too.
  // Without it a fully branded light page keeps dark native widgets.
  lightLines.push(`${indent}color-scheme: light;`);

  const blocks = [
    `:root {\n${rootLines.join("\n")}\n}`,
    `${selectors.join(",\n")} {\n${lightLines.join("\n")}\n}`,
  ];

  return `${options.header ? `${options.header.trimEnd()}\n\n` : ""}${blocks.join("\n\n")}\n`;
}
