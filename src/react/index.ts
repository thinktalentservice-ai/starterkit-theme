/* React bindings. BrandProvider / useBrand / useConcreteTheme / ThemeToggle
 * land in phase 6.
 *
 * Everything in this entry is client-only and is built by the SECOND tsup
 * config, the one carrying `banner: { js: '"use client";' }`. Nothing here may
 * be re-exported from `src/index.ts` — that would drag the directive into the
 * core bundle and break the engine's use in a route handler or at the edge. */

import { useEffect, useState } from "react";

/** The id of the SSR-injected `<style>` element carrying the resolved brand.
 *  Exported because the live editor has to find and replace that exact element,
 *  and a second element with the same tokens would leave which-one-wins to
 *  document order. */
export const BRAND_STYLE_ELEMENT_ID = "brand-vars";

/**
 * Live computed value of a CSS custom property on `:root`.
 *
 * Reads through `getComputedStyle`, so it reports what the cascade actually
 * resolved — the SSR-injected brand, a preset sheet, or the fallback token —
 * rather than what any one stylesheet claims. That distinction is the whole
 * point of the palette audit page: a token diff that reads the source files
 * reports the floor while the screen shows the brand.
 *
 * Re-reads when the colour scheme flips, because roughly half the token set
 * carries a different value per scheme.
 *
 * Returns `""` during SSR and on the first client render — there is no cascade
 * to read on the server, and inventing a value would make the first paint
 * disagree with the second. Callers render a skeleton for the empty string.
 */
export function useTokenValue(name: string): string {
  const [value, setValue] = useState("");

  useEffect(() => {
    const root = document.documentElement;
    const read = () => setValue(getComputedStyle(root).getPropertyValue(name).trim());
    read();

    // The scheme attribute flips on the same element whose styles we read, and
    // a MutationObserver fires after the style recalculation, so the value read
    // here is the post-flip one.
    const observer = new MutationObserver(read);
    observer.observe(root, { attributeFilter: ["data-mui-color-scheme", "data-theme", "style"] });

    // A host with no scheme attribute follows the OS instead.
    const media = window.matchMedia("(prefers-color-scheme: light)");
    media.addEventListener("change", read);

    return () => {
      observer.disconnect();
      media.removeEventListener("change", read);
    };
  }, [name]);

  return value;
}
