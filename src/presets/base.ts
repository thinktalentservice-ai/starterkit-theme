/* THE PRESET FACTORY — everything two brands share, which is everything but six hexes.
 *
 * `makePreset` takes an id, a name and six seeds and returns a complete
 * `PresetSpec`. `think.ts` and `elemetrik.ts` are each ~30 lines because of it,
 * and between them exactly TWO seeds differ. That is not tidiness: "the same
 * component code works with both themes" is only true if the two themes have the
 * same token names, the same ramp shape, the same duties and the same neutral
 * layer, and the cheapest way to guarantee that is for one function to emit all
 * of it. A second preset written by copying the first is how six presets ended
 * up declaring five different sets of dark-scheme duties, three of which then
 * shipped a measured 4.42:1 with `warnings` empty.
 *
 * WHAT A PRESET IS ALLOWED TO VARY: the six seeds, the id, the display name, the
 * corner radius, the glow intensity and the three font stacks. Nothing else is
 * a parameter, on purpose. If a brand needs a different neutral floor or a
 * different duty, that is a change to this file — reviewed once, applied to
 * both — not a field that lets one preset quietly diverge.
 */
import { hexToOklch } from "../color/oklch";
import {
  FILL_INK,
  FILL_WHITE,
  HOVER_MIX,
  LADDER,
  ROLE_LIGHT_SHIFT,
  ROLE_NAMES,
  ROLE_SLOTS,
  type RoleName,
} from "../engine/ladder";
import { normalizeHex } from "../color/oklch";
import type {
  ColorRef,
  Duty,
  FamilySpec,
  PresetSpec,
  Provenance,
  RampStep,
  TokenRule,
} from "../engine/spec";

/* ── Config ───────────────────────────────────────────────────────────────── */

export type BrandSeeds = Readonly<Record<RoleName, string>>;

export type PresetConfig = {
  id: string;
  name: string;
  seeds: BrandSeeds;
  /** 0..1 — scales the COLOURED glow/shadow alphas only, never the neutral
   *  drop-shadows, which are depth cues rather than brand. */
  intensity?: number;
  /** `--radius`; the chip and card radii step off it. */
  radius?: number;
  fonts?: { heading: string; body: string; mono: string };
};

const DEFAULT_FONTS = {
  heading: "'Outfit', system-ui, sans-serif",
  body: "'Plus Jakarta Sans', system-ui, sans-serif",
  mono: "'Geist Mono', ui-monospace, monospace",
} as const;

/* ── Families ─────────────────────────────────────────────────────────────── */

/**
 * One role, built from one hex on the shared ladder.
 *
 * No `darkFloor`, `darkTarget` or `darkChromaRetention` — and their absence is a
 * decision worth stating, because the previous catalogue needed all three.
 *
 * Those existed to rescue a family whose MAIN rung had to clear 4.5:1 in dark
 * and could not, because the old sheet made one token carry both the text duty
 * and the mark duty. Lifting the SEED was the only lever that reached far
 * enough, and it worked — at the cost of moving the brand hue itself, which is
 * why `--brand-fill` then had to be invented to pin the unmoved colour back.
 *
 * Splitting text from mark removes the need. `--<f>` owes 3.0:1, which every
 * seed here clears on its own; `--<f>-text` owes 4.5:1 and reads a LIGHTER rung
 * that clears it, and where it does not (elemetrik's `#6832FF` at 3.93:1) the
 * ordinary contrast search walks one rung further to 5.20:1 without touching the
 * ramp. So the dark and light ramps are built from the same untouched seed, and
 * `{ k: "ramp", index, shift: 0 }` is genuinely scheme-invariant again — which
 * is what lets `--<f>-solid` be the brand's exact hex in both schemes instead of
 * a lifted approximation of it.
 */
const family = (f: RoleName, seed: string): FamilySpec => ({
  seed: normalizeHex(seed),
  geometry: LADDER,
  slots: { [`--${f}-text`]: ROLE_SLOTS.text, [`--${f}`]: ROLE_SLOTS.main },
  lightShift: { [`--${f}-text`]: ROLE_LIGHT_SHIFT.text, [`--${f}`]: ROLE_LIGHT_SHIFT.main },
});

/* ── Neutral surfaces ─────────────────────────────────────────────────────── */

/* Shared by both presets, and not a parameter.
 *
 * Not a ramp with windows: the light surfaces are not a shifted read of the dark
 * ones (`--surface` is `#10121c` on dark and pure `#ffffff` on light), so each
 * scheme gets its own seed and its own offsets. `--sidebar-bg` is the one that
 * proves offsets beat a linear ramp — it is DARKER than `--background` but more
 * saturated and 5 degrees round the hue circle, which no single-axis ramp
 * produces. */
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

/* ── Rule helpers ─────────────────────────────────────────────────────────── */

const literal = (dark: string, light = dark): TokenRule => ({
  kind: "literal",
  value: { dark, light },
});

/** Alpha-on-overlay: the same veil in both schemes, white over dark and black
 *  over light. Left as a fixed literal — as the button package once had it — a
 *  light-first brand gets a white wash on white. */
const veil = (dark: number, light: number, mode: "flip" | "white" | "black" = "flip"): TokenRule => ({
  kind: "alpha",
  ref: { k: "overlay", mode },
  a: { dark, light },
});

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

/** The family's exact seed hex, in BOTH schemes.
 *
 *  `shift: 0` holds the ramp index across schemes and, with no `darkFloor`
 *  anywhere in this catalogue, the dark and light ramps are the same array — so
 *  this resolves to the seed itself, everywhere. That equality is not incidental
 *  and is asserted: the moment any family gains a floor, a `ramp` ref stops
 *  being scheme-invariant (it reads `ctx.ramps[scheme]`) and this would silently
 *  become two different fills. Use `{ k: "slot", from: "dark" }` instead if that
 *  day comes — a slot ref pins the SCHEME, which is the property wanted here. */
const solidRef = (f: RoleName): ColorRef =>
  ({ k: "ramp", family: f, index: ROLE_SLOTS.main, shift: 0 });

const hoverRef = (f: RoleName): ColorRef =>
  ({ k: "mix", a: solidRef(f), b: FILL_INK, t: HOVER_MIX });

/** The family's scheme-following mark — what `--<f>` itself resolves to. */
const markRef = (f: RoleName): ColorRef => ({ k: "slot", family: f, token: `--${f}` });

/* ── The token set ────────────────────────────────────────────────────────── */

/**
 * The eight tokens each role emits.
 *
 * `--<f>` and `--<f>-text` come from the family's SLOTS (the resolver emits
 * every declared slot); the other six are rules built here. Written as one loop
 * rather than six hand-authored blocks so the grammar cannot drift per family —
 * which is the failure the old five-shapes-for-five-families sheet had, and the
 * reason `tone="amber"` and `tone="danger"` behaved differently in the button.
 */
function roleRules(f: RoleName): Record<string, TokenRule> {
  return {
    /* THE FILL. Scheme-invariant and never darkened for contrast: a brand hue
       under text is not a brand hue as text, and solving it for the stricter job
       is what turned a lime brand olive on light-mode primary buttons. The label
       on it is measured (below) rather than assumed, so the fill never has to
       move to make the label legal. */
    [`--${f}-solid`]: { kind: "solid", ref: solidRef(f) },
    [`--${f}-solid-hover`]: { kind: "solid", ref: hoverRef(f) },

    /* THE LABEL, chosen by measurement over BOTH fill states — see the `ink`
       rule in spec.ts and `HOVER_MIX` in ladder.ts. `over` reuses the same ref
       objects the fills are defined from rather than restating them, so the ink
       is scored against the colour the fill actually renders. */
    [`--${f}-on-solid`]: {
      kind: "ink",
      over: [solidRef(f), hoverRef(f)],
      candidates: [FILL_INK, FILL_WHITE],
    },

    /* THE TINT — a chip or callout background. Alpha over the scheme-following
       mark, so it lands on the right side of the surface in both schemes. */
    [`--${f}-bg`]: { kind: "alpha", ref: markRef(f), a: { dark: 0.14, light: 0.1 } },

    /* THE SUBTLE BORDER (Radix step 6-7): a decorative edge on a tinted chip.
       IT DOES NOT CLEAR 3:1 AND IS NOT MEANT TO — measured 1.7-3.0:1 across the
       eight seeds. Any border that carries meaning — an outline button, a focus
       ring, a selected state — uses `--<f>` itself, which owes 3.0:1 by duty.
       Both roles genuinely exist; naming only one of them "border" and leaving
       the other implicit is how a 1.56:1 outline button shipped once already. */
    [`--${f}-border`]: { kind: "alpha", ref: markRef(f), a: { dark: 0.42, light: 0.36 } },

    /* `R G B` of the mark, for `rgb(var(--<f>-channel) / α)` at a call site. */
    [`--${f}-channel`]: { kind: "channel", of: `--${f}` },

    /* Brand depth. `scaled`, so `intensity: 0` flattens every one of them at
       once and the neutral drop-shadows survive. */
    [`--glow-${f}`]: { kind: "shadow", ref: markRef(f), layers: GLOW_ALPHAS, scaled: true },
    [`--shadow-btn-${f}`]: { kind: "shadow", ref: solidRef(f), layers: BTN_SHADOW, scaled: true },

    /* The solid gradient for this tone — the resting fill into the hovered one,
       so a gradient button and a flat button are the same colour family and a
       tone can never gain a hue it does not own. `--gradient-primary` used to
       blend `mint` into `cyan`, two INDEPENDENT client seeds, so the primary CTA
       mixed two unrelated brand colours and mixed them differently per tenant. */
    [`--gradient-${f}`]: literal(
      `linear-gradient(135deg, var(--${f}-solid), var(--${f}-solid-hover))`,
    ),
  };
}

/**
 * The start stop of `--gradient-avatar` — the primary fill, raised until it
 * clears a CONTRAST FLOOR.
 *
 * THIS IS ONE OF THE TWO PLACES A FILL IS ALLOWED TO MOVE OFF ITS SEED (the
 * other is `AVATAR_3_FROM`), and the two are different on purpose: this one asks
 * for a RATIO and stops the moment it has it, so a brand whose seed already
 * passes does not move at all. `AVATAR_3_FROM` asks for a DISTANCE, so every
 * brand moves and none can no-op. That difference is the whole difference
 * between `--gradient-avatar` and `--gradient-avatar-3`.
 *
 * 5.5 rather than 4.5, and the extra point is bought by the TROUGH rather than
 * by the endpoint — a blend across a hue can dip below BOTH of its ends, so an
 * endpoint-tight floor leaves the interior free to fail. Above 6.38 THINK starts
 * moving too, and think is the preset that should not move — its seed already
 * reads 6.38:1 with ink, so `fitContrast` returns it untouched and this is a
 * no-op there BY CONSTRUCTION, not by luck.
 *
 * WHAT THE FLOOR NO LONGER BUYS, stated plainly rather than left in an old
 * comment. It was set when this gradient ended on `--accent-solid`, where
 * lifting the start was genuinely enough to make ONE ink span the sweep. The
 * gradient now ends on `--primary-solid` itself, and no floor on the START can
 * rescue an END that fails: elemetrik's unlifted `#6832FF` reads 3.18:1 with
 * dark ink and 3.48:1 with white, so `--gradient-avatar` carries a sub-AA
 * trough on that brand no matter what this number is. That shortfall is
 * measured, listed in `property.test.ts` and owned — it is not a floor quietly
 * failing to do its job.
 *
 * What 5.5 still buys is real and is why it stays: the start stop keeps the
 * exact value it shipped with (think `#0099FF`, elemetrik `#8576FF`), so this
 * change moves no token that was not asked to move, and elemetrik keeps a
 * visible light-to-dark sweep rather than a flat block. On think it IS a flat
 * block, for the same reason it is a no-op there — see `AVATAR_3_FROM` for the
 * variant that does not have that property.
 */
const AVATAR_FROM: ColorRef = {
  k: "lift",
  ref: solidRef("primary"),
  against: FILL_INK,
  min: 5.5,
};

/**
 * The start stop of `--gradient-avatar-3` — the primary fill, raised by a FIXED
 * perceptual distance.
 *
 * Exists because a contrast floor cannot express "always lighter than this".
 * `AVATAR_FROM` returns think's `#0099FF` untouched — correctly, it already
 * passes — and a gradient from that colour to `--primary-solid` is therefore
 * the same hex twice: a flat fill, emitted with no error, no warning, and
 * nothing in the sheet saying the sweep is gone. A distance cannot do that.
 *
 * 0.12 in OKLCH L, which is roughly the gap the shared family geometry carries
 * between two adjacent ramp steps, so the sweep reads as a deliberate step
 * rather than a smudge: think renders `#80C0FF -> #0099FF`, elemetrik
 * `#8678FF -> #6832FF`.
 *
 * It makes NO contrast claim, and inherits the same sub-AA trough
 * `--gradient-avatar` has, from the same cause — the END stop. Do not read the
 * larger start-stop lift as buying legibility: elemetrik measures 3.42:1 here
 * against 3.48:1 there, i.e. very slightly WORSE, because a brighter start does
 * nothing for a trough that sits at the far end.
 */
const AVATAR_3_FROM: ColorRef = { k: "lighten", ref: solidRef("primary"), dl: 0.12 };

/** A gradient, sampled end to end, for an `ink` rule to score against.
 *
 *  Eleven samples instead of two, because MEASURING A GRADIENT AT ITS ENDPOINTS
 *  DOES NOT BOUND IT: sRGB decode is convex and luminance weights the channels
 *  very unevenly, so a blend across a hue can dip BELOW both ends — measured on
 *  a real seed at t=0.66, which a quarter-point list steps straight over. The
 *  property test samples 21 points against these 11 on purpose: a test that
 *  measured at the same points the preset chose would only prove the preset
 *  agrees with itself.
 *
 *  A function rather than one const, because there are now three avatar sweeps
 *  and a copied sample list is how two of them end up measured at different
 *  resolutions without anyone deciding that. */
const sweepSamples = (from: ColorRef, to: ColorRef): ColorRef[] =>
  Array.from({ length: 11 }, (_, i) =>
    i === 0 ? from : i === 10 ? to : { k: "mix", a: from, b: to, t: i / 10 },
  );

function sharedRules(fonts: { heading: string; body: string; mono: string }): Record<string, TokenRule> {
  return {
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

    /* The focus ring holds ONE colour across both schemes. A ring that changes
       hue with the scheme reads as a different affordance, and this is the token
       keyboard users hunt for first. It reads the ramp index directly rather
       than `--primary`, so a light-scheme contrast search on the mark cannot
       drag the ring somewhere darker than the thing it is outlining. */
    "--ring": { kind: "alpha", ref: solidRef("primary"), a: { dark: 0.4, light: 0.3 } },

    /* Half brand glow, half neutral drop. The drop is NOT scaled by intensity:
       it is a depth cue, and a flat-corporate brand still needs to know which
       card is lifted. */
    "--shadow-card-hover": {
      kind: "shadow",
      ref: markRef("primary"),
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
    "--shadow-card": literal(
      "0 0 0 1px rgba(255, 255, 255, 0.03), 0 4px 24px rgba(0, 0, 0, 0.30)",
      "0 1px 2px rgba(15, 23, 42, 0.10), 0 6px 20px rgba(15, 23, 42, 0.10)",
    ),
    "--shadow-elevated": literal(
      "0 0 0 1px rgba(255, 255, 255, 0.05), 0 14px 44px rgba(0, 0, 0, 0.48)",
      "0 2px 6px rgba(15, 23, 42, 0.12), 0 16px 40px rgba(15, 23, 42, 0.18)",
    ),
    "--shadow-dropdown": literal(
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

    /* THREE AVATAR SWEEPS, and the reason there are three is that they are not
       interchangeable — each trades a different thing away, and the sheet names
       the trade instead of picking one and hiding the other two.

       All three are decorative identity, not action surfaces, which is what
       makes a start stop off the seed permissible here at all (see AVATAR_FROM).
       Every one of them ends on `--primary-solid`, so the avatar reads as the
       brand's primary rather than as a primary/accent blend.

         --gradient-avatar    contrast-floored start -> primary.
                              Legible on a dark-seeded brand, FLAT on a brand
                              whose seed already clears the floor (think).
         --gradient-avatar-2  primary -> primary hover.
                              The only one legible on every brand BY
                              CONSTRUCTION, and the only one whose sweep is a
                              sheen rather than a step. Byte-identical to
                              `--gradient-primary` — see its own note.
         --gradient-avatar-3  fixed-distance lightened start -> primary.
                              A real step on every brand, at the cost of the
                              same sub-AA trough --gradient-avatar has.

       The start stops are their own tokens because they are the only fills in
       the catalogue that are not their family's seed, and a gradient silently
       disagreeing with `--primary-solid` with nothing naming the difference is
       worse than one extra token. */
    "--gradient-avatar-from": { kind: "solid", ref: AVATAR_FROM },
    "--gradient-avatar": literal(
      "linear-gradient(135deg, var(--gradient-avatar-from), var(--primary-solid))",
    ),
    "--gradient-avatar-ink": {
      kind: "ink",
      over: sweepSamples(AVATAR_FROM, solidRef("primary")),
      candidates: [FILL_INK, FILL_WHITE],
    },

    /* Both stops are the primary family's own solid pair, so this token's value
       is `--gradient-primary`'s value, exactly, in every preset. That is not an
       oversight to be deduplicated away: `--gradient-primary` is the CTA fill
       and this is the avatar mark, and folding them into one name is how a
       later "make the avatar quieter" turns into a restyle of every primary
       button. Two names, two jobs, same value today.

       Its ink is `--primary-on-solid` by construction for the same reason —
       same backdrops, same candidates — and `property.test.ts` asserts the
       equality rather than assuming it, because a divergence would mean the
       family ink's two-point `over` is under-sampling its own hover blend. */
    "--gradient-avatar-2": literal(
      "linear-gradient(135deg, var(--primary-solid), var(--primary-solid-hover))",
    ),
    "--gradient-avatar-2-ink": {
      kind: "ink",
      over: sweepSamples(solidRef("primary"), hoverRef("primary")),
      candidates: [FILL_INK, FILL_WHITE],
    },

    "--gradient-avatar-3-from": { kind: "solid", ref: AVATAR_3_FROM },
    "--gradient-avatar-3": literal(
      "linear-gradient(135deg, var(--gradient-avatar-3-from), var(--primary-solid))",
    ),
    "--gradient-avatar-3-ink": {
      kind: "ink",
      over: sweepSamples(AVATAR_3_FROM, solidRef("primary")),
      candidates: [FILL_INK, FILL_WHITE],
    },
    "--gradient-progress": literal(
      "linear-gradient(90deg, var(--primary-solid), var(--accent-solid))",
    ),

    /* Status palette — categorical, not brand. Six states that must stay
       mutually distinguishable; rotating them off one seed makes them less so,
       not more. Deliberately NOT folded into `success`/`warning`/`danger`:
       `--status-review` and `--warning` are the same amber today and mean
       different things, and a design that ties them together makes one
       unchangeable without the other. */
    "--status-draft": literal("#94a3b8"),
    "--status-generating": literal("#a855f7"),
    "--status-review": literal("#f59e0b"),
    "--status-rubric": literal("#0ea5e9"),
    "--status-deployed": literal("#10b981"),
    "--status-closed": literal("#475569"),

    /* Header-dropdown island — a LIGHT panel in BOTH schemes by design, so none
       of it appears in the light block. This is the client-facing boundary of
       the brand: every client who says "make it all my colours" points here
       first, and the answer is no, because a control for escaping an unreadable
       brand must not be painted by it. */
    "--dd-panel-bg": literal("#ffffff"),
    "--dd-hover-bg": literal("#f8fafc"),
    "--dd-sep": literal("#f1f5f9"),
    "--dd-title": literal("#1e293b"),
    "--dd-title-em": literal("#0f172a"),
    "--dd-menu-label": literal("#334155"),
    "--dd-desc": literal("#94a3b8"),
    "--dd-muted": literal("#cbd5e1"),
    "--dd-badge": literal("#2563eb"),
    "--dd-hover-shadow": literal("0 2px 12px rgba(0, 0, 0, 0.07)"),
    "--dd-blue": literal("#2563eb"),
    "--dd-blue-bg": literal("#eff6ff"),
    "--dd-green": literal("#16a34a"),
    "--dd-green-bg": literal("#f0fdf4"),
    "--dd-amber": literal("#f59e0b"),
    "--dd-amber-bg": literal("#fffbeb"),
    "--dd-red": literal("#dc2626"),
    "--dd-red-bg": literal("#fef2f2"),
    "--dd-violet": literal("#8b5cf6"),
    "--dd-violet-bg": literal("#f5f3ff"),
    "--dd-sky": literal("#0ea5e9"),
    "--dd-sky-bg": literal("#f0f9ff"),
    "--dd-slate": literal("#64748b"),
    "--dd-slate-bg": literal("#f8fafc"),
    "--dd-cobalt": literal("#008AFF"),
    "--dd-cobalt-bg": literal("#e8f4ff"),
    "--dd-orange": literal("#f97316"),
    "--dd-orange-bg": literal("#fff7ed"),
    "--dd-online": literal("#16a34a"),
    "--dd-busy": literal("#dc2626"),
    "--dd-away": literal("#f59e0b"),
    "--dd-offline": literal("#475569"),
    "--dd-btn-border": literal("#e2e8f0"),
    "--dd-btn-label": literal("#475569"),

    /* Typography + motion */
    "--font-heading": literal(fonts.heading),
    "--font-body": literal(fonts.body),
    "--font-mono": literal(fonts.mono),
    "--ease-entrance": literal("cubic-bezier(0.16, 1, 0.3, 1)"),

    /* Fixed overlay constants — no `--white` / `--black` base exists, by design. */
    "--white-channel": literal("255 255 255"),
    "--black-channel": literal("0 0 0"),
  };
}

/* Channels are declared once, from the ABI's own pairing table, so a channel can
   never disagree with its base. The six family channels are emitted by
   `roleRules`; these are the neutral and categorical ones. */
const SHARED_CHANNEL_OF: Record<string, string> = {
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

/* ── Duties ───────────────────────────────────────────────────────────────── */

/**
 * Two duties per family, in BOTH schemes, all `enforce: "search"`.
 *
 * Twelve duties, one grammar. The catalogue this replaces had a different duty
 * list per preset — obsidian declared `--electric` in dark and the other five
 * declared nothing there, so meridian (4.44), solstice (4.42) and beacon (4.42)
 * all missed 4.5:1 on their secondary with `warnings` EMPTY. A duty nobody
 * writes cannot be searched, reported or acknowledged. Emitting the list from
 * one loop is what makes that class of gap unrepresentable.
 *
 * `"search"` throughout, not `"report"`. The incumbent's duties were report-only
 * because searching would have restyled live pages under a migration promising
 * pixel-identity. There is no incumbent here and nothing to hold still, so the
 * engine is allowed to do the job it exists for — and `acknowledged` is empty
 * as a result, rather than carrying four measured defects forward.
 *
 * The backdrop was `--surface` in both schemes, on the reasoning that
 * `background.paper` is what a Card renders and is "the stricter of the two".
 * That was measured wrong in both directions — see the block below.
 */
const WORST_BACKDROP = { dark: "--card", light: "--background" } as const;

/* THE BACKDROP IS PER-SCHEME, AND CHOOSING ONE FOR BOTH IS THE BUG THIS FIXES.
 *
 * A duty names ONE backdrop, but a button, a chip and a border land on three:
 * `--background` (the page), `--surface` (a panel) and `--card`. The worst of
 * the three is what a user actually sees, and which one is worst is decided by
 * the neutral ramp, not by the brand:
 *
 *   dark   background #0d0f1a < surface #10121c < card #12141f
 *          the brand token is LIGHTER than all three, so the LIGHTEST backdrop
 *          -- `--card` -- is the worst.
 *   light  background #f6f7fb < surface #ffffff = card #ffffff
 *          the brand token is DARKER than all three, so the DARKEST backdrop
 *          -- `--background` -- is the worst.
 *
 * Measured across 24 token x brand x scheme combinations, uniformly, with no
 * exception. Declaring both schemes against `--surface` therefore checks the
 * MIDDLE backdrop in dark and the BEST one in light, and the gap is not
 * theoretical: it shipped `--accent` at 3.17:1 on `--surface` and 2.96:1 on the
 * page for one of the two brands -- a duty reporting PASS on an outline button
 * that misses WCAG 1.4.11 by 0.04, in both packages that draw one. It was
 * caught by the host's legibility table, which has always measured the worst of
 * the three, and never by the duty that exists to prevent exactly this.
 *
 * So: four duties per family, not two. `scheme: "both"` cannot express it,
 * because "both" means one backdrop for both schemes and there is no single
 * correct one. Nothing else moves -- every other token already cleared its
 * worst backdrop, which is why this reads as one nudged hex rather than a
 * restyle. */
const dutiesFor = (f: RoleName): Duty[] => [
  {
    token: `--${f}`,
    against: WORST_BACKDROP.dark,
    min: 3.0,
    scheme: "dark",
    because: `WCAG 1.4.11 — --${f} is the non-text mark: border, icon, indicator, palette.${f}.main. In dark the worst backdrop is --card.`,
    enforce: "search",
  },
  {
    token: `--${f}`,
    against: WORST_BACKDROP.light,
    min: 3.0,
    scheme: "light",
    because: `WCAG 1.4.11 — --${f} is the non-text mark: border, icon, indicator, palette.${f}.main. In light the worst backdrop is --background.`,
    enforce: "search",
  },
  {
    token: `--${f}-text`,
    against: WORST_BACKDROP.dark,
    min: 4.5,
    scheme: "dark",
    because: `WCAG 1.4.3 — --${f}-text is the family AS body text. In dark the worst backdrop is --card.`,
    enforce: "search",
  },
  {
    token: `--${f}-text`,
    against: WORST_BACKDROP.light,
    min: 4.5,
    scheme: "light",
    because: `WCAG 1.4.3 — --${f}-text is the family AS body text. In light the worst backdrop is --background.`,
    enforce: "search",
  },
];

/* Named rather than inlined four times, so the claim above is stated once and a
   change to the neutral ramp has one place to be reflected. */


/* ── Provenance ───────────────────────────────────────────────────────────── */

/* Classified by ONE question: does this token move when a client changes a seed? */
const FIXED_PREFIXES = ["--dd-", "--status-"];
const FIXED_EXACT = new Set(["--white-channel", "--black-channel"]);
const STRUCTURAL_EXACT = new Set([
  "--fg-muted", "--fg-muted-min", "--fg-disabled", "--border", "--glass-border",
  "--glass-bg", "--glass-bg-card", "--glass-dark-bg", "--input", "--input-border",
  "--input-border-hover", "--input-disabled-bg", "--input-disabled-border",
  "--btn-outline-border", "--btn-outline-border-hover", "--btn-ghost-bg",
  "--btn-ghost-bg-hover", "--hover-overlay", "--shadow-card", "--shadow-elevated",
  "--shadow-dropdown", "--dd-hover-shadow", "--font-heading", "--font-body",
  "--font-mono", "--ease-entrance", "--radius", "--radius-chip", "--radius-card",
  "--radius-pill", "--gradient-avatar", "--gradient-avatar-2", "--gradient-avatar-3",
  "--gradient-progress",
  ...ROLE_NAMES.map((f) => `--gradient-${f}`),
]);

function classify(name: string): Provenance {
  if (FIXED_EXACT.has(name)) return "fixed";
  if (FIXED_PREFIXES.some((p) => name.startsWith(p)) && !name.endsWith("-channel")) return "fixed";
  if (name.startsWith("--status-") && name.endsWith("-channel")) return "fixed";
  if (STRUCTURAL_EXACT.has(name)) return "structural";
  return "derived";
}

/* ── Sheet order ──────────────────────────────────────────────────────────── */

/**
 * The order tokens appear in the emitted sheet, and therefore in the ABI.
 *
 * THIS EXISTS TO BREAK A CYCLE, not for tidiness. `serializeBrandCss` used to
 * order by `ROOT_TOKEN_NAMES`, and `ROOT_TOKEN_NAMES` is generated by parsing an
 * emitted sheet — so the sheet's order came from the previous sheet's order,
 * seeded once by a hand-tuned CDN file that no longer exists. Membership was
 * never circular (an unknown token is emitted in a sorted tail rather than
 * dropped), but order was, and with the fixture deleted the cycle would have
 * resolved to "alphabetical, forever". A preset declaring its own order makes
 * the whole chain acyclic: preset -> sheet -> ABI.
 *
 * The grouping is the one `/design/palette` renders, so the sheet reads in the
 * same order the documentation does: surfaces, then the six roles in full, then
 * the neutral chrome, then depth, gradients, categorical palettes and type.
 */
function sheetOrder(
  tokens: Record<string, TokenRule>,
  families: Record<string, FamilySpec>,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (...names: string[]) => {
    for (const n of names) {
      if (!seen.has(n)) {
        seen.add(n);
        out.push(n);
      }
    }
  };

  push(...Object.keys(NEUTRAL_DARK.slots));
  for (const f of ROLE_NAMES) {
    const t = families[f];
    push(...(t ? Object.keys(t.slots) : []));
    push(
      `--${f}-solid`, `--${f}-solid-hover`, `--${f}-on-solid`,
      `--${f}-bg`, `--${f}-border`, `--${f}-channel`,
    );
  }
  push(
    "--fg-muted", "--fg-muted-min", "--fg-disabled",
    "--border", "--glass-border", "--glass-bg", "--glass-bg-card", "--glass-dark-bg",
    "--input", "--input-border", "--input-border-hover",
    "--input-disabled-bg", "--input-disabled-border",
    "--btn-outline-border", "--btn-outline-border-hover",
    "--btn-ghost-bg", "--btn-ghost-bg-hover",
    "--ring", "--hover-overlay", "--topbar-bg",
    "--radius", "--radius-chip", "--radius-card", "--radius-pill",
    "--shadow-card", "--shadow-card-hover", "--shadow-elevated", "--shadow-dropdown",
  );
  push(...ROLE_NAMES.map((f) => `--glow-${f}`));
  push(...ROLE_NAMES.map((f) => `--shadow-btn-${f}`));
  push(...ROLE_NAMES.map((f) => `--gradient-${f}`));
  push(
    "--gradient-avatar-from", "--gradient-avatar", "--gradient-avatar-ink",
    "--gradient-avatar-2", "--gradient-avatar-2-ink",
    "--gradient-avatar-3-from", "--gradient-avatar-3", "--gradient-avatar-3-ink",
    "--gradient-progress",
  );

  /* Anything the factory emits that this list forgot still ships, in a sorted
     tail. A token silently missing from the sheet is the failure this whole ABI
     exists to prevent, so the fallback is "visible and last", never "dropped". */
  push(...Object.keys(tokens).sort((a, b) => a.localeCompare(b)));
  return out;
}

/* ── The factory ──────────────────────────────────────────────────────────── */

export function makePreset(cfg: PresetConfig): PresetSpec {
  const fonts = cfg.fonts ?? DEFAULT_FONTS;

  const families = Object.fromEntries(
    ROLE_NAMES.map((f) => [f, family(f, cfg.seeds[f])]),
  ) as Record<string, FamilySpec>;

  const tokens: Record<string, TokenRule> = { ...sharedRules(fonts) };
  for (const f of ROLE_NAMES) Object.assign(tokens, roleRules(f));
  for (const [channel, of] of Object.entries(SHARED_CHANNEL_OF)) {
    tokens[channel] = { kind: "channel", of };
  }

  const allNames = sheetOrder(tokens, families);

  return {
    id: cfg.id,
    name: cfg.name,
    intensity: cfg.intensity ?? 1,
    radius: cfg.radius ?? 12,
    families,
    neutral: { dark: NEUTRAL_DARK, light: NEUTRAL_LIGHT },
    tokens,
    provenance: Object.fromEntries(allNames.map((n) => [n, classify(n)])),
    duties: ROLE_NAMES.flatMap(dutiesFor),
    /* Empty, and it is meant to stay empty. Every entry here is a measured
       defect the catalogue ships knowingly; the previous one carried four. If a
       seed cannot meet its duties, the answer is a different seed or a reviewed
       acknowledgement with the number written down — never a lowered `min`. */
    acknowledged: [],
  };
}

export { NEUTRAL_DARK, NEUTRAL_LIGHT };
