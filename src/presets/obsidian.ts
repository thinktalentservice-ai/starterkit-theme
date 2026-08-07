/* OBSIDIAN COMMAND — the incumbent.
 *
 * This preset must reproduce `src/tokens/__fixtures__/obsidian-2026-08-06.css`
 * exactly. That sheet is months of hand-tuning by a person, including at least
 * one decision (the 2026-08-06 `--mint` retune) made with a contrast meter open.
 * The golden test is what stops this file from being an approximation of it.
 *
 * WHY THE RAMPS ARE WRITTEN AS HEXES AND NOT AS DELTAS. The engine works in
 * relative OKLCH geometry — that is what lets a client's single hex move a whole
 * family — but nobody can review `{ dL: 0.1056, cScale: 0.6243, dH: -1.954 }`.
 * They can review `#DDF09A`. So the ramp is authored as the colours it actually
 * is, and `measureGeometry` converts it to relative form at module load. The
 * conversion is exact: `buildRamp(seed, measureGeometry(ramp))` returns `ramp`
 * byte for byte, for all five families, and the golden test asserts it rather
 * than trusting this comment.
 *
 * WHY THERE IS NO LIGHT PALETTE HERE. Measured, the light scheme is this same
 * ramp read one step deeper — 11 of 12 family slots byte-identical to a dark
 * slot. Authoring it separately would be authoring the same colours twice and
 * inviting them to disagree, which is exactly how the button package ended up
 * with two values for one state.
 */
import { measureGeometry } from "../engine/ramp";
import type { PresetSpec, Provenance, RampStep, TokenRule } from "../engine/spec";
import { hexToOklch } from "../color/oklch";

/* ── Family ramps, lightest first ─────────────────────────────────────────── */

/* Each ramp carries one entry BEYOND what the dark scheme uses, because the
   light scheme reads one step deeper and a ramp that stops at the dark window's
   edge would clamp — silently giving light mode the same colour as dark. */
const RAMPS = {
  //                soft       text       MAIN       (light main)  deep    (light deep)
  mint: ["#DDF09A", "#C8E05E", "#B3D335", "#8A9F2A", "#6B7D20", "#56631A"],
  //                light      text       MAIN       (light main)  deep    (light deep)
  electric: ["#c4b5fd", "#a78bfa", "#8b5cf6", "#7c3aed", "#6d28d9", "#5b21b6"],
  amber: ["#fcd34d", "#fbbf24", "#f59e0b", "#d97706", "#b45309"],
  cobalt: ["#80C8FF", "#4DB3FF", "#37A3FE", "#008AFF", "#006ACC", "#005FB8"],
  rose: ["#f43f5e", "#e11d48"],
  sky: ["#38bdf8"],
  cyan: ["#0ea5e9", "#0284c7"],
} as const;

const SEED_INDEX = { mint: 2, electric: 2, amber: 2, cobalt: 3, rose: 0, sky: 0, cyan: 0 } as const;

const family = (
  id: keyof typeof RAMPS,
  slots: Record<string, number>,
  lightShift?: Record<string, number>,
  lightFollow?: Record<string, string>,
) => ({
  seed: RAMPS[id][SEED_INDEX[id]]!,
  geometry: measureGeometry(RAMPS[id], SEED_INDEX[id]),
  slots,
  ...(lightShift ? { lightShift } : {}),
  ...(lightFollow ? { lightFollow } : {}),
});

/* ── Neutral surfaces ─────────────────────────────────────────────────────── */

/* Not a ramp with windows: the light surfaces are not a shifted read of the dark
   ones (`--surface` is `#10121c` on dark and pure `#ffffff` on light), so each
   scheme gets its own seed and its own offsets. `--sidebar-bg` is the one that
   proves offsets beat a linear ramp — it is DARKER than `--background` but more
   saturated and 5 degrees round the hue circle, which no single-axis ramp
   produces. */
const neutralFrom = (
  seed: string,
  members: Record<string, string>,
): { seed: string; slots: Record<string, RampStep> } => {
  const base = hexToOklch(seed);
  const slots: Record<string, RampStep> = {};
  for (const [token, hex] of Object.entries(members)) {
    const o = hexToOklch(hex);
    const dH = (((o.h - base.h) % 360) + 540) % 360;
    slots[token] = { dL: o.l - base.l, cScale: base.c === 0 ? 0 : o.c / base.c, dH: dH - 180 };
  }
  return { seed, slots };
};

const NEUTRAL_DARK = neutralFrom("#0d0f1a", {
  "--void": "#07080f",
  "--background": "#0d0f1a",
  "--surface": "#10121c",
  "--surface-elevated": "#161925",
  "--sidebar-bg": "#09091a",
  "--card": "#12141f",
  "--fg1": "#f0f2ff",
  "--fg2": "#8b93b5",
});

const NEUTRAL_LIGHT = neutralFrom("#f6f7fb", {
  "--void": "#e8eaf2",
  "--background": "#f6f7fb",
  "--surface": "#ffffff",
  "--surface-elevated": "#f0f1f7",
  "--sidebar-bg": "#eef0f8",
  "--card": "#ffffff",
  "--fg1": "#1a1d2e",
  "--fg2": "#5a6080",
});

/* ── Non-family tokens ────────────────────────────────────────────────────── */

const solidLiteral = (dark: string, light = dark): TokenRule => ({
  kind: "literal",
  value: { dark, light },
});

/** `--accent*` reads the mint ramp DIRECTLY, at the index `--mint` occupies in
 *  dark, and takes the ordinary one-step light shift. It deliberately does not
 *  follow `--mint`: in light, `--mint` took a two-step contrast bump to `#6B7D20`
 *  while the glow/fill layer stayed on the ramp's natural step `#8A9F2A`. Wiring
 *  these to `--mint` would be wrong by 12 dE00 and would silently restyle every
 *  card hover. */
const ACCENT_BASE = { k: "ramp", family: "mint", index: 2 } as const;
const ACCENT_TEXT_BASE = { k: "ramp", family: "mint", index: 1 } as const;

const GLOW_ALPHAS = {
  dark: [
    { geometry: "0 0 20px", alpha: 0.35 },
    { geometry: "0 0 60px", alpha: 0.12 },
  ],
  light: [
    { geometry: "0 0 20px", alpha: 0.2 },
    { geometry: "0 0 60px", alpha: 0.06 },
  ],
} as const;

const BTN_SHADOW = {
  dark: [{ geometry: "0 4px 20px", alpha: 0.4 }],
  light: [{ geometry: "0 4px 20px", alpha: 0.3 }],
} as const;

/** Alpha-on-overlay: the same veil in both schemes, white over dark and black
 *  over light. Left as a literal — as the button package had it — a light-first
 *  brand gets a white wash on white. */
const veil = (dark: number, light: number, mode: "flip" | "white" | "black" = "flip"): TokenRule => ({
  kind: "alpha",
  ref: { k: "overlay", mode },
  a: { dark, light },
});

const TOKENS: Record<string, TokenRule> = {
  /* Accent aliases */
  "--accent": { kind: "solid", ref: ACCENT_BASE },
  "--accent-text": { kind: "solid", ref: ACCENT_TEXT_BASE },
  "--accent-glow": { kind: "alpha", ref: ACCENT_BASE, a: { dark: 0.2, light: 0.2 }, scaled: true },
  "--accent-border": { kind: "alpha", ref: ACCENT_BASE, a: { dark: 0.26, light: 0.26 } },
  "--accent-fill": { kind: "alpha", ref: ACCENT_BASE, a: { dark: 0.06, light: 0.06 } },

  /* Brand tints that follow their family's emitted value */
  "--electric-dim": {
    kind: "alpha",
    ref: { k: "slot", family: "electric", token: "--electric" },
    a: { dark: 0.2, light: 0.15 },
    scaled: true,
  },
  "--cobalt-dim": {
    kind: "alpha",
    ref: { k: "slot", family: "cobalt", token: "--cobalt" },
    a: { dark: 0.2, light: 0.15 },
    scaled: true,
  },
  /* The focus ring holds ONE colour across both schemes — `shift: 0`. A ring
     that changes hue with the scheme reads as a different affordance, and this
     is the token screen-reader-adjacent users hunt for first. */
  "--ring": {
    kind: "alpha",
    ref: { k: "ramp", family: "electric", index: 3, shift: 0 },
    a: { dark: 0.4, light: 0.3 },
  },

  /* Ink, borders, glass, inputs, buttons — the neutral veils */
  "--fg-muted": veil(0.45, 0.45),
  "--fg-muted-min": veil(0.38, 0.38),
  "--fg-disabled": veil(0.28, 0.28),
  "--border": veil(0.08, 0.14),
  "--glass-border": veil(0.09, 0.14),
  "--glass-bg": veil(0.035, 0.72, "white"),
  "--glass-bg-card": veil(0.03, 0.6, "white"),
  "--glass-dark-bg": veil(0.25, 0.06, "black"),
  /* `transparent`, not `rgba(0,0,0,0)`: the light inputs sit directly on the
     card and any veil at all reads as a second surface. */
  "--input": { ...veil(0.1, 0), lightLiteral: "transparent" } as TokenRule,
  "--input-border": veil(0.08, 0.15),
  "--input-border-hover": veil(0.16, 0.25),
  "--input-disabled-bg": veil(0.03, 0.04),
  "--input-disabled-border": veil(0.05, 0.1),
  "--btn-outline-border": veil(0.34, 0.24),
  "--btn-outline-border-hover": veil(0.55, 0.42),
  "--btn-ghost-bg": veil(0.05, 0.03),
  "--btn-ghost-bg-hover": veil(0.1, 0.06),
  "--hover-overlay": veil(0.06, 0.04),

  /* Coloured glows — the only thing `intensity` touches */
  "--glow-violet": {
    kind: "shadow",
    ref: { k: "slot", family: "electric", token: "--electric" },
    layers: GLOW_ALPHAS,
    scaled: true,
  },
  "--glow-mint": { kind: "shadow", ref: ACCENT_BASE, layers: GLOW_ALPHAS, scaled: true },
  "--glow-amber": {
    kind: "shadow",
    ref: { k: "slot", family: "amber", token: "--amber-brand" },
    layers: GLOW_ALPHAS,
    scaled: true,
  },
  "--glow-cobalt": {
    kind: "shadow",
    ref: { k: "slot", family: "cobalt", token: "--cobalt" },
    layers: GLOW_ALPHAS,
    scaled: true,
  },
  "--shadow-btn-mint": { kind: "shadow", ref: ACCENT_BASE, layers: BTN_SHADOW, scaled: true },
  "--shadow-btn-violet": {
    kind: "shadow",
    ref: { k: "slot", family: "electric", token: "--electric" },
    layers: BTN_SHADOW,
    scaled: true,
  },
  "--shadow-btn-cobalt": {
    kind: "shadow",
    ref: { k: "slot", family: "cobalt", token: "--cobalt" },
    layers: BTN_SHADOW,
    scaled: true,
  },
  /* Half brand glow, half neutral drop. The drop is NOT scaled by intensity:
     it is a depth cue, and a flat-corporate brand still needs to know which
     card is lifted. */
  "--shadow-card-hover": {
    kind: "shadow",
    ref: ACCENT_BASE,
    layers: {
      dark: [{ geometry: "0 0 40px", alpha: 0.12 }],
      light: [{ geometry: "0 0 40px", alpha: 0.1 }],
    },
    tail: {
      dark: "0 8px 32px rgba(0, 0, 0, 0.30)",
      light: "0 8px 32px rgba(0, 0, 0, 0.08)",
    },
    scaled: true,
  },

  /* Neutral depth — brand-independent by design. A shadow that takes the brand
     hue stops reading as depth and starts reading as a coloured halo. */
  "--shadow-card": solidLiteral(
    "0 0 0 1px rgba(255, 255, 255, 0.03), 0 4px 24px rgba(0, 0, 0, 0.30)",
    "0 1px 2px rgba(15, 23, 42, 0.10), 0 6px 20px rgba(15, 23, 42, 0.10)",
  ),
  "--shadow-elevated": solidLiteral(
    "0 0 0 1px rgba(255, 255, 255, 0.05), 0 14px 44px rgba(0, 0, 0, 0.48)",
    "0 2px 6px rgba(15, 23, 42, 0.12), 0 16px 40px rgba(15, 23, 42, 0.18)",
  ),
  "--shadow-dropdown": solidLiteral(
    "0 8px 32px rgba(0, 0, 0, 0.40)",
    "0 8px 32px rgba(0, 0, 0, 0.12)",
  ),
  /* The topbar is a translucent pane over whatever scrolls beneath it, so its
     base is the page's deepest surface in dark and its lightest in light. */
  "--topbar-bg": {
    kind: "alpha",
    ref: {
      k: "scheme",
      dark: { k: "slot", family: "neutral", token: "--void" },
      light: { k: "slot", family: "neutral", token: "--surface" },
    },
    a: { dark: 0.85, light: 0.92 },
  },

  /* Ink for text sitting ON a light brand fill. Deliberately does NOT flip: it
     is keyed to the fill under it, not the page around it. Held as literals
     because these are hand-picked tinted blacks — deriving them would move four
     values that were chosen against a measured table. */
  "--on-mint": solidLiteral("#10140a"),
  "--on-sky": solidLiteral("#04212e"),
  "--on-amber": solidLiteral("#1f1403"),
  "--on-brand-ink": solidLiteral("#0b0f19"),

  /* Status palette — categorical, not brand. Six states that must stay mutually
     distinguishable; rotating them off one seed makes them less so, not more. */
  "--status-draft": solidLiteral("#94a3b8"),
  "--status-generating": solidLiteral("#a855f7"),
  "--status-review": solidLiteral("#f59e0b"),
  "--status-rubric": solidLiteral("#0ea5e9"),
  "--status-deployed": solidLiteral("#10b981"),
  "--status-closed": solidLiteral("#475569"),

  /* Header-dropdown island — a LIGHT panel in BOTH schemes by design, so none of
     it appears in the light block. This is the client-facing boundary of the
     brand: every client who says "make it all my colours" points here first. */
  "--dd-panel-bg": solidLiteral("#ffffff"),
  "--dd-hover-bg": solidLiteral("#f8fafc"),
  "--dd-sep": solidLiteral("#f1f5f9"),
  "--dd-title": solidLiteral("#1e293b"),
  "--dd-title-em": solidLiteral("#0f172a"),
  "--dd-menu-label": solidLiteral("#334155"),
  "--dd-desc": solidLiteral("#94a3b8"),
  "--dd-muted": solidLiteral("#cbd5e1"),
  "--dd-badge": solidLiteral("#2563eb"),
  "--dd-hover-shadow": solidLiteral("0 2px 12px rgba(0, 0, 0, 0.07)"),
  "--dd-blue": solidLiteral("#2563eb"),
  "--dd-blue-bg": solidLiteral("#eff6ff"),
  "--dd-green": solidLiteral("#16a34a"),
  "--dd-green-bg": solidLiteral("#f0fdf4"),
  "--dd-amber": solidLiteral("#f59e0b"),
  "--dd-amber-bg": solidLiteral("#fffbeb"),
  "--dd-red": solidLiteral("#dc2626"),
  "--dd-red-bg": solidLiteral("#fef2f2"),
  "--dd-violet": solidLiteral("#8b5cf6"),
  "--dd-violet-bg": solidLiteral("#f5f3ff"),
  "--dd-sky": solidLiteral("#0ea5e9"),
  "--dd-sky-bg": solidLiteral("#f0f9ff"),
  "--dd-slate": solidLiteral("#64748b"),
  "--dd-slate-bg": solidLiteral("#f8fafc"),
  "--dd-cobalt": solidLiteral("#008AFF"),
  "--dd-cobalt-bg": solidLiteral("#e8f4ff"),
  "--dd-orange": solidLiteral("#f97316"),
  "--dd-orange-bg": solidLiteral("#fff7ed"),
  "--dd-online": solidLiteral("#16a34a"),
  "--dd-busy": solidLiteral("#dc2626"),
  "--dd-away": solidLiteral("#f59e0b"),
  "--dd-offline": solidLiteral("#475569"),
  "--dd-btn-border": solidLiteral("#e2e8f0"),
  "--dd-btn-label": solidLiteral("#475569"),

  /* Categorical avatar palette — same argument as the status colours. */
  "--avatar-1-bg": solidLiteral("#d9eeff"),
  "--avatar-1": solidLiteral("#006ACC"),
  "--avatar-2-bg": solidLiteral("#dcfce7"),
  "--avatar-2": solidLiteral("#15803d"),
  "--avatar-3-bg": solidLiteral("#fce7f3"),
  "--avatar-3": solidLiteral("#be185d"),
  "--avatar-4-bg": solidLiteral("#fef3c7"),
  "--avatar-4": solidLiteral("#b45309"),
  "--avatar-5-bg": solidLiteral("#ede9fe"),
  "--avatar-5": solidLiteral("#6d28d9"),
  "--avatar-6-bg": solidLiteral("#ccfbf1"),
  "--avatar-6": solidLiteral("#0f766e"),

  /* Typography + motion */
  "--font-heading": solidLiteral("'Outfit', system-ui, sans-serif"),
  "--font-body": solidLiteral("'Plus Jakarta Sans', system-ui, sans-serif"),
  "--font-mono": solidLiteral("'Geist Mono', ui-monospace, monospace"),
  "--ease-entrance": solidLiteral("cubic-bezier(0.16, 1, 0.3, 1)"),

  /* Gradients are `var()` references, so they follow the brand for free and
     need no light-scheme entry. This is why the sheet's gradients were already
     safe when everything else needed an expander. */
  "--gradient-primary": solidLiteral("linear-gradient(135deg, var(--mint), var(--cyan))"),
  "--gradient-mint": solidLiteral("linear-gradient(145deg, var(--mint), var(--mint-dark))"),
  "--gradient-secondary": solidLiteral(
    "linear-gradient(135deg, var(--electric), var(--electric-deep))",
  ),
  "--gradient-amber": solidLiteral(
    "linear-gradient(135deg, var(--amber-brand), var(--amber-deep))",
  ),
  "--gradient-danger": solidLiteral("linear-gradient(135deg, var(--rose), var(--rose-deep))"),
  "--gradient-cobalt": solidLiteral(
    "linear-gradient(145deg, var(--cobalt-light), var(--cobalt-deep))",
  ),
  "--gradient-avatar": solidLiteral("linear-gradient(135deg, var(--electric), var(--mint))"),
  "--gradient-progress": solidLiteral("linear-gradient(90deg, var(--electric), var(--mint))"),

  /* Fixed overlay constants — no `--white` / `--black` base exists, by design. */
  "--white-channel": solidLiteral("255 255 255"),
  "--black-channel": solidLiteral("0 0 0"),
};

/* Channels are declared once, from the ABI's own pairing table, so a channel can
   never disagree with its base. That invariant used to be a comment in the sheet
   asking the next editor to remember; it is now structurally impossible to
   break, which is the single largest correctness win in this file. */
const CHANNEL_OF: Record<string, string> = {
  "--mint-channel": "--mint",
  "--electric-channel": "--electric",
  "--amber-channel": "--amber-brand",
  "--sky-channel": "--sky",
  "--rose-channel": "--rose",
  "--cobalt-channel": "--cobalt",
  "--mint-text-channel": "--mint-text",
  "--mint-dark-channel": "--mint-dark",
  "--electric-text-channel": "--electric-text",
  "--electric-deep-channel": "--electric-deep",
  "--amber-text-channel": "--amber-text",
  "--amber-deep-channel": "--amber-deep",
  "--status-draft-channel": "--status-draft",
  "--status-generating-channel": "--status-generating",
  "--status-review-channel": "--status-review",
  "--status-rubric-channel": "--status-rubric",
  "--status-deployed-channel": "--status-deployed",
  "--status-closed-channel": "--status-closed",
  "--fg1-channel": "--fg1",
  "--fg2-channel": "--fg2",
  "--background-channel": "--background",
  "--surface-channel": "--surface",
  "--card-channel": "--card",
};
for (const [channel, of] of Object.entries(CHANNEL_OF)) TOKENS[channel] = { kind: "channel", of };

/* ── Provenance ───────────────────────────────────────────────────────────── */

/* Classified by ONE question: does this token move when a client changes a seed?
   Reported by the golden test, so "the engine reproduces the sheet" can never be
   read as a stronger claim than the split supports. */
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

/* ── The preset ───────────────────────────────────────────────────────────── */

const FAMILIES = {
  /* No `lightShift` here on purpose. `--mint` takes TWO ramp steps into light
     rather than one, but that is the engine's contrast search arriving at the
     answer, not a constant transcribed from the sheet: one step lands on
     `#8A9F2A` at 2.97:1, which fails 1.4.3 (white contrastText) and 1.4.11
     (focus border) for `palette.primary.main`, so the search takes a second step
     to `#6B7D20` at 4.59:1. Hard-coding the 2 reproduced this sheet and broke
     every other seed — see the note in resolve.ts. */
  mint: family(
    "mint",
    { "--mint-soft": 0, "--mint-text": 1, "--mint": 2, "--mint-dark": 3 },
    undefined,
    { "--mint-dark": "--mint" },
  ),
  electric: family("electric", {
    "--electric-light": 0,
    "--electric-text": 1,
    "--electric": 2,
    "--electric-deep": 4,
  }),
  amber: family("amber", {
    "--amber-soft": 0,
    "--amber-text": 1,
    "--amber-brand": 2,
    "--amber-deep": 3,
  }),
  cobalt: family("cobalt", {
    "--cobalt-soft": 0,
    "--cobalt-text": 1,
    "--cobalt-light": 2,
    "--cobalt": 3,
    "--cobalt-deep": 4,
  }),
  /* Error red holds ONE value across both schemes — `lightShift: 0`. A danger
     colour that shifts with the scheme is a danger colour the eye has to relearn. */
  rose: family("rose", { "--rose": 0, "--rose-deep": 1 }, { "--rose": 0, "--rose-deep": 0 }),
  sky: family("sky", { "--sky": 0 }, { "--sky": 0 }),
  cyan: family("cyan", { "--cyan": 0 }),
};

/* Single-colour families for the two hues nothing brandable drives. They are
   families rather than literals so a later preset CAN move them without a
   schema change — but no seed points at them today, hence `fixed` provenance. */
TOKENS["--pink"] = solidLiteral("#ec4899");
TOKENS["--terminal-green"] = solidLiteral("#4ade80");

const ALL_NAMES = [
  ...Object.keys(TOKENS),
  ...Object.values(FAMILIES).flatMap((f) => Object.keys(f.slots)),
  ...Object.keys(NEUTRAL_DARK.slots),
  "--radius",
  "--radius-chip",
  "--radius-card",
  "--radius-pill",
];

export const OBSIDIAN: PresetSpec = {
  id: "obsidian",
  name: "Obsidian Command",
  intensity: 1,
  radius: 12,
  families: FAMILIES,
  neutral: { dark: NEUTRAL_DARK, light: NEUTRAL_LIGHT },
  tokens: TOKENS,
  provenance: Object.fromEntries(ALL_NAMES.map((n) => [n, classify(n)])),

  /* Contrast duties, taken from what mui-theme.js actually declares rather than
     from what would be nice. Every `palette.*.contrastText` in that file is
     `#ffffff`, so every `main` owes 4.5:1 against white — and three of them do
     not pay it. Those three are acknowledged below with their measured ratios,
     not quietly excluded: the preset ships them because they are the incumbent
     look, and the number is written down so the decision can be revisited. */
  duties: [
    {
      token: "--mint",
      against: "--surface",
      min: 4.5,
      scheme: "light",
      because: "WCAG 1.4.3 — palette.primary.main with white contrastText; also 1.4.11 focus border",
      /* The one duty that drives the search: this reproduces the 2026-08-06
         hand-fix from #8A9F2A (2.97:1) to #6B7D20 (4.59:1) instead of
         transcribing its answer. */
      enforce: "search",
    },
    {
      token: "--accent-text",
      against: "--surface",
      min: 4.5,
      scheme: "light",
      because: "WCAG 1.4.3 — used as body/label colour on the login and dashboard pages",
      enforce: "report",
    },
    {
      token: "--amber-brand",
      against: "--surface",
      min: 4.5,
      scheme: "light",
      because: "WCAG 1.4.3 — palette.warning.main with white contrastText",
      enforce: "report",
    },
    {
      token: "--rose",
      against: "--surface",
      min: 4.5,
      scheme: "light",
      because: "WCAG 1.4.3 — palette.error.main with white contrastText",
      enforce: "report",
    },

    /* Dark-scheme duties. The sheet had none, and the gap was not visible:
       obsidian's lime sits at 10.92:1 on `--surface` so nothing ever looked
       wrong, while a client's mid-tone seed lands near 3.7:1 and would have
       shipped with a green build. Measured against `--surface` and not
       `--background` because `background.paper` is what a Card renders, and it
       is the stricter of the two by ~0.1. */
    {
      token: "--mint",
      against: "--surface",
      min: 4.5,
      scheme: "dark",
      because: "WCAG 1.4.3 — palette.primary.main as text and icon colour on background.paper",
      enforce: "report",
    },
    {
      token: "--electric",
      against: "--surface",
      min: 4.5,
      scheme: "dark",
      because: "WCAG 1.4.3 — palette.secondary.main as text and icon colour on background.paper",
      enforce: "report",
    },
  ],

  acknowledged: [
    {
      token: "--accent-text",
      scheme: "light",
      measured: 1.71,
      reason:
        "`--accent-text` is `#B3D335` in light — the ramp's `*-text` step, which is a " +
        "dark-surface accent. It is used as a text colour on the login page and the " +
        "dashboard eyebrow labels, where it is illegible. This is a PRE-EXISTING defect " +
        "in the shipped sheet, reproduced here deliberately: fixing it is a visible " +
        "restyle of live pages and belongs in its own reviewed change, not smuggled in " +
        "under a migration that is supposed to be pixel-identical.",
    },
    {
      token: "--amber-brand",
      scheme: "light",
      measured: 3.19,
      reason:
        "`palette.warning.main` is `#d97706` with white contrastText — 3.19:1. Clears " +
        "1.4.11 (3:1, non-text) but not 1.4.3. Contained warning buttons are the affected " +
        "surface. Same reasoning as above: reproduced, recorded, not silently fixed.",
    },
    {
      token: "--rose",
      scheme: "light",
      measured: 3.67,
      reason:
        "`palette.error.main` is `#f43f5e` with white contrastText — 3.67:1. Same shape as " +
        "the warning case. `--rose-deep` (4.70:1) is the value that would fix it, which is " +
        "a one-line change but a visible one.",
    },
    {
      token: "--electric",
      scheme: "dark",
      measured: 4.41,
      reason:
        "`palette.secondary.main` is `#8b5cf6`, which is 4.51:1 on `--background` and 4.41:1 " +
        "on `--surface` — it passes on the page and fails inside a Card, by 0.09. Found by " +
        "adding the dark-scheme duty this sheet never had, not by anyone noticing it on " +
        "screen. One ramp step lighter (`--electric-text`, `#a78bfa`) is 7.09:1 and would " +
        "fix it, at the cost of restyling every secondary control. Recorded rather than " +
        "changed, on the same reasoning as the three above.",
    },
  ],
};

export { RAMPS as OBSIDIAN_RAMPS, SEED_INDEX as OBSIDIAN_SEED_INDEX };
