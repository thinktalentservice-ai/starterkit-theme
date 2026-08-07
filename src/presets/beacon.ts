/* BEACON — a government/VPAT preset: AAA (7:1) contrast, not just AA.
 *
 * Every family below reuses OBSIDIAN's measured ramp SHAPE (`deriveFamily`'s
 * whole point) and swaps only the seed hex: our geometry, their colour.
 * amber/cobalt/rose/sky carry no per-preset seed in the plan, so they are the
 * incumbent's ramps, unchanged — which is why the AAA duties below might
 * legitimately come back unmet; see the acknowledged section if so.
 */
import type { PresetSpec, Provenance, TokenRule } from "../engine/spec";
import { OBSIDIAN } from "./obsidian";

const literal = (dark: string, light = dark): TokenRule => ({
  kind: "literal",
  value: { dark, light },
});

const FAMILIES = {
  mint: {
    seed: "#0050B3",
    geometry: OBSIDIAN.families.mint!.geometry,
    slots: OBSIDIAN.families.mint!.slots,
    lightFollow: OBSIDIAN.families.mint!.lightFollow,
    darkFollow: { "--mint-dark": "--mint" },
  },
  electric: {
    seed: "#6B21A8",
    geometry: OBSIDIAN.families.electric!.geometry,
    slots: OBSIDIAN.families.electric!.slots,
  },
  amber: OBSIDIAN.families.amber!,
  cobalt: OBSIDIAN.families.cobalt!,
  rose: OBSIDIAN.families.rose!,
  sky: OBSIDIAN.families.sky!,
  cyan: {
    seed: "#0050B3",
    geometry: OBSIDIAN.families.cyan!.geometry,
    slots: OBSIDIAN.families.cyan!.slots,
  },
};

const NEUTRAL_DARK = { seed: "#0A0F16", slots: OBSIDIAN.neutral.dark.slots };
const NEUTRAL_LIGHT = { seed: "#FFFFFF", slots: OBSIDIAN.neutral.light.slots };

const TOKENS: Record<string, TokenRule> = {
  ...OBSIDIAN.tokens,
  "--font-heading": literal("'Public Sans', system-ui, sans-serif"),
  "--font-body": literal("'Public Sans', system-ui, sans-serif"),
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

export const BEACON: PresetSpec = {
  id: "beacon",
  name: "Beacon",
  intensity: 0,
  radius: 4,
  families: FAMILIES,
  neutral: { dark: NEUTRAL_DARK, light: NEUTRAL_LIGHT },
  tokens: TOKENS,
  provenance: Object.fromEntries(ALL_NAMES.map((n) => [n, classify(n)])),

  duties: [
    {
      token: "--mint",
      against: "--surface",
      min: 7,
      scheme: "both",
      because: "WCAG 1.4.6 AAA — palette.primary.main with white contrastText; beacon targets AAA",
      enforce: "search",
    },
    {
      token: "--amber-brand",
      against: "--surface",
      min: 7,
      scheme: "both",
      because: "WCAG 1.4.6 AAA — palette.warning.main with white contrastText; beacon targets AAA",
      enforce: "search",
    },
    {
      token: "--rose",
      against: "--surface",
      min: 7,
      scheme: "both",
      because: "WCAG 1.4.6 AAA — palette.error.main with white contrastText; beacon targets AAA",
      enforce: "search",
    },
  ],

  /* Beacon's 7:1 AAA bar is stricter than any duty obsidian ever declared, and
     amber/rose/mint are reused ramps tuned only for the incumbent's 4.5:1 AA
     target — searching them for AAA does not always find an entry that clears
     it. These four are the resolver's own search landing on the ramp's bound
     and still falling short, measured by running resolveBrand(BEACON), not
     guessed. */
  acknowledged: [
    {
      token: "--mint",
      scheme: "dark",
      measured: 4.05,
      reason:
        "Beacon's primary ramp is obsidian's mint geometry on a #0050B3 seed. The " +
        "dark-scheme search runs to the ramp's bound and lands at 4.05:1 on --surface — " +
        "short of WCAG AA (4.5:1, close but not there) and further short of beacon's own " +
        "7:1 AAA bar, though it clears 1.4.11's 3:1 non-text threshold. The ramp was never " +
        "tuned past AA on this seed.",
    },
    {
      token: "--amber-brand",
      scheme: "light",
      measured: 5.02,
      reason:
        "--amber-brand is the reused obsidian amber ramp, unchanged. The light-scheme " +
        "search runs to the ramp's bound and lands at 5.02:1 on --surface — well past AA " +
        "but short of the 7:1 AAA bar, because the ramp's darkest entry is that far from " +
        "white and no further amber step exists to darken it more.",
    },
    {
      token: "--rose",
      scheme: "dark",
      measured: 5.12,
      reason:
        "--rose is the reused obsidian rose ramp, which is only two entries long and was " +
        "held at a single value across both schemes (shift 0) because it was never meant " +
        "to move. The dark-scheme AAA search runs to that two-entry ramp's bound and lands " +
        "at 5.12:1 on --surface, short of 7:1.",
    },
    {
      token: "--rose",
      scheme: "light",
      measured: 4.7,
      reason:
        "Same two-entry rose ramp as the dark-scheme case above, searched independently " +
        "for the light scheme's --surface. It lands at 4.70:1 — the exact value obsidian's " +
        "own light-rose acknowledgment (--rose at 3.67:1) names as what '--rose-deep would " +
        "fix it' to. Beacon's search finds that value on its own and it clears WCAG AA " +
        "(4.5:1) outright; it is short only of beacon's own 7:1 AAA bar, a stricter target " +
        "obsidian never declared.",
    },
  ],
};
