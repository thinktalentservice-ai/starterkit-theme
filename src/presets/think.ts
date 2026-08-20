/* THINK — the default brand.
 *
 * `primary` and `accent` are sampled from the think mark: the rightmost chevron
 * (`#0099FF`, stated by the brand owner as the primary focus) and the pale lime
 * (`#D0E28C`). `secondary` is a neutral slate shared with elemetrik, and
 * `success` / `warning` / `danger` are the shared status hues. Everything else —
 * the ramp shape, the neutral layer, all 12 duties, every non-family token —
 * comes from `makePreset`.
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
 * WHAT THE ACCENT COSTS, MEASURED. `#D0E28C` is L 0.880 — very pale. It reads
 * 1.41:1 on white, so it can never be light-mode text at its seed value, and the
 * light window's contrast search walks `--accent` to `#828D59` (3.56:1) and
 * `--accent-text` to `#6B7349` (5.03:1). Those are olive, and that is the honest
 * consequence of a pale brand hue. What makes it acceptable here — and did not
 * exist in the old sheet — is that `--accent-solid` is a separate token pinned
 * to the seed in BOTH schemes, so every accent chip, button and gradient still
 * renders the logo's lime. Only the text and border rungs darken. The previous
 * catalogue had no such split and shipped its light `--accent-text` at 1.71:1 as
 * a written-down, illegible defect.
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
    /** The mark's pale lime. */
    accent: "#D0E28C",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#F43F5E",
  },
});
