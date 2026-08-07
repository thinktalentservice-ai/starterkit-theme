/* Preset catalogue.
 *
 * A preset is a combination STRATEGY, not a hue. Each one is hand-authored and
 * contrast-tested; the engine only expands a seed into its family so that
 * moving one colour can never leave the UI half-branded. Seeds land in phase 4
 * (obsidian, gated by the golden test) and phase 5 (the remaining five). */

export const PRESET_IDS = [
  /** The incumbent. Dark-first neon-on-ink, lime x violet complement.
   *  The starterkit's current look — reproduced exactly, or the engine is wrong. */
  "obsidian",
  /** Banks, insurers, enterprise SaaS. Light-first single-hue analogous, glows off. */
  "meridian",
  /** Media, education, D2C. Warm split-complementary on paper neutral, serif headings. */
  "solstice",
  /** Government, healthcare, VPAT tenders. AAA contrast target, flat surfaces. */
  "beacon",
  /** Dev tools, infra dashboards. Monochrome + one saturated accent. */
  "graphite",
  /** Logistics, industrial B2B. Deep teal — the "not-blue enterprise". */
  "atlas",
] as const;

export type PresetId = (typeof PRESET_IDS)[number];

const PRESET_ID_SET: ReadonlySet<string> = new Set(PRESET_IDS);

/** Guard for the `preset` field of an incoming brand document. */
export function isPresetId(id: string): id is PresetId {
  return PRESET_ID_SET.has(id);
}
