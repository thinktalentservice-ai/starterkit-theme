/* ELEMETRIK — the second brand.
 *
 * Exactly TWO brand seeds differ from `think`: `primary` and `accent`. `info`,
 * `accent-green` and `accent-pink` are the three fixed categorical roles and are
 * byte-identical across both presets by design — see `ROLE_NAMES`'s doc comment
 * in `engine/ladder.ts`. `secondary` / `success` / `warning` / `danger` are also
 * shared. Everything that is not a seed comes from `makePreset`. That is the
 * mechanical form of "the same component code works with both themes" — there
 * is no per-theme branch anywhere for a component to trip over, because there
 * is nothing per-theme to branch on.
 *
 * `primary` is the elemetrik mark's violet, sampled directly. `accent` is
 * `#EE4480` — chosen, not sampled (the mark is monochrome violet) — and it is
 * deliberately the SAME hex as the fixed categorical `accent-pink` role. Same
 * reasoning as think's `accent == accent-green`: elemetrik's own brand accent
 * and the fixed "pink" categorical happen to be the same colour, so the two
 * tokens agree rather than shipping two near-identical pinks that drift apart
 * on the next retune.
 *
 * `accent` moved here from `#06B6D4` (a chosen cyan, 69 degrees from primary)
 * to `#EE4480` specifically so it could equal `accent-pink`. `success` moved
 * from `#10B981` to `#4CAF50` for the same reason `think` did — see its header.
 *
 * IT WAS `#22D3EE` FOR THE OLD CYAN ACCENT — one Tailwind step lighter — AND
 * THAT SEED COLLAPSED THE FAMILY. At L 0.797 it is very light, and in LIGHT
 * mode the whole family walks downward: `--accent` searches for 3.0:1 and
 * `--accent-text` for 4.5:1, from ramp rungs one step apart. Cyan at that
 * lightness has almost no room between those two rungs, so both searches
 * terminated on the SAME hex, `#267b89`. Two declared steps, one rendered
 * colour — every contrast check passes on a collapse, which is why the
 * invariant that caught it is strict ORDERING rather than any ratio. This
 * history is kept because it is why `#22D3EE` was never a candidate when
 * `accent` was re-picked for the `accent-pink` equality either: a pale seed is
 * a pale seed regardless of which fixed role it is chosen to match.
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
import { tune } from "./tuning";
import type { PresetSpec } from "../engine/spec";

/* HAND-TUNED (2026-11, from the system-owner admin's palette page) — see
 * `tuning.ts`. Violet primary (`#6835ff` fill in both schemes, `#8a63ff` as the
 * dark mark), pink accent (`#d42a68` fill), aubergine secondary (`#1f1442`,
 * lifted to `#3a2c6e` as a dark fill). Info stays the shared Think Talent blue.
 * Where this contradicts the measured narrative above, the tuning ships. */
const flat = (hex: string): string => `linear-gradient(${hex}, ${hex})`;

const ELEMETRIK_TUNING = tune({
  both: {
    "--primary-solid": "#6835ff",
    "--primary-solid-hover": "#5a27ee",
    "--primary-on-solid": "#ffffff",
    "--gradient-primary": flat("#6835ff"),
    "--gradient-avatar": flat("#6835ff"),
    "--accent-solid": "#d42a68",
    "--accent-solid-hover": "#bb2059",
    "--accent-on-solid": "#ffffff",
    "--gradient-accent": flat("#d42a68"),
    "--secondary-on-solid": "#ffffff",
  },
  light: {
    "--primary": "#6835ff",
    "--primary-text": "#4b1fcc",
    "--primary-bg": "#f1ecff",
    "--primary-border": "rgb(104 53 255 / 0.35)",
    "--primary-channel": "104 53 255",
    "--ring": "rgb(104 53 255 / 0.4)",
    "--accent": "#e93574",
    "--accent-text": "#b4205a",
    "--accent-bg": "#fde8f0",
    "--accent-border": "rgb(233 53 116 / 0.35)",
    "--accent-channel": "233 53 116",
    "--secondary": "#1f1442",
    "--secondary-text": "#1f1442",
    "--secondary-bg": "#f1eef8",
    "--secondary-border": "rgb(31 20 66 / 0.22)",
    "--secondary-channel": "31 20 66",
    "--secondary-solid": "#1f1442",
    "--secondary-solid-hover": "#2c1d5c",
    "--gradient-secondary": flat("#1f1442"),
  },
  dark: {
    "--primary": "#8a63ff",
    "--primary-text": "#a58aff",
    "--primary-bg": "rgb(138 99 255 / 0.18)",
    "--primary-border": "rgb(138 99 255 / 0.4)",
    "--primary-channel": "138 99 255",
    "--ring": "rgb(138 99 255 / 0.4)",
    "--accent": "#ee4f86",
    "--accent-text": "#f27aa3",
    "--accent-bg": "rgb(238 79 134 / 0.16)",
    "--accent-border": "rgb(238 79 134 / 0.4)",
    "--accent-channel": "238 79 134",
    "--secondary": "#8a7fb0",
    "--secondary-text": "#b0a8cc",
    "--secondary-bg": "rgb(138 127 176 / 0.16)",
    "--secondary-border": "rgb(138 127 176 / 0.4)",
    "--secondary-channel": "138 127 176",
    /* An aubergine fill disappears on a near-black page; lift it. */
    "--secondary-solid": "#3a2c6e",
    "--secondary-solid-hover": "#45357f",
    "--gradient-secondary": flat("#3a2c6e"),
  },
});

export const ELEMETRIK: PresetSpec = makePreset({
  id: "elemetrik",
  name: "Elemetrik",
  overrides: ELEMETRIK_TUNING,
  seeds: {
    /** The elemetrik mark's violet, sampled directly. The SHIPPED fill is
     *  `#6835ff` — tuned, see `ELEMETRIK_TUNING`. */
    primary: "#6832FF",
    /** Shared neutral slate — identical to think's. The SHIPPED secondary is
     *  aubergine — tuned, see `ELEMETRIK_TUNING`. */
    secondary: "#64748B",
    /** Chosen, not sampled: the mark is monochrome. Deliberately equal to
     *  `accent-pink` — see the header for why. NOT the lighter `#22D3EE` this
     *  seed used to be, and NOT the old `#06B6D4` cyan either — see the header. */
    accent: "#EE4480",
    success: "#4CAF50",
    warning: "#F59E0B",
    danger: "#F43F5E",
    /** Fixed categorical "informational" role — same hex as think's. Not a
     *  brand hue; see `ROLE_NAMES` in `engine/ladder.ts`.
     *
     *  2026-11 (tuning): the SHIPPED info is the shared Think Talent blue
     *  (`#008aff` / `#3aa0ff`) via `SHARED_TUNING`; the seed is unchanged.
     *
     *  2026-11-06: `#37A3FE`, by request, in both presets (the role is one hex
     *  everywhere). Against elemetrik's violet primary it is far apart; its
     *  cost here is `--gradient-primary-info`, which troughs at 3.18 on the
     *  violet start stop — see the ledger in `property.test.ts`. */
    info: "#37A3FE",
    /** Fixed categorical accent — same hex as think's, and as think's own
     *  `accent`. A genuinely new colour for elemetrik: nothing else in this
     *  preset is this green. */
    "accent-green": "#B3D335",
    /** Fixed categorical accent — same hex as think's, and as elemetrik's own
     *  `accent` above (intended equality, see header). */
    "accent-pink": "#EE4480",
  },
});
