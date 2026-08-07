/* The curated preset catalogue.
 *
 * Presets are hand-authored and contrast-tested, not generated. The engine's job
 * is to stop a client's single colour change from producing a half-branded UI;
 * choosing which six combinations we SELL is a design decision, and a generator
 * that invents them would be selling arithmetic.
 */
import type { PresetSpec } from "../engine/spec";
import { OBSIDIAN } from "./obsidian";
import { MERIDIAN } from "./meridian";
import { SOLSTICE } from "./solstice";
import { BEACON } from "./beacon";
import { GRAPHITE } from "./graphite";
import { ATLAS } from "./atlas";

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

/** Shipped presets. All six land as of phase 5b; a caller must still handle a
 *  missing id rather than assume the catalogue can only grow. */
export const PRESETS: Partial<Record<PresetId, PresetSpec>> = {
  obsidian: OBSIDIAN,
  meridian: MERIDIAN,
  solstice: SOLSTICE,
  beacon: BEACON,
  graphite: GRAPHITE,
  atlas: ATLAS,
};

export { OBSIDIAN, MERIDIAN, SOLSTICE, BEACON, GRAPHITE, ATLAS };
