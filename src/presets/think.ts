/* THINK — the default brand.
 *
 * `primary` is `#37A3FE`, the brand owner's chosen refresh of the mark's
 * rightmost chevron (previously `#0099FF`, sampled directly and stated at the
 * time as the primary focus). `secondary` is a neutral
 * slate shared with elemetrik. `success` / `warning` / `danger` are the shared
 * status hues, and `info` / `accent-green` / `accent-pink` are the three fixed
 * categorical roles, identical hex in both presets — see `ROLE_NAMES`'s doc
 * comment in `engine/ladder.ts` for why they exist as their own family rather
 * than borrowing `accent`. Everything else — the ramp shape, the neutral layer,
 * all 12 duties, every non-family token — comes from `makePreset`.
 *
 * WHY SECONDARY IS NOT FROM THE LOGO. The mark's other two colours sit 21 and
 * 130 degrees from the chevron blue. Measured in OKLCH, `#0099FF` -> `#43B0DA`
 * is 21 degrees of hue — close enough that a secondary button reads as a
 * DISABLED primary rather than a different role. Logo trios are analogous
 * gradients on purpose; a UI needs its secondary to be legible as a distinct
 * job. The resolution here is the one Linear, Stripe and Vercel ship: two brand
 * hues plus a neutral secondary, separated from primary by CHROMA (0.041 vs
 * 0.184) rather than by hue angle. That is also why one slate serves both
 * brands without either looking borrowed.
 *
 * `accent` IS `accent-green`, on purpose. `#B3D335` is think's own brand lime —
 * the same colour the fixed categorical `accent-green` role uses everywhere. A
 * preset's `accent` is free to coincide with a fixed accent when the brand hue
 * and the categorical hue are the same colour; it is not a case to deduplicate,
 * because the two tokens answer different questions ("what is THIS brand's
 * accent" vs "give me the fixed green regardless of brand") that happen to have
 * the same answer here. elemetrik's `accent` coincides with `accent-pink`
 * instead — see its own header.
 *
 * `accent` moved from `#D0E28C` (a paler, unsaturated lime sampled off the mark)
 * to `#B3D335` specifically so it COULD equal `accent-green` — a single
 * measured lime serving both jobs beats two near-identical limes that drift
 * apart the next time either is retuned.
 *
 * THE MARK AND THE BUTTON FILL ARE DIFFERENT COLOURS HERE, ON PURPOSE. `#37A3FE`
 * is bright — OKLCH L 0.698 — and white on it reads 2.68:1, so the `ink` rule
 * measured its way to the DARK label and think's primary button looked like a
 * different component from elemetrik's, whose violet carries white at 6.02:1.
 * `fillRef` in `base.ts` floors the primary SOLID FILL to `#007acd` (4.50:1
 * resting, 5.10:1 hover), at which point white wins on the numbers with the
 * candidate list untouched. Nothing is forced and nothing is acknowledged.
 *
 * What that costs, measured: dE00 14.1 between the mark and the fill. A
 * `--primary` chip beside a primary button is visibly two blues. The mark, the
 * text rungs, the borders, the glows, the focus ring and all three avatar
 * gradients keep `#37A3FE`; only the fill, its hover, the gradients built from
 * them and the measured label move. elemetrik is a byte-identical no-op — its
 * seed already clears the floor, so `sink` returns it untouched.
 *
 * The alternative that avoids the split entirely is seeding `#007ACD` itself,
 * which gives dE00 0 and needs no mechanism, at the cost of a much darker mark
 * (dark `--primary` 6.22 -> 4.15) and a near-navy `#004f84` in light mode. That
 * was considered and declined: the brand hue is the thing being chosen here,
 * and the button is the thing with the contrast obligation. `success` moved from `#10B981` (a
 * teal-leaning green) to `#4CAF50` (a warmer, more categorical green) for the
 * same reason from the other side: `success` and the status palette should not
 * be fighting `accent-green` for the same visual territory three roles away.
 *
 * WHAT THE ACCENT COSTS, MEASURED. `#B3D335` is L 0.826 — pale, though less so
 * than the previous `#D0E28C` (L 0.880). It still cannot be light-mode text at
 * its seed value, and the light window's contrast search walks `--accent` and
 * `--accent-green` down the ramp to a legible rung. Those rungs are olive, and
 * that is the honest consequence of a pale brand hue. What makes it acceptable
 * — and did not exist in the old sheet — is that `--accent-solid` (and
 * `--accent-green-solid`) is a separate token pinned to the seed in BOTH
 * schemes, so every accent chip, button and gradient still renders the logo's
 * lime. Only the text and border rungs darken.
 */
import { makePreset } from "./base";
import { flatGradient, tune } from "./tuning";
import type { PresetSpec } from "../engine/spec";

/* HAND-TUNED (2026-11, from the system-owner admin's palette page) — see
 * `tuning.ts`. Think Talent uses ONE blue for its mark, its button fill and
 * Info: `#008aff` in light, `#3aa0ff` in dark, with `#0067c7` / `#7cc0ff` as the
 * words. Secondary is navy (`#0e2a4d`, lifted to `#2b4366` as a dark-scheme
 * fill so it does not vanish on near-black). Accent is the logo lime, flat.
 * Where this contradicts the measured narrative above (the `#007acd` floored
 * fill, the olive light-mode lime), the tuning is what ships. */


const THINK_TUNING = tune({
  both: {
    "--secondary-solid": "#0e2a4d",
    "--secondary-solid-hover": "#163a66",
    "--secondary-on-solid": "#ffffff",
    "--gradient-secondary": flatGradient("secondary"),
    "--accent-solid": "#b3d335",
    "--accent-solid-hover": "#a6c333",
    "--accent-on-solid": "#ffffff",
    "--gradient-accent": flatGradient("accent"),
  },
  light: {
    "--primary": "#008aff",
    "--primary-text": "#0067c7",
    "--primary-bg": "#e8f4ff",
    "--primary-border": "rgb(0 138 255 / 0.35)",
    "--primary-channel": "0 138 255",
    "--ring": "rgb(0 138 255 / 0.4)",
    "--primary-solid": "#008aff",
    "--primary-solid-hover": "#0080ee",
    "--primary-on-solid": "#ffffff",
    "--gradient-primary": flatGradient("primary"),
    "--gradient-avatar": flatGradient("primary"),
    "--secondary": "#0e2a4d",
    "--secondary-text": "#0e2a4d",
    "--secondary-bg": "#eef1f6",
    "--secondary-border": "rgb(14 42 77 / 0.22)",
    "--secondary-channel": "14 42 77",
    "--accent": "#b3d335",
    "--accent-text": "#4a6600",
    "--accent-bg": "#edf6d3",
    "--accent-border": "rgb(179 211 53 / 0.5)",
    "--accent-channel": "179 211 53",
  },
  dark: {
    "--primary": "#3aa0ff",
    "--primary-text": "#7cc0ff",
    "--primary-bg": "rgb(58 160 255 / 0.16)",
    "--primary-border": "rgb(58 160 255 / 0.4)",
    "--primary-channel": "58 160 255",
    "--ring": "rgb(58 160 255 / 0.4)",
    "--primary-solid": "#3aa0ff",
    "--primary-solid-hover": "#2b93f5",
    "--primary-on-solid": "#ffffff",
    "--gradient-primary": flatGradient("primary"),
    "--gradient-avatar": flatGradient("primary"),
    "--secondary": "#7b8fa8",
    "--secondary-text": "#a3b1c4",
    "--secondary-bg": "rgb(123 143 168 / 0.16)",
    "--secondary-border": "rgb(123 143 168 / 0.4)",
    "--secondary-channel": "123 143 168",
    /* A navy fill disappears on a near-black page; lift it. */
    "--secondary-solid": "#2b4366",
    "--secondary-solid-hover": "#33507a",
    "--gradient-secondary": flatGradient("secondary"),
    "--accent": "#b3d335",
    "--accent-text": "#c8e063",
    "--accent-bg": "rgb(179 211 53 / 0.14)",
    "--accent-border": "rgb(179 211 53 / 0.4)",
    "--accent-channel": "179 211 53",
  },
});

export const THINK: PresetSpec = makePreset({
  id: "think",
  name: "Think",
  overrides: THINK_TUNING,
  seeds: {
    /** The brand owner's chosen primary — `#008AFF` since 2026-11-05 (was
     *  `#37A3FE`). It is also the button fill: `SOLID_WHITE_FLOOR` (2.5) sits
     *  below its 3.45:1 against white, so `fillRef` leaves it untouched and the
     *  primary label is pinned white. The header's `#37A3FE` / `#007acd` numbers
     *  describe the previous seed. */
    primary: "#008AFF",
    /** Shared neutral slate. See the header for why this is not a logo colour.
     *  The SHIPPED secondary is navy — tuned, see `THINK_TUNING`. */
    secondary: "#64748B",
    /** think's own brand lime — deliberately equal to `accent-green`. See the
     *  header for why that equality is intended, not an oversight. */
    accent: "#B3D335",
    success: "#4CAF50",
    warning: "#F59E0B",
    danger: "#F43F5E",
    /** Fixed categorical "informational" role — same hex as elemetrik's. Not a
     *  brand hue; see `ROLE_NAMES` in `engine/ladder.ts`.
     *
     *  2026-11 (tuning): the SHIPPED info is `#008aff` / `#3aa0ff` — one Think
     *  Talent blue with primary — via `SHARED_TUNING` in `tuning.ts`. The seed
     *  stays so the engine's own ledgers keep measuring what they measured.
     *
     *  2026-11-06: `#37A3FE` (was royal `#0058D4`), by request — the lighter
     *  sky blue think's primary used to be. Primary is now `#008AFF`, so the
     *  resting fills are distinct but info's HOVER fill sits dE00 4.77 from
     *  primary's resting fill — under assertion 17's 6.0 floor, recorded in
     *  `SEPARATION_ACKNOWLEDGED` in `property.test.ts`. History: `#0078D4`
     *  once collided with a floored primary at dE00 1.48, which is what
     *  assertion 17 was written for. */
    info: "#37A3FE",
    /** Fixed categorical accent — same hex as elemetrik's, and as think's own
     *  `accent` above (intended equality, see header). */
    "accent-green": "#B3D335",
    /** Fixed categorical accent — same hex as elemetrik's `accent`. A genuinely
     *  new colour for think: nothing else in this preset is pink. */
    "accent-pink": "#EE4480",
  },
});
