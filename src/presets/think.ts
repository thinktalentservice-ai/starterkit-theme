/* THINK — the default brand.
 *
 * `primary` is sampled from the think mark: the rightmost chevron (`#0099FF`,
 * stated by the brand owner as the primary focus). `secondary` is a neutral
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
 * apart the next time either is retuned. `success` moved from `#10B981` (a
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
    /** The mark's rightmost chevron — the stated primary focus. */
    primary: "#0099FF",
    /** Shared neutral slate. See the header for why this is not a logo colour. */
    secondary: "#64748B",
    /** think's own brand lime — deliberately equal to `accent-green`. See the
     *  header for why that equality is intended, not an oversight. */
    accent: "#B3D335",
    success: "#4CAF50",
    warning: "#F59E0B",
    danger: "#F43F5E",
    /** Fixed categorical "informational" role — same hex as elemetrik's. Not a
     *  brand hue; see `ROLE_NAMES` in `engine/ladder.ts`. */
    info: "#0078D4",
    /** Fixed categorical accent — same hex as elemetrik's, and as think's own
     *  `accent` above (intended equality, see header). */
    "accent-green": "#B3D335",
    /** Fixed categorical accent — same hex as elemetrik's `accent`. A genuinely
     *  new colour for think: nothing else in this preset is pink. */
    "accent-pink": "#EE4480",
  },
});
