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
  /**
   * Minimum contrast the MAIN slot must reach against the dark `--surface`,
   * applied by lifting the SEED before the dark ramp is built. Dark only; the
   * light ramp is always built from the untouched seed.
   *
   * The dark window is where a client seed hurts, and a duty cannot reach it.
   * Light darkens a hue and every ramp has a dark end, so the light search
   * always has somewhere to go. The LIGHT end is capped by the seed: the shared
   * geometry carries only ~+12 L* above it, so a mid-seeded family contains no
   * bright entry AT ANY INDEX. Raising a duty's `min` just runs the search to
   * index 0 — where `--mint-soft` already lives — and three designed steps
   * collapse onto one colour. Measured before this existed: meridian, solstice
   * and beacon all rendered `-soft`, `-text` and main as the same hex, and every
   * duty check passed, because equal values clear a floor just as well as
   * distinct ones do.
   *
   * Set it strictly BELOW the incumbent's own measured ratio. Equal is
   * numerically fragile: a floor of 10.92 — obsidian's own `--mint` — moved
   * obsidian's `#b3d335` to `#b3d436`. Below it, `fitContrast` returns the seed
   * untouched and the incumbent is a no-op by construction, not by luck.
   *
   * This is a GUARANTEE and is always met (given a reachable target). Where a
   * family also declares `darkTarget`, this is the value it falls back to.
   */
  darkFloor?: number;
  /**
   * A brighter ratio to reach for when the hue can afford it, bounded by
   * `darkChromaRetention`. Above `darkFloor`, never instead of it.
   *
   * `darkFloor` alone has to be one number for every hue a client might pick,
   * so it gets set to whatever the WORST hue can afford — and then the hues
   * that could have done better are held down with it. Measured: at mint's
   * floor of 8.0, a reseeded family lands EXACTLY on 8.0, because `fitContrast`
   * walks nearest-first and stops at the first passing colour, while the
   * incumbent's lime is never lifted at all and keeps its natural 10.92. That is
   * ~35% of contrast and ~0.07 OKLCH L, at every rung of the ladder, on the one
   * colour a brand is actually recognised by.
   *
   * Splitting the two lets the floor stay the conservative promise and the
   * target state the intent. Obsidian and atlas reach 10.9; meridian, solstice,
   * beacon and graphite stop between 9.25 and 9.55 where sRGB stops them.
   */
  darkTarget?: number;
  /**
   * Fraction of the OKLCH chroma AT `darkFloor` that the climb from `darkFloor`
   * to `darkTarget` may spend (0.20 = 20%).
   *
   * Brightness is paid for in chroma and sRGB has no bright saturated red or
   * blue, so an unbounded target turns a client's brand pastel: at 10.9,
   * graphite's red and meridian's blue give up 37-39% of the chroma they render
   * today. Lime and teal pay nothing for the same brightness. One floor for
   * everyone therefore taxes the hues that could have had parity for free,
   * which is what this budget exists to stop.
   *
   * MEASURED FROM THE FLOOR, NOT FROM THE SEED, and that is not a detail. A
   * client seed usually sits far below its floor already — meridian's `#0B5FFF`
   * measures 3.56 on its own dark surface — so the floor has spent 19-48% of the
   * seed's chroma before any of this runs. A seed-relative budget therefore
   * budgets the lift that already shipped: at 20% it walked meridian backwards
   * from 8.05 to 5.06, making the brand darker than no guard at all. Anchored to
   * the floor, the floor is a promise the budget cannot cross and the worst case
   * is "no improvement".
   *
   * A near-grey seed has almost no chroma to spend, so a relative budget barely
   * constrains it — correct for a neutral, and a reason not to point an
   * ambitious `darkTarget` at a low-chroma family.
   *
   * There is no knee in this curve to tune against: contrast buys in at a
   * near-constant ~0.075 ratio points per 1pp of budget (swept 0.10-0.40 in
   * `obsidian.ts`). Whatever a preset picks is a preference at a known exchange
   * rate, so pick it deliberately and write the rate down.
   *
   * Must be finite and in (0, 1); anything else throws rather than silently
   * disabling the budget.
   */
  darkChromaRetention?: number;
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
  /** Follow an emitted family slot, including any contrast bump it took.
   *
   *  `from` pins WHICH SCHEME's value is read, in both schemes. Without it a
   *  slot ref means "this slot, in the current scheme"; with `from: "dark"` it
   *  means "the colour dark mode renders", everywhere.
   *
   *  This is not the same as `{ k: "ramp", shift: 0 }`, and the difference is
   *  load-bearing: a ramp ref pins a RAMP INDEX, so it misses any contrast bump
   *  the slot took. In presets whose duties search the dark scheme (every one
   *  but obsidian), dark `--mint` is NOT the seed index — meridian searches to
   *  `#578fef` from a `#0b5fff` seed. A fill pinned by index would silently
   *  restyle those presets' dark gradients while leaving obsidian's alone,
   *  which is precisely the bug a one-preset check does not catch. */
  | { k: "slot"; family: string; token: string; from?: SchemeName }
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
  | { k: "scheme"; dark: ColorRef; light: ColorRef }
  /** Lighten `ref` in OKLCH until it clears `min` against `against`.
   *
   *  Returns `ref` UNTOUCHED when it already passes, so adding this to a preset
   *  whose seed is already bright is a byte-identical no-op — obsidian is
   *  unaffected by construction rather than by coincidence.
   *
   *  Exists because a family's ramp may contain no bright colour AT ALL, and no
   *  index can reach a colour the ramp lacks. The shared geometry carries only
   *  ~+12 L* above its seed, so a dark-seeded preset's LIGHTEST step is still
   *  dark: meridian's whole mint ramp spans L* 60 → 8. A slot ref makes it
   *  worse, not better — the slot is the output of a contrast SEARCH, and a
   *  search satisfies a floor and stops, so every dark-seeded preset lands on
   *  the minimum passing value while obsidian's lime overshoots it by 6:1.
   *
   *  This is a FLOOR on the fill, not a target: `fitContrast` walks nearest
   *  first, so a preset moves as little as it can and keeps its own hue. */
  | { k: "lift"; ref: ColorRef; against: ColorRef; min: number }
  /** Raise `ref` by a FIXED `dl` in OKLCH L, re-clamping chroma into sRGB.
   *
   *  The deliberate opposite of `lift`, and the pair only makes sense read
   *  together. `lift` is a CONTRAST FLOOR: it walks until a ratio is met and
   *  stops, so a seed that already passes does not move at all. That no-op is
   *  the whole point there — a fill must not be restyled to satisfy a
   *  requirement it already satisfies.
   *
   *  It is also exactly why `lift` cannot express "always a lighter version of
   *  this colour". A gradient whose start stop is `lift`ed and whose end stop is
   *  the raw seed renders FLAT on any brand whose seed already clears the floor:
   *  think's `#0099ff` reads 6.38:1 against the fill ink, `AVATAR_FROM` asks for
   *  5.5, so both stops resolve to the same hex and the sweep disappears with no
   *  error anywhere. Measured on the shipped preset, not hypothesised.
   *
   *  So this rule takes a distance, not a target: every brand moves, by the same
   *  perceptual amount, and none of them can no-op. It makes no contrast claim
   *  whatsoever — whether the resulting blend is legible is the `ink` rule's
   *  question, and for a blend ending on an unlifted fill the honest answer may
   *  be "it is not", which is recorded rather than hidden.
   *
   *  `clampChroma` rather than a raw L bump: pushing L on a saturated hue walks
   *  straight out of sRGB, and an out-of-gamut OKLCH triple serialises to a hex
   *  that is not the colour asked for. Same guard `emittableRay` applies at
   *  every step of a `lift`. */
  | { k: "lighten"; ref: ColorRef; dl: number }
  /** A point ON a `linear-gradient` between `a` and `b`, at position `t` in
   *  [0,1]. Channel-wise lerp in GAMMA space, which is what the browser does
   *  for a default-colour-space CSS gradient — not an OKLCH or linear-light
   *  blend, both of which would describe a ramp no one renders.
   *
   *  Exists because MEASURING A GRADIENT AT ITS ENDPOINTS DOES NOT BOUND IT.
   *  The intuition that the interior lies between the two ends is false: sRGB
   *  decode is convex, so linearize(lerp(gamma)) <= lerp(linearize(gamma)), and
   *  luminance weights the channels very unevenly (G .7152 vs B .0722). Blend
   *  blue into red and the middle has a moderate amount of each and no green at
   *  all, so its luminance sits BELOW both ends. Measured, on a seed the engine
   *  accepts: `#37a3fe` -> `#f80000` reads 7.14 and 4.55 against `#0b0f19` at
   *  the ends and 3.35 at t=0.66. Endpoint-only `ink` would have called that
   *  gradient AA and shipped sub-AA initials on a reseeded tenant.
   *
   *  Six curated presets all happen to bottom out at an endpoint, which is
   *  exactly why this cannot be left to the preset suite to catch. */
  | { k: "mix"; a: ColorRef; b: ColorRef; t: number };

export type Scheme<T> = { dark: T; light: T };

/** The two colour schemes, as a name. Lives here rather than in resolve.ts
 *  because `ColorRef` constrains it — a type the spec depends on cannot be
 *  private to the resolver. */
export type SchemeName = "dark" | "light";

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
  | { kind: "channel"; of: string }
  /** MEASURED INK: the candidate that stays most legible across every backdrop
   *  in `over`, scored on the WORST backdrop (a label spans a whole gradient,
   *  so the weakest stop is the one that decides).
   *
   *  This is the one rule whose output is chosen by measurement rather than
   *  declared. It exists because "dark ink on a brand fill" is only right when
   *  the fill is light: obsidian's lime wants ink (11.20:1 vs white's 1.71:1),
   *  beacon's mid-blue wants white (4.65:1 vs ink's 4.12:1). A preset author
   *  cannot hard-code either without being wrong for someone, and a CLIENT SEED
   *  can move a fill across that boundary at runtime, so it cannot be decided
   *  at authoring time at all.
   *
   *  Ties go to the first candidate, so the list is written most-preferred
   *  first and the result is deterministic. */
  | { kind: "ink"; over: readonly ColorRef[]; candidates: readonly ColorRef[] };

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
