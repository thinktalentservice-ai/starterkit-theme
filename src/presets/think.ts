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
import type { PresetSpec } from "../engine/spec";

export const THINK: PresetSpec = makePreset({
  id: "think",
  name: "Think",
  seeds: {
    /** The brand owner's chosen primary. See the header for why the BUTTON does
     *  not render this hex and `--primary-solid` is `#007acd` instead. */
    primary: "#37A3FE",
    /** Shared neutral slate. See the header for why this is not a logo colour. */
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
     *  ROYAL, NOT AZURE, AND THE ROTATION IS THE WHOLE POINT. This was `#0078D4`
     *  and it collided with THIS preset's primary button: `fillRef` floors
     *  `--primary-solid` to `#007acd`, and `#0078D4` is what a floored azure
     *  converges on, so the two fills measured dE00 1.48 (hover 1.09) — under
     *  the ~2.3 just-noticeable difference, i.e. one colour. Rotating the hue
     *  from 251 to 260 at the same lightness takes the pair to 12.99 and lifts
     *  the palette's tightest cross-role pair from 1.09 to 6.79. See
     *  assertion 17 in `property.test.ts`, which is what now measures this. */
    info: "#0058D4",
    /** Fixed categorical accent — same hex as elemetrik's, and as think's own
     *  `accent` above (intended equality, see header). */
    "accent-green": "#B3D335",
    /** Fixed categorical accent — same hex as elemetrik's `accent`. A genuinely
     *  new colour for think: nothing else in this preset is pink. */
    "accent-pink": "#EE4480",
  },
});
