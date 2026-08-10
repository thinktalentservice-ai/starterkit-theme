/* GRAPHITE — dev-tooling preset: a client hue on Obsidian's own ramp geometry.
 *
 * Every family below reuses OBSIDIAN's measured ramp SHAPE (`deriveFamily`'s
 * whole point) and swaps only the seed hex: our geometry, their colour.
 * amber/cobalt/rose/sky carry no per-preset seed in the plan, so they are the
 * incumbent's ramps, unchanged.
 */
import type { PresetSpec, Provenance, TokenRule } from "../engine/spec";
import { OBSIDIAN } from "./obsidian";

const literal = (dark: string, light = dark): TokenRule => ({
  kind: "literal",
  value: { dark, light },
});

const FAMILIES = {
  /* Spread the incumbent's family and swap ONLY the seed. Re-listing
     `geometry`/`slots`/`lightFollow` field by field said the same thing until
     `darkFloor` was added to FamilySpec — then it silently dropped it here while
     obsidian had it, which is the whole class of bug a spread closes. */
  mint: { ...OBSIDIAN.families.mint!, seed: "#E5484D", darkFollow: { "--mint-dark": "--mint" } },
  electric: { ...OBSIDIAN.families.electric!, seed: "#8B8D98" },
  amber: OBSIDIAN.families.amber!,
  cobalt: OBSIDIAN.families.cobalt!,
  rose: OBSIDIAN.families.rose!,
  sky: OBSIDIAN.families.sky!,
  cyan: { ...OBSIDIAN.families.cyan!, seed: "#E5484D" },
};

const NEUTRAL_DARK = { seed: "#111113", slots: OBSIDIAN.neutral.dark.slots };
const NEUTRAL_LIGHT = { seed: "#F5F5F6", slots: OBSIDIAN.neutral.light.slots };

const TOKENS: Record<string, TokenRule> = {
  ...OBSIDIAN.tokens,
  "--font-heading": literal("'Geist', system-ui, sans-serif"),
  "--font-body": literal("'Geist', system-ui, sans-serif"),
};

/* Same classification question as obsidian.ts, same answer: the STRUCTURE
   doesn't change per preset, only the resolved colours do. */
const FIXED_PREFIXES = ["--dd-", "--avatar-", "--status-", "--on-"];
const FIXED_EXACT = new Set(["--pink", "--terminal-green", "--white-channel", "--black-channel"]);
const STRUCTURAL_EXACT = new Set([
  "--fg-muted", "--fg-muted-min", "--fg-disabled", "--border", "--glass-border",
  "--glass-bg", "--glass-bg-card", "--glass-dark-bg", "--input", "--input-border",
  "--input-border-hover", "--input-disabled-bg", "--input-disabled-border",
  "--btn-outline-border", "--btn-outline-border-hover", "--btn-ghost-bg",
  "--btn-ghost-bg-hover", "--hover-overlay", "--shadow-card", "--shadow-elevated",
  "--shadow-dropdown", "--dd-hover-shadow", "--font-heading", "--font-body",
  "--font-mono", "--ease-entrance", "--radius", "--radius-chip", "--radius-card",
  "--radius-pill", "--gradient-primary", "--gradient-mint", "--gradient-secondary",
  "--gradient-amber", "--gradient-danger", "--gradient-cobalt", "--gradient-avatar",
  "--gradient-progress",
]);

function classify(name: string): Provenance {
  if (FIXED_EXACT.has(name)) return "fixed";
  if (FIXED_PREFIXES.some((p) => name.startsWith(p)) && !name.endsWith("-channel")) return "fixed";
  if (name.startsWith("--status-") && name.endsWith("-channel")) return "fixed";
  if (STRUCTURAL_EXACT.has(name)) return "structural";
  return "derived";
}

const ALL_NAMES = [
  ...Object.keys(TOKENS),
  ...Object.values(FAMILIES).flatMap((f) => Object.keys(f.slots)),
  ...Object.keys(NEUTRAL_DARK.slots),
  "--radius",
  "--radius-chip",
  "--radius-card",
  "--radius-pill",
];

export const GRAPHITE: PresetSpec = {
  id: "graphite",
  name: "Graphite",
  intensity: 0.35,
  radius: 6,
  families: FAMILIES,
  neutral: { dark: NEUTRAL_DARK, light: NEUTRAL_LIGHT },
  tokens: TOKENS,
  provenance: Object.fromEntries(ALL_NAMES.map((n) => [n, classify(n)])),

  duties: [
    {
      token: "--mint",
      against: "--surface",
      min: 4.5,
      scheme: "both",
      because: "WCAG 1.4.3 — palette.primary.main with white contrastText; also 1.4.11 focus border",
      enforce: "search",
    },
    {
      token: "--amber-brand",
      against: "--surface",
      min: 4.5,
      scheme: "both",
      because: "WCAG 1.4.3 — palette.warning.main with white contrastText",
      enforce: "search",
    },
    {
      token: "--rose",
      against: "--surface",
      min: 4.5,
      scheme: "both",
      because: "WCAG 1.4.3 — palette.error.main with white contrastText",
      enforce: "search",
    },
  ],

  acknowledged: [],
};
