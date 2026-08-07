/* React bindings. BrandProvider / useBrand / useConcreteTheme / ThemeToggle
 * land in phase 6.
 *
 * Everything in this entry is client-only and is built by the SECOND tsup
 * config, the one carrying `banner: { js: '"use client";' }`. Nothing here may
 * be re-exported from `src/index.ts` — that would drag the directive into the
 * core bundle and break the engine's use in a route handler or at the edge. */

import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react";
import { ThemeProvider, useColorScheme, useTheme, type Theme } from "@mui/material/styles";

/* Duplicated from `src/mui/index.ts`, not imported from it: tsup's two
 * configs (see tsup.config.ts) bundle each entry's `.d.ts` in isolation, and
 * a module augmentation only reaches a compilation unit that actually
 * contains it — a whole-program `tsc --noEmit` run sees both files at once
 * and hides that, but tsup's per-entry dts bundler doesn't, and `useTheme()`
 * below needs `theme.defaultColorScheme` to exist on the `Theme` type here
 * specifically. `declare module` blocks merge, so the duplicate is inert
 * everywhere both entries end up in the same program (e.g. a consumer
 * importing from both `./mui` and `./react`). */
declare module "@mui/material/styles" {
  interface CssThemeVariables {
    enabled: true;
  }
}

/* This file is `src/react/index.ts` — not `.tsx` — because tsup.config.ts
 * (not touched by this phase) names it as the react entry by that exact
 * path. TypeScript never parses JSX in a `.ts` file (the `<Foo>` syntax is
 * reserved for type assertions there), so every element below is built with
 * `createElement` instead of angle-bracket JSX. */

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

export type BrandProviderProps = {
  /** Which preset is active. Optional — purely informational, exposed via
   *  `useBrand()` for a brand-switcher UI; nothing here validates it against
   *  the CSS actually supplied. */
  id?: string;
  /** The resolved brand's serialized CSS (both scheme blocks), typically
   *  `serializeBrandCss(resolveBrand(preset))` from the core engine. Injected
   *  into exactly one <style id={BRAND_STYLE_ELEMENT_ID}> element — see that
   *  constant's own doc comment for why it must be exactly one element. */
  css: string;
  theme: Theme;
  children: ReactNode;
};

type BrandContextValue = { id?: string; css: string };
const BrandContext = createContext<BrandContextValue | null>(null);

export function BrandProvider({ id, css, theme, children }: BrandProviderProps) {
  return createElement(
    BrandContext.Provider,
    { value: { id, css } },
    createElement(
      ThemeProvider,
      { theme },
      createElement("style", { id: BRAND_STYLE_ELEMENT_ID, dangerouslySetInnerHTML: { __html: css } }),
      children,
    ),
  );
}

/** Throws outside a `BrandProvider` — a component reading brand state with no
 *  brand mounted is a bug at the call site, not a case to silently degrade. */
export function useBrand(): BrandContextValue {
  const ctx = useContext(BrandContext);
  if (ctx === null) throw new Error("useBrand must be used within a BrandProvider");
  return ctx;
}

/** MUI's own `mode` can be "system"; this resolves it to what's actually
 *  rendered. `colorScheme` is undefined on the server and on first paint,
 *  before MUI has resolved a stored preference or the OS media query — for
 *  that window this falls back to whatever `defaultColorScheme` the current
 *  theme was actually created with (`theme.defaultColorScheme`, read via
 *  `useTheme()`), NOT a hardcoded "dark". A `createStarterkitTheme({
 *  defaultColorScheme: "light" })` consumer renders light CSS from the first
 *  paint; a hook that answered "dark" regardless would disagree with what's
 *  on screen for that entire pre-hydration window. */
export function useConcreteTheme(): "light" | "dark" {
  const { colorScheme } = useColorScheme();
  const theme = useTheme();
  return colorScheme ?? theme.defaultColorScheme ?? "dark";
}

const ORDER = ["light", "dark", "system"] as const;

const SunIcon = ({ color }: { color: string }) =>
  createElement(
    "svg",
    { width: 17, height: 17, viewBox: "0 0 17 17", fill: "none", "aria-hidden": true },
    createElement("circle", { cx: 8.5, cy: 8.5, r: 3.5, fill: color }),
    createElement(
      "g",
      { stroke: color, strokeWidth: 1.4, strokeLinecap: "round" },
      createElement("path", { d: "M8.5 0.75v2" }),
      createElement("path", { d: "M8.5 14.25v2" }),
      createElement("path", { d: "M2.34 2.34l1.42 1.42" }),
      createElement("path", { d: "M13.24 13.24l1.42 1.42" }),
      createElement("path", { d: "M0.75 8.5h2" }),
      createElement("path", { d: "M14.25 8.5h2" }),
      createElement("path", { d: "M2.34 14.66l1.42-1.42" }),
      createElement("path", { d: "M13.24 3.76l1.42-1.42" }),
    ),
  );

const MoonIcon = ({ color }: { color: string }) =>
  createElement(
    "svg",
    { width: 17, height: 17, viewBox: "0 0 17 17", fill: "none", "aria-hidden": true },
    createElement("path", { d: "M14.5 10.4A6.25 6.25 0 0 1 6.6 2.5a6.25 6.25 0 1 0 7.9 7.9Z", fill: color }),
  );

const MonitorIcon = ({ color }: { color: string }) =>
  createElement(
    "svg",
    { width: 17, height: 17, viewBox: "0 0 17 17", fill: "none", "aria-hidden": true },
    createElement("rect", { x: 1, y: 2.5, width: 15, height: 9.5, rx: 1.5, stroke: color, strokeWidth: 1.4 }),
    createElement("path", { d: "M6 15h5", stroke: color, strokeWidth: 1.4, strokeLinecap: "round" }),
    createElement("path", { d: "M8.5 12v3", stroke: color, strokeWidth: 1.4, strokeLinecap: "round" }),
  );

const ICON = { light: SunIcon, dark: MoonIcon, system: MonitorIcon };

export type ThemeToggleProps = { className?: string };

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { mode, setMode } = useColorScheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || !mode) {
    return createElement(
      "button",
      { type: "button", className, disabled: true, "aria-label": "Toggle theme" },
      createElement(MoonIcon, { color: "var(--fg2)" }),
    );
  }

  function cycle() {
    const next = ORDER[(ORDER.indexOf(mode as (typeof ORDER)[number]) + 1) % ORDER.length] ?? "light";
    setMode(next);
  }
  const Icon = ICON[mode as keyof typeof ICON] ?? MoonIcon;

  return createElement(
    "button",
    { type: "button", className, onClick: cycle, "aria-label": `Theme: ${mode}. Click to change.` },
    createElement(Icon, { color: "var(--fg2)" }),
  );
}
