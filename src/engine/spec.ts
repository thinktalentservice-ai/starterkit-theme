/* The shape of a brand.
 *
 * The design decision that produced these types, stated once so nobody has to
 * re-derive it from the code:
 *
 * A COLOUR FAMILY IS A RAMP PLUS TWO WINDOWS INTO IT. Measured against the
 * shipped sheet, every one of the light scheme's family values is the dark
 * scheme's value ONE RAMP STEP DEEPER — 11 of 12 slots exactly, byte for byte
 * (`--electric-text` light = `#8b5cf6` = `--electric` dark; `--amber-brand`
 * light = `#d97706` = `--amber-deep` dark; and so on through cobalt and mint).
 * So the light scheme is not a second set of colours to author and keep in sync.
 * It is the same ramp, read one step down. That is why the light block does not
 * appear in a preset at all.
 *
 * The 12th slot is the interesting one. `--mint` advances TWO steps in light,
 * not one, because one step lands on `#8A9F2A` — 2.97:1 on a near-white surface,
 * failing WCAG 1.4.3 for its white contrastText and 1.4.11 for the focus border.
 * That is not an exception to the model; it is the model's contrast gate firing,
 * and it is declared as `lightShift: 2` with the measured ratio next to it.
 *
 * RAMP GEOMETRY IS RELATIVE, NEVER ABSOLUTE. Steps are OKLCH offsets from the
 * seed — a lightness delta, a chroma RATIO and a hue delta. Storing hexes would
 * make a preset a lookup table, and a client changing `primary` would get one
 * changed token and eleven stale ones. Storing offsets means the client's hex
 * moves the whole family and keeps the ramp's shape, which is the actual product:
 * our geometry, their colour.
 *
 * HUE IS NOT CONSTANT WITHIN A FAMILY, and pretending otherwise is why a naive
 * expander cannot reproduce this sheet. Measured, obsidian's amber ramp sweeps
 * 33 degrees from `#b45309` to `#fcd34d`; cobalt sweeps 12; mint and electric
 * sit under 3. That warm-hues-turn-yellow-as-they-lighten drift is a deliberate
 * design convention, so it is carried in the geometry as `dH` per step rather
 * than flattened away.
 */
import type { Oklch } from "../color/oklch";

/** One ramp entry, as an offset from the family seed in OKLCH. */
export type RampStep = {
  /** Lightness delta. Perceptual, so it is comparable across hues. */
  dL: number;
  /** Chroma RATIO, not a delta — a saturated seed and a muted one should scale
   *  their ramps proportionally, and a fixed delta drives muted hues negative. */
  cScale: number;
  /** Hue delta in degrees, signed, already wrapped to (-180, 180]. */
  dH: number;
};

export type FamilyGeometry = {
  /** Index 0 is the lightest entry. */
  steps: readonly RampStep[];
  /** Where the seed sits; `steps[seedIndex]` is the identity step. */
  seedIndex: number;
};

/** How many ramp steps the light scheme advances when a slot does not say. */
export const DEFAULT_LIGHT_SHIFT = 1;

export type FamilySpec = {
  /** The hex a client supplies for this role. */
  seed: string;
  geometry: FamilyGeometry;
  /** Emitted token name -> ramp index in the DARK scheme. */
  slots: Readonly<Record<string, number>>;
  /** Per-slot override of DEFAULT_LIGHT_SHIFT. For slots that must NOT move at
   *  all (a danger red the eye should not have to relearn per scheme), not for
   *  contrast corrections — those are searched, see `duties`. */
  lightShift?: Readonly<Record<string, number>>;
  /**
   * Slots that must take the same light advance as another slot.
   *
   * `--mint-dark` follows `--mint`: it is `palette.primary.dark`, and
   * `primary.dark === primary.main` collapses every hover and gradient that
   * depends on the two being distinguishable. So when `--mint` steps an extra
   * ramp position to clear its contrast duty, its companion has to step with it
   * or the pair silently converges.
   */
  lightFollow?: Readonly<Record<string, string>>;
  /** The dark-scheme twin of `lightFollow` — for a dual-mode or AAA preset
   *  whose dark-scheme duties can now search (see resolve.ts), a companion slot
   *  needs the same "step with its leader" guarantee dark side, or the identical
   *  convergence bug `lightFollow` exists to prevent reappears there instead. No
   *  preset uses this yet: obsidian's dark duties are `enforce: "report"`, not
   *  `"search"`, so its dark-scheme advance is always zero. */
  darkFollow?: Readonly<Record<string, string>>;
};

/**
 * Where a non-family token gets its colour.
 *
 * `ramp` exists separately from `slot` because several tokens deliberately do
 * NOT track their family's emitted value. `--accent-glow` in the light scheme is
 * `#8A9F2A` while `--mint` is `#6B7D20`: the glow stayed on the ramp's natural
 * light step, and only the text/border colour took the contrast bump. Expressing
 * that as "mint ramp index 2, shifted normally" is exact; expressing it as
 * "whatever `--mint` resolved to" is wrong by 12 dE00.
 */
export type ColorRef =
  /** Follow an emitted family slot, including any contrast bump it took. */
  | { k: "slot"; family: string; token: string }
  /** A raw ramp index. `shift` is how far the light scheme advances (default 1;
   *  0 means the token holds the same colour in both schemes, like `--ring`). */
  | { k: "ramp"; family: string; index: number; shift?: number }
  /** The neutral overlay. `flip` is white on dark and black on light — the
   *  alpha borders and muted inks. `white`/`black` hold in both schemes. */
  | { k: "overlay"; mode: "flip" | "white" | "black" }
  /** A colour that does not follow the brand at all. */
  | { k: "fixed"; hex: string }
  /** Different sources per scheme, e.g. `--topbar-bg` is the void in dark and
   *  the surface in light. */
  | { k: "scheme"; dark: ColorRef; light: ColorRef };

export type Scheme<T> = { dark: T; light: T };

/** One layer of a box-shadow: the geometry stays literal, the colour and alpha
 *  come from the brand. */
export type ShadowLayer = { geometry: string; alpha: number };

export type TokenRule =
  /** An opaque `#rrggbb`. */
  | { kind: "solid"; ref: ColorRef }
  /** `rgba(r, g, b, a)`. `lightLiteral` covers `--input`, which is a keyword
   *  (`transparent`) in the light scheme rather than a colour. */
  | { kind: "alpha"; ref: ColorRef; a: Scheme<number>; scaled?: boolean; lightLiteral?: string }
  /** A box-shadow whose layers share one brand colour, plus an optional literal
   *  tail for the neutral drop-shadow half. */
  | {
      kind: "shadow";
      ref: ColorRef;
      layers: Scheme<readonly ShadowLayer[]>;
      tail?: Partial<Scheme<string>>;
      scaled?: boolean;
    }
  /** Brand-independent: radii, fonts, motion, the categorical palettes, the
   *  neutral drop-shadows, and the gradient `var()` strings. */
  | { kind: "literal"; value: Scheme<string> }
  /** `R G B` for another token in the same scheme. */
  | { kind: "channel"; of: string };

/** Why a token has the value it has. The golden test reports the histogram, so
 *  "the engine reproduces the sheet" can never be read as a stronger claim than
 *  the split actually supports. */
export type Provenance = "derived" | "structural" | "fixed";

/** A contrast requirement a resolved token must meet, checked after resolution. */
export type Duty = {
  token: string;
  /** Token name of the background, or a literal hex. */
  against: string;
  min: number;
  scheme: "dark" | "light" | "both";
  /** Why this duty exists — a WCAG clause and the component that carries it. */
  because: string;
  /**
   * `"search"` — the light window advances along the ramp until this is met.
   * `"report"` — the duty is measured and warned about, never acted on.
   *
   * Required, with no default, because the default is the decision. A duty that
   * silently searched would have darkened obsidian's `warning` and `error` from
   * `#d97706`/`#f43f5e` to `#b45309`/`#e11d48` — correct by WCAG, and a visible
   * restyle of every contained warning and error button in the app, shipped
   * under a migration whose whole promise is that nothing moves. Those two are
   * `"report"` plus an acknowledgement carrying the measured ratio, so the
   * defect is enumerated rather than either hidden or fixed by surprise. A NEW
   * preset should use `"search"` throughout: the debt is the incumbent's, not
   * the engine's.
   */
  enforce: "search" | "report";
};

/** A duty the preset knowingly ships unmet, with the measured number. CI fails
 *  on any UNLISTED failure, and equally on a listed one that now passes — an
 *  acknowledgement nobody removed is how a fixed bug gets re-introduced. */
export type AcknowledgedFailure = {
  token: string;
  scheme: "dark" | "light";
  /** The ratio measured at the time of writing, so drift is visible. */
  measured: number;
  reason: string;
};

export type BrandWarning = {
  token: string;
  scheme: "dark" | "light";
  ratio: number;
  min: number;
  against: string;
  message: string;
};

export type PresetSpec = {
  id: string;
  name: string;
  /** 0..1 — scales the COLOURED glow/shadow alphas only. 0 is a flat corporate
   *  look; it never touches the neutral drop-shadows, which are depth cues
   *  rather than brand. */
  intensity: number;
  /** `--radius`; the chip and card radii step off it. */
  radius: number;
  families: Readonly<Record<string, FamilySpec>>;
  /** Per-scheme neutral seeds and the surface/text offsets from them. */
  neutral: Scheme<{ seed: string; slots: Readonly<Record<string, RampStep>> }>;
  /** Everything that is not a family slot. */
  tokens: Readonly<Record<string, TokenRule>>;
  provenance: Readonly<Record<string, Provenance>>;
  duties: readonly Duty[];
  acknowledged: readonly AcknowledgedFailure[];
};

export type ResolvedBrand = {
  id: string;
  /** Every `:root` token, resolved. */
  dark: Map<string, string>;
  /** Every light-scheme token, resolved — the full set, not just the overrides.
   *  `serializeBrandCss` emits only the ones that differ. */
  light: Map<string, string>;
  warnings: readonly BrandWarning[];
  provenance: Readonly<Record<string, Provenance>>;
};

export type { Oklch };
