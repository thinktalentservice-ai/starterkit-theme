/* The curated preset catalogue — two brands.
 *
 * Presets are hand-authored and contrast-tested, not generated. The engine's job
 * is to stop a client's single colour change from producing a half-branded UI;
 * choosing which combinations we SELL is a design decision, and a generator that
 * invented them would be selling arithmetic.
 *
 * What IS generated is everything the two share, which is everything but two
 * hexes — see `base.ts`. The six-preset catalogue this replaces was six
 * hand-copied files, and the copies drifted: five different dark-duty lists,
 * three presets shipping a measured 4.42:1 secondary with `warnings` empty.
 */
import type { PresetSpec } from "../engine/spec";
import { THINK } from "./think";
import { ELEMETRIK } from "./elemetrik";

export const PRESET_IDS = ["think", "elemetrik"] as const;

export type PresetId = (typeof PRESET_IDS)[number];

/**
 * The brand a consumer gets when it does not choose one.
 *
 * Named rather than left as `PRESET_IDS[0]`, because "the default" is asserted
 * in four places outside this package — the host's root layout imports
 * `presets/<id>.css`, its brand document validator defaults to the same id, a
 * Babel-parsing gate proves those two agree, and the CDN emitter decides which
 * sheet gets the legacy alias. A convention that lives in an array index is one
 * reorder away from moving all four without a diff anyone would read.
 */
export const DEFAULT_PRESET_ID: PresetId = "think";

const ID_SET: ReadonlySet<string> = new Set(PRESET_IDS);

export function isPresetId(value: string): value is PresetId {
  return ID_SET.has(value);
}

/** Shipped presets. A caller must still handle a missing id rather than assume
 *  the catalogue can only grow. */
export const PRESETS: Partial<Record<PresetId, PresetSpec>> = {
  think: THINK,
  elemetrik: ELEMETRIK,
};

export { THINK, ELEMETRIK };
export { makePreset, type PresetConfig, type BrandSeeds } from "./base";
