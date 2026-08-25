/* THE LADDER — one ramp shape, six roles, two brands.
 *
 * This file is the "one shape for all families" decision, in code. It carries no
 * hue and belongs to no brand: it is the RELATIVE geometry every colour family
 * in every preset is built from, plus the handful of constants that turn a ramp
 * into the role tokens a component may reference.
 *
 * WHY ONE GEOMETRY AND NOT FIVE. The sheet this package replaced had five
 * different family shapes — `mint` was soft/text/main/dark, `electric` was
 * light/text/main/deep, `cobalt` had five rungs, `amber` four, `rose` two. So
 * "give me the darker step of this colour" had a different answer per family,
 * and a component could not be written once and re-toned. Every family here is
 * the same seven-rung ramp read through the same two windows, so `tone="danger"`
 * and `tone="primary"` are the same code path with a different seed.
 *
 * WHY THE REFERENCE IS WRITTEN AS HEXES. The engine works in relative OKLCH
 * offsets — that is what lets one client hex move a whole family — but nobody
 * can review `{ dL: 0.1048, cScale: 0.6268, dH: -1.766 }`. They can review
 * `#76BCFB`. So the shape is authored as the colours it actually is, in the
 * default brand's own hue, and `measureGeometry` converts it at module load.
 * The conversion is exact and is asserted rather than asserted-by-comment:
 * `buildRamp("#0099FF", LADDER)` returns `LADDER_REFERENCE` byte for byte.
 *
 * PROVENANCE OF THE SHAPE. These offsets are the incumbent sheet's own lime
 * ramp — months of hand-tuning by a person with a contrast meter open — carried
 * forward and re-expressed in think's blue. Two things changed, both measured: a
 * SEVENTH rung was extrapolated from the last two steps, because the light
 * window now searches two rungs deeper than the old sheet's did and a ramp that
 * stops at the window's edge CLAMPS (silently handing light mode the same hex
 * twice); and the hue drift is inherited rather than flattened, because warm
 * hues turning yellow as they lighten is a design convention, not noise.
 */
import { measureGeometry } from "./ramp";
import type { ColorRef, FamilyGeometry } from "./spec";

/* ── The shape ────────────────────────────────────────────────────────────── */

/** The ladder, lightest first, in think's primary blue.
 *
 *  Index 2 is the seed — the hex a brand actually supplies. Indices 0-1 are the
 *  dark scheme's window (a brand colour on a near-black surface must be LIGHT);
 *  indices 3-4 are the light scheme's (on white it must be DARK); 5-6 are the
 *  headroom the light contrast search walks into for a pale seed. */
export const LADDER_REFERENCE = [
  "#76BCFB",
  "#40AAFF",
  "#0099FF",
  "#006CB2",
  "#004D83",
  "#00375E",
  "#00213C",
] as const;

/** `LADDER_REFERENCE[LADDER_SEED_INDEX]` is the identity step. */
export const LADDER_SEED_INDEX = 2;

/** The relative geometry every family in every preset inherits. */
export const LADDER: FamilyGeometry = measureGeometry(LADDER_REFERENCE, LADDER_SEED_INDEX);

/* ── The two windows ──────────────────────────────────────────────────────── */

/**
 * The dark-scheme ramp index each emitted slot reads.
 *
 * Only two slots are emitted per family, and both are needed:
 *
 *   `--<f>-text`  the family AS TEXT on `--surface`. Owes 4.5:1 (WCAG 1.4.3).
 *   `--<f>`       the family as a NON-TEXT mark — border, icon, indicator,
 *                 `palette.<f>.main`. Owes 3.0:1 (WCAG 1.4.11).
 *
 * Splitting them is much of the point of the rename. The old sheet had one
 * `--mint` doing both jobs, so it was solved for the stricter one and then spent
 * on fills, which is how a lime brand rendered olive. Here the fill is a third
 * thing (`--<f>-solid`, below) that does not darken at all.
 */
export const ROLE_SLOTS = { text: 1, main: 2 } as const;

/**
 * How far the light scheme advances each slot.
 *
 * THE TWO SLOTS SWAP ORDER BETWEEN SCHEMES, AND THAT IS THE DESIGN. On a
 * near-black surface the text rung must be LIGHTER than the mark; on white it
 * must be DARKER. One ramp cannot satisfy both by shifting uniformly, so `main`
 * takes the default one-step advance (2 -> 3) and `text` takes three (1 -> 4),
 * crossing over it.
 *
 * Measured, with `#0099FF`: dark reads `#40AAFF` (7.48:1) for text and `#0099FF`
 * (6.22:1) for the mark; light reads `#004D83` (8.79:1) and `#006CB2` (5.54:1).
 * Both schemes satisfy both duties with the mark and the text distinct, which a
 * uniform shift cannot do — at shift 1 the light text rung lands on `#0099FF`,
 * 3.00:1 on white, and the contrast search then walks it straight onto the mark.
 */
export const ROLE_LIGHT_SHIFT = { text: 3, main: 1 } as const;

/* ── Fills ────────────────────────────────────────────────────────────────── */

/** The two candidate inks. Ink first, so a tie prefers the dark label. */
export const FILL_INK: ColorRef = { k: "fixed", hex: "#0b0f19" };
export const FILL_WHITE: ColorRef = { k: "fixed", hex: "#ffffff" };

/**
 * The contrast a SOLID FILL owes WHITE, so that white is the ink the `ink` rule
 * measures its way to.
 *
 * NOT A PREFERENCE FOR WHITE — a floor on the backdrop, applied by `fillRef` in
 * `presets/base.ts` and expressed as a `sink` ColorRef. The candidate list is
 * untouched; the fill moves under it and white wins on the numbers.
 *
 * 4.5 IS TWO THINGS AT ONCE AND BOTH ARE LOAD-BEARING. It is WCAG 2.2 SS1.4.3
 * for the label itself, and it is above the ratio at which the two candidate
 * inks are equally legible against the same fill:
 *
 *     crossover = 1.05 / sqrt(1.05 * (L(FILL_INK) + 0.05)) = 4.376
 *
 * Any colour satisfying a floor ABOVE that crossover necessarily scores higher
 * with white than with `FILL_INK`, so the floor cannot be satisfied and still
 * leave the ink dark. Below it the mechanism silently stops working — the fill
 * darkens, the label stays dark, and nothing fails. `property.test.ts` derives
 * the crossover from `FILL_INK` and asserts this constant exceeds it, rather
 * than restating 4.376 as a number that would go stale the moment `FILL_INK`
 * moves.
 *
 * MEASURED, on the two shipped seeds:
 *
 *     think      #37a3fe -> #007acd   white 4.50 resting / 5.10 hover
 *     elemetrik  #6832ff -> #6832ff   white 6.02 resting — untouched, no-op
 *
 * The margin over the crossover is 0.124, which is thin and is the price of
 * pinning the floor to the AA threshold rather than to a number chosen to feel
 * safe. Raising it would darken the fill further for no accessibility gain.
 */
export const SOLID_WHITE_FLOOR = 4.5;

/**
 * The fraction of the way a solid fill moves toward ink on hover.
 *
 * SET BY THE INK, NOT BY TASTE. `--<f>-on-solid` is one measured label that has
 * to stay legible on BOTH the resting fill and the hovered one, and the `ink`
 * rule scores on the worse of the two — so a bigger hover step is paid for out
 * of the label's contrast. Swept over all eight seeds the two shipped presets
 * use, reporting the worst `--<f>-on-solid` across the pair:
 *
 *     t        0.08   0.10   0.12   0.14   0.16   0.20
 *     danger   4.53   4.39   4.23   4.07   3.94   3.67
 *     primary  5.56   5.34   5.14   5.00   4.80   4.43
 *
 * `danger` (`#F43F5E`) is the binding constraint — it is the one seed whose ink
 * and white candidates are both mediocre, so it has the least to give. 0.08 is
 * the largest step that keeps every family at or above 4.5:1, and it is chosen
 * for that reason rather than for looking right.
 *
 * It is still a visible change: dE00 2.77-4.09 across the eight seeds, against a
 * just-noticeable difference of ~1. A hover nobody can see would be the other
 * way to fail this.
 */
export const HOVER_MIX = 0.08;

/* ── Roles ────────────────────────────────────────────────────────────────── */

/**
 * The nine families, in the order they appear in the sheet and on `/design/palette`.
 *
 * These are JOB NAMES, not hue names, and the list is closed. A new role is a
 * design decision with a component API behind it, not a colour someone liked —
 * which is how the sheet this replaced accumulated `--sky`, `--cyan`, `--pink`
 * and `--terminal-green`, four families nothing brandable ever drove.
 *
 * It grew from six to nine for three named jobs, not because the ceiling moved:
 *
 *   `info`          — a genuine MUI/Bootstrap "informational" intention. It used
 *                      to be backed by `--accent`, which collided the brand's own
 *                      accent hue with a categorical status colour that has to
 *                      read the same regardless of which brand is active. `info`
 *                      is now its own family, with the same hex (`#0058D4`) in
 *                      both presets — the one deliberately NON-brand-varying role
 *                      besides the status palette. It was `#0078D4` until that
 *                      azure landed dE00 1.48 from think's floored primary fill;
 *                      being preset-invariant, it had to move for BOTH presets to
 *                      fix one. See think.ts and assertion 17.
 *   `accent-green`  / `accent-pink` — fixed categorical accents, identical in
 *                      every preset (`#B3D335` / `#EE4480`), for call sites that
 *                      need a specific green or pink regardless of brand — a
 *                      chart series, a badge colour — rather than "the brand's
 *                      accent, whatever hue that happens to be". A preset's own
 *                      `accent` is free to coincide with one of the two (think's
 *                      accent IS `accent-green`; elemetrik's IS `accent-pink`) —
 *                      that overlap is intended, not a bug to deduplicate away.
 *
 * The warning stands for whatever comes after these three: a role is earned by a
 * component API, not added because a hex looked good.
 */
export const ROLE_NAMES = [
  "primary",
  "secondary",
  "accent",
  "success",
  "warning",
  "danger",
  "info",
  "accent-green",
  "accent-pink",
] as const;

export type RoleName = (typeof ROLE_NAMES)[number];

/**
 * The eight token names a role emits.
 *
 * `main` is a token in its own right and not merely a slot: `--<f>` is the
 * non-text mark, `--<f>-channel` pairs with it, and `--<f>-bg` / `--<f>-border`
 * are alphas OF it. It is also structurally forced — the resolver emits every
 * declared family slot, so a slot cannot be internal-only.
 */
export const roleTokens = (f: RoleName) =>
  ({
    main: `--${f}`,
    text: `--${f}-text`,
    solid: `--${f}-solid`,
    solidHover: `--${f}-solid-hover`,
    onSolid: `--${f}-on-solid`,
    bg: `--${f}-bg`,
    border: `--${f}-border`,
    channel: `--${f}-channel`,
  }) as const;
