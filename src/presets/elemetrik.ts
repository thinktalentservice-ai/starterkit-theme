/* ELEMETRIK — the second brand.
 *
 * Exactly TWO seeds differ from `think`: `primary` and `accent`. The other four
 * are byte-identical, and everything that is not a seed comes from `makePreset`.
 * That is the mechanical form of "the same component code works with both
 * themes" — there is no per-theme branch anywhere for a component to trip over,
 * because there is nothing per-theme to branch on.
 *
 * `primary` is the elemetrik mark's violet, sampled directly. `accent` is a
 * chosen cyan, not a logo colour — the mark is monochrome violet, so the second
 * brand hue was free. `#22D3EE` sits 73 degrees from the violet in OKLCH, which
 * is far enough to read as a different role and close enough to stay in the same
 * cool family.
 *
 * WHAT THE VIOLET COSTS, MEASURED. `#6832FF` is L 0.531 — dark for a brand hue.
 * On the dark `--surface` it reads 3.10:1, which clears its own 3.0 mark duty by
 * 0.10 and is genuinely thin; one rung lighter (`#6D56FF`) is 3.93:1, which
 * misses the 4.5 text duty, so `--primary-text` searches one further to
 * `#7E79EE` at 5.20:1. In light it goes the other way and lands deep: `--primary`
 * is `#3F0EAD` at 11.18:1 and `--primary-text` is `#260070` at 15.95:1 — both
 * comfortably legible, both visibly darker than the logo.
 *
 * The logo violet itself is never lost, because `--primary-solid` is pinned to
 * the seed in both schemes: buttons, chips and gradients render `#6832FF`
 * exactly, with a measured white label at 6.02:1. The old catalogue could not do
 * this — it lifted the SEED via `darkFloor` to rescue the same rung, which moved
 * the brand colour itself and then needed `--brand-fill` invented to pin it
 * back. Splitting text from mark removes the need for either.
 */
import { makePreset } from "./base";
import type { PresetSpec } from "../engine/spec";

export const ELEMETRIK: PresetSpec = makePreset({
  id: "elemetrik",
  name: "Elemetrik",
  seeds: {
    /** The elemetrik mark's violet, sampled directly. */
    primary: "#6832FF",
    /** Shared neutral slate — identical to think's. */
    secondary: "#64748B",
    /** Chosen, not sampled: the mark is monochrome. 73 degrees from primary. */
    accent: "#22D3EE",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#F43F5E",
  },
});
