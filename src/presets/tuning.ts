/* HAND-TUNED VALUES — the palette signed off on the system-owner admin's
 * `/design-preview/palette` page (nextv3-system-owner2-react, 2026-11), moved
 * into the package so every consumer gets them instead of one app carrying them
 * as a host-side override sheet.
 *
 * WHY THIS LAYER EXISTS. The engine is dark-first and derives light. On white it
 * landed on a muted steel blue for think's primary, olive for lime, a grey page,
 * heavy borders and dark-mode glows. These values are the reviewed answer to
 * that. They are applied through `PresetSpec.overrides`, which feeds them back
 * into the resolver (tints, borders, glows and channels derive from a tuned
 * mark) and still measures every duty against them — see `resolveBrand`.
 *
 * WHAT IT COSTS, NOT HIDDEN. Every solid fill here takes a WHITE label by design
 * decision. That is below WCAG 4.5:1 for several fills (lime, amber, green), and
 * light-mode marks for lime/amber/green sit under the 3:1 non-text duty on
 * white. The resolver reports those in `warnings`; nothing here suppresses them.
 *
 * This file holds what BOTH brands share. Brand-specific tuning (primary,
 * secondary, accent) lives in `think.ts` / `elemetrik.ts`.
 */
import type { PresetSpec, Scheme } from "../engine/spec";

export type Tuning = Partial<Scheme<Readonly<Record<string, string>>>>;

/** The preset as the ENGINE derives it, tuning stripped. The invariant suites
 *  (property, golden, fuzz) run on this: they prove the engine's mechanisms, and
 *  the tuning deliberately breaks several of them (white on lime, a fill that
 *  differs per scheme, flat gradients). What the tuned palette ships is pinned
 *  separately, by `tuning.test.ts`. */
export const untuned = (preset: PresetSpec): PresetSpec => ({ ...preset, overrides: undefined });

/** `both` is applied to each scheme first, then the scheme's own block. */
export function tune(t: {
  both?: Record<string, string>;
  dark?: Record<string, string>;
  light?: Record<string, string>;
}): Scheme<Readonly<Record<string, string>>> {
  return {
    dark: { ...t.both, ...t.dark },
    light: { ...t.both, ...t.light },
  };
}

/** Shared tuning first, brand tuning on top. */
export function mergeTuning(base: Tuning, brand: Tuning | undefined): Scheme<Readonly<Record<string, string>>> {
  return {
    dark: { ...base.dark, ...brand?.dark },
    light: { ...base.light, ...brand?.light },
  };
}

/** Flat fill: a one-colour "gradient" over `--<f>-solid`, so
 *  `background: var(--gradient-x)` call sites render the solid instead of a
 *  two-stop sweep. Written with `var()` stops, NOT literal hexes: a scope that
 *  re-declares `--<f>-solid` must re-colour the gradient too, and the host
 *  legibility gate resolves gradient stops through `var()` — literal stops
 *  leave every row built on them measuring nothing. */
export const flatGradient = (f: string): string =>
  `linear-gradient(var(--${f}-solid), var(--${f}-solid))`;

/** The four fill tokens of a family, same in both schemes. */
const fill = (f: string, solid: string, hover: string): Record<string, string> => ({
  [`--${f}-solid`]: solid,
  [`--${f}-solid-hover`]: hover,
  [`--${f}-on-solid`]: "#ffffff",
  [`--gradient-${f}`]: flatGradient(f),
});

const ROLES = [
  "primary", "secondary", "accent", "success", "warning",
  "danger", "info", "accent-green", "accent-pink",
] as const;

export const SHARED_TUNING = tune({
  both: {
    ...fill("accent-green", "#b3d335", "#a6c333"),
    ...fill("accent-pink", "#d42a68", "#bb2059"),
    ...fill("success", "#4caf50", "#47a24c"),
    ...fill("warning", "#f59e0b", "#e2930c"),
    ...fill("danger", "#f43f5e", "#e13b58"),
  },

  light: {
    /* Surfaces: one white plane; depth comes from hairlines, not grey fills. */
    "--background": "#ffffff",
    "--surface": "#ffffff",
    "--surface-elevated": "#f7f8fa",
    "--sidebar-bg": "#ffffff",
    "--card": "#ffffff",
    "--topbar-bg": "#ffffff",
    "--fg1": "#0e1525",
    "--fg2": "#465267",
    "--fg-muted": "#5f6b7e",
    "--fg-muted-min": "#6b7689",
    "--fg-disabled": "#a3abb8",
    "--border": "#e7e9ee",
    "--glass-border": "#e7e9ee",
    "--glass-bg": "#ffffff",
    "--glass-bg-card": "#ffffff",
    "--input-border": "#d5dae1",
    "--input-border-hover": "#b6bfcc",
    "--btn-outline-border": "#d5dae1",
    "--btn-outline-border-hover": "#b6bfcc",
    "--btn-ghost-bg": "rgb(14 21 37 / 0.04)",
    "--btn-ghost-bg-hover": "rgb(14 21 37 / 0.07)",
    "--hover-overlay": "rgb(14 21 37 / 0.04)",
    "--fg1-channel": "14 21 37",
    "--fg2-channel": "70 82 103",

    /* Categorical + status marks, text and tints. */
    "--accent-green": "#b3d335",
    "--accent-green-text": "#4a6600",
    "--accent-green-bg": "#edf6d3",
    "--accent-green-border": "rgb(179 211 53 / 0.5)",
    "--accent-green-channel": "179 211 53",
    "--accent-pink": "#e93574",
    "--accent-pink-text": "#b4205a",
    "--accent-pink-bg": "#fde8f0",
    "--accent-pink-border": "rgb(233 53 116 / 0.35)",
    "--accent-pink-channel": "233 53 116",
    "--info": "#008aff",
    "--info-text": "#0067c7",
    "--info-bg": "#e8f4ff",
    "--info-border": "rgb(0 138 255 / 0.35)",
    "--info-channel": "0 138 255",
    ...fill("info", "#008aff", "#0080ee"),
    "--success": "#4caf50",
    "--success-text": "#2e7d32",
    "--success-bg": "#edf7ee",
    "--success-border": "rgb(76 175 80 / 0.35)",
    "--success-channel": "76 175 80",
    "--warning": "#f59e0b",
    "--warning-text": "#b54708",
    "--warning-bg": "#fef1e1",
    "--warning-border": "rgb(245 158 11 / 0.4)",
    "--warning-channel": "245 158 11",
    "--danger": "#f43f5e",
    "--danger-text": "#be123c",
    "--danger-bg": "#fff1f3",
    "--danger-border": "rgb(244 63 94 / 0.35)",
    "--danger-channel": "244 63 94",

    /* Shape — tighter corners; the dark scheme's 20px cards read bulky on white. */
    "--radius": "8px",
    "--radius-chip": "6px",
    "--radius-card": "12px",

    /* Depth — hairline + faint shadow. No coloured glows in light mode. */
    "--shadow-card": "0 1px 2px rgb(16 24 40 / 0.04)",
    "--shadow-card-hover": "0 2px 6px rgb(16 24 40 / 0.06)",
    "--shadow-elevated": "0 0 0 1px #e7e9ee, 0 12px 32px -12px rgb(16 24 40 / 0.18)",
    "--shadow-dropdown": "0 0 0 1px #e7e9ee, 0 12px 32px -12px rgb(16 24 40 / 0.2)",
    ...Object.fromEntries(ROLES.map((f) => [`--glow-${f}`, "none"])),
    ...Object.fromEntries(ROLES.map((f) => [`--shadow-btn-${f}`, "none"])),
  },

  dark: {
    "--accent-green": "#b3d335",
    "--accent-green-text": "#c8e063",
    "--accent-green-bg": "rgb(179 211 53 / 0.14)",
    "--accent-green-border": "rgb(179 211 53 / 0.4)",
    "--accent-green-channel": "179 211 53",
    "--accent-pink": "#ee4f86",
    "--accent-pink-text": "#f27aa3",
    "--accent-pink-bg": "rgb(238 79 134 / 0.16)",
    "--accent-pink-border": "rgb(238 79 134 / 0.4)",
    "--accent-pink-channel": "238 79 134",
    "--info": "#3aa0ff",
    "--info-text": "#7cc0ff",
    "--info-bg": "rgb(58 160 255 / 0.16)",
    "--info-border": "rgb(58 160 255 / 0.4)",
    "--info-channel": "58 160 255",
    ...fill("info", "#3aa0ff", "#2b93f5"),
    "--success": "#4caf50",
    "--success-text": "#6eba67",
    "--success-bg": "rgb(76 175 80 / 0.14)",
    "--success-border": "rgb(76 175 80 / 0.4)",
    "--success-channel": "76 175 80",
    "--warning": "#f59e0b",
    "--warning-text": "#feb054",
    "--warning-bg": "rgb(245 158 11 / 0.14)",
    "--warning-border": "rgb(245 158 11 / 0.4)",
    "--warning-channel": "245 158 11",
    "--danger": "#f43f5e",
    "--danger-text": "#f86278",
    "--danger-bg": "rgb(244 63 94 / 0.14)",
    "--danger-border": "rgb(244 63 94 / 0.4)",
    "--danger-channel": "244 63 94",
  },
});
