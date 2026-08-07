/* The curated preset catalogue.
 *
 * Presets are hand-authored and contrast-tested, not generated. The engine's job
 * is to stop a client's single colour change from producing a half-branded UI;
 * choosing which six combinations we SELL is a design decision, and a generator
 * that invents them would be selling arithmetic.
 */
import type { PresetSpec } from "../engine/spec";
import { OBSIDIAN } from "./obsidian";

export const PRESET_IDS = [
  "obsidian",
  "meridian",
  "solstice",
  "beacon",
  "graphite",
  "atlas",
] as const;

export type PresetId = (typeof PRESET_IDS)[number];

const ID_SET: ReadonlySet<string> = new Set(PRESET_IDS);

export function isPresetId(value: string): value is PresetId {
  return ID_SET.has(value);
}

/** Shipped presets. Five of the six land in phase 5; a caller must handle a
 *  missing id rather than assume the catalogue is complete. */
export const PRESETS: Partial<Record<PresetId, PresetSpec>> = {
  obsidian: OBSIDIAN,
};

export { OBSIDIAN };
