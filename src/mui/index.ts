/* MUI bindings. `createStarterkitTheme()` lands in phase 6.
 *
 * This module carries the two constraints that make a var()-valued palette work
 * at all. Both were found the hard way and are cheap to re-break, so they are
 * data here rather than prose in a comment somewhere: phase 6's theme factory
 * builds from these lists, and a test asserts every intention is covered.
 *
 * Deliberately free of any `@mui/material` import for now — @mui is an OPTIONAL
 * peer, so a consumer using only the token engine must not be forced to install
 * it, and the core tsup config marks it external for the same reason. */

/** MUI runs `augmentColor()` over every palette intention and derives the keys
 *  a theme did not supply. Derivation parses the colour — and `var(--mint)` is
 *  unparseable, so it throws at theme-creation time, which is build time. Every
 *  intention below must therefore supply `main`, `light`, `dark` and
 *  `contrastText` EXPLICITLY, plus its `*Channel` keys, leaving nothing to
 *  derive. */
export const PALETTE_INTENTIONS = [
  "primary",
  "secondary",
  "error",
  "warning",
  "info",
  "success",
] as const;

export type PaletteIntention = (typeof PALETTE_INTENTIONS)[number];

/** The keys each intention must set explicitly. Omitting one hands it back to
 *  `augmentColor()`, which is the throw described above. */
export const REQUIRED_INTENTION_KEYS = [
  "main",
  "light",
  "dark",
  "contrastText",
  "mainChannel",
  "lightChannel",
  "darkChannel",
  "contrastTextChannel",
] as const;

/** `divider` is a colour MUI also channel-derives, and it is the one case where
 *  the token is already an rgba() rather than an opaque hex — so there is no
 *  meaningful triple to publish and the channel must be explicitly `undefined`
 *  rather than absent. Absent means "derive it"; undefined means "there isn't
 *  one". They are not the same to MUI. */
export const DIVIDER_CHANNEL_IS_UNDEFINED = true;

/** The attribute MUI writes the active scheme onto. Both design-system packages
 *  hardcode this selector (plus `[data-theme="light"]`), so it is an ABI: change
 *  it and every button and card silently keeps its dark-surface values on a
 *  light page. */
export const COLOR_SCHEME_SELECTOR = "data-mui-color-scheme";
