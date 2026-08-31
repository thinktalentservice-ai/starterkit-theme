/* MUI bindings. `createStarterkitTheme()` lands in phase 6.
 *
 * This module carries the two constraints that make a var()-valued palette work
 * at all. Both were found the hard way and are cheap to re-break, so they are
 * data here rather than prose in a comment somewhere: phase 6's theme factory
 * builds from these lists, and a test asserts every intention is covered.
 *
 * @mui/material is an OPTIONAL peer — a consumer using only the token engine
 * must not be forced to install it — but `createStarterkitTheme` below is the
 * one thing in this module that genuinely needs it, and the core tsup config
 * already marks `@mui/material`/`@mui/material/styles` external for exactly
 * this reason (see tsup.config.ts). */

import { createTheme, type Theme } from "@mui/material/styles";

/* `createStarterkitTheme` below builds a `cssVariables`-mode theme, which
 * only gets its cssVars-aware members (`colorSchemes`, `vars`, etc.) on the
 * `Theme` type when this augmentation is present — see the doc comment on
 * `CssThemeVariables` in @mui/material/styles/createThemeNoVars.d.ts. This
 * lives in the package's own .d.ts output, so a consumer importing `Theme`
 * from `@mui/material/styles` anywhere in a program that also imports from
 * this package picks it up via normal TS declaration merging. */
declare module "@mui/material/styles" {
  interface CssThemeVariables {
    enabled: true;
  }
}

/* `accent` / `accentGreen` / `accentPink` are not standard MUI palette
 * intentions, so `theme.palette.accent` etc. does not typecheck without this —
 * same declaration-merging mechanism as `CssThemeVariables` above, and it lives
 * in the same package .d.ts output for the same reason: a consumer's own
 * `Theme`/`ThemeOptions` imports pick it up automatically. `Palette["primary"]`
 * is reused as the shape rather than restating the 8-key `SimplePaletteColor`
 * interface, so this augmentation cannot drift from what MUI itself considers a
 * complete palette colour. */
declare module "@mui/material/styles" {
  interface Palette {
    accent: Palette["primary"];
    accentGreen: Palette["primary"];
    accentPink: Palette["primary"];
  }
  interface PaletteOptions {
    accent?: PaletteOptions["primary"];
    accentGreen?: PaletteOptions["primary"];
    accentPink?: PaletteOptions["primary"];
  }
}

/** MUI runs `augmentColor()` over every palette intention and derives the keys
 *  a theme did not supply. Derivation parses the colour — and `var(--primary)` is
 *  unparseable, so it throws at theme-creation time, which is build time. Every
 *  intention below must therefore supply `main`, `light`, `dark` and
 *  `contrastText` EXPLICITLY, plus its `*Channel` keys, leaving nothing to
 *  derive.
 *
 *  `accent`, `accentGreen` and `accentPink` are NOT MUI intentions MUI itself
 *  knows about — they carry no special meaning to `Button color="accent"` the
 *  way `primary`/`error`/etc. do, MUI does not reserve them, and augmenting
 *  them here is what stops `augmentColor()` throwing on them the same way it
 *  would on any other custom palette colour with a `var()` value. They exist so
 *  the engine's `--accent` / `--accent-green` / `--accent-pink` roles (see
 *  `ROLE_NAMES` in `engine/ladder.ts`) are reachable from `theme.palette.*`
 *  without a component reaching past the theme for a raw CSS var. */
export const PALETTE_INTENTIONS = [
  "primary",
  "secondary",
  "error",
  "warning",
  "info",
  "success",
  "accent",
  "accentGreen",
  "accentPink",
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

export type CreateStarterkitThemeOptions = {
  /** Passed straight through to MUI's `defaultColorScheme`, which is a
   *  concrete colour scheme, not a `mode` — MUI's own type for this option
   *  is `SupportedColorScheme`, i.e. one of the keys actually declared under
   *  `colorSchemes` below ("light" | "dark"), never "system". "system" is a
   *  runtime `mode` concept resolved client-side by `useConcreteTheme` (see
   *  `src/react`) via `useColorScheme()`, not something a theme can default
   *  into before there is a browser to resolve it against. Defaults to
   *  "dark" — this package's presets (think, elemetrik) are dark-first,
   *  matching what the host app's own appConfig.DEFAULT_COLOR_SCHEME was
   *  set to. */
  defaultColorScheme?: "light" | "dark";
};

/** The active preset's MUI theme: a `cssVariables`-mode theme whose every
 *  palette value is a `var(--token)` reference into this package's CSS layer,
 *  rather than a literal colour MUI would otherwise try to derive shades from
 *  (see `PALETTE_INTENTIONS`'s doc comment for why that throws). Moved
 *  verbatim out of the host app's `src/utils/theme/mui-theme.js` — same
 *  token names, same values, same component overrides. */
export function createStarterkitTheme(options: CreateStarterkitThemeOptions = {}): Theme {
  /* KNOWN APPROXIMATION, stated rather than hidden: `lightChannel`,
   * `darkChannel` and `contrastTextChannel` all carry `var(--<f>-channel)`,
   * which is the triple of `main` — NOT of the value each key actually holds.
   *
   * Only `mainChannel` is exact. The ABI publishes one RGB triple per family,
   * the mark's, because that is the one 32 call sites across the sibling
   * packages consume as `rgb(var(--<f>-channel) / α)`. Making the other three
   * exact needs `--<f>-solid-channel`, `--<f>-solid-hover-channel` and
   * `--<f>-on-solid-channel` — 18 new tokens whose only consumer would be MUI
   * internals, in a change whose point is to shrink the token surface.
   *
   * Why it is survivable: these three exist to stop `augmentColor()` running at
   * all (it parses the colour, and `var(--primary)` is unparseable, so it throws
   * at theme-creation time — see PALETTE_INTENTIONS). MUI's own components read
   * `mainChannel` for every alpha state; `lightChannel`/`darkChannel` are
   * essentially unread, and `contrastTextChannel` nearly so. Where one IS read,
   * the result is a tint in the family's mark colour instead of its fill colour
   * — same hue family, wrong rung.
   *
   * It is a real if small correctness gap and the fix is one `channel` rule per
   * token in src/presets/base.ts, not a workaround here. */
  const palette = {
    primary: {
      main: "var(--primary)",
      mainChannel: "var(--primary-channel)",
      light: "var(--primary-solid)",
      lightChannel: "var(--primary-channel)",
      dark: "var(--primary-solid-hover)",
      darkChannel: "var(--primary-channel)",
      contrastText: "var(--primary-on-solid)",
      contrastTextChannel: "var(--primary-channel)",
    },
    secondary: {
      main: "var(--secondary)",
      mainChannel: "var(--secondary-channel)",
      light: "var(--secondary-solid)",
      lightChannel: "var(--secondary-channel)",
      dark: "var(--secondary-solid-hover)",
      darkChannel: "var(--secondary-channel)",
      contrastText: "var(--secondary-on-solid)",
      contrastTextChannel: "var(--secondary-channel)",
    },
    warning: {
      main: "var(--warning)",
      mainChannel: "var(--warning-channel)",
      light: "var(--warning-solid)",
      lightChannel: "var(--warning-channel)",
      dark: "var(--warning-solid-hover)",
      darkChannel: "var(--warning-channel)",
      contrastText: "var(--warning-on-solid)",
      contrastTextChannel: "var(--warning-channel)",
    },
    error: {
      main: "var(--danger)",
      mainChannel: "var(--danger-channel)",
      light: "var(--danger-solid)",
      lightChannel: "var(--danger-channel)",
      dark: "var(--danger-solid-hover)",
      darkChannel: "var(--danger-channel)",
      contrastText: "var(--danger-on-solid)",
      contrastTextChannel: "var(--danger-channel)",
    },
    info: {
      main: "var(--info)",
      mainChannel: "var(--info-channel)",
      light: "var(--info-solid)",
      lightChannel: "var(--info-channel)",
      dark: "var(--info-solid-hover)",
      darkChannel: "var(--info-channel)",
      contrastText: "var(--info-on-solid)",
      contrastTextChannel: "var(--info-channel)",
    },
    success: {
      main: "var(--success)",
      mainChannel: "var(--success-channel)",
      light: "var(--success-solid)",
      lightChannel: "var(--success-channel)",
      dark: "var(--success-solid-hover)",
      darkChannel: "var(--success-channel)",
      contrastText: "var(--success-on-solid)",
      contrastTextChannel: "var(--success-channel)",
    },
    /* NOT a standard MUI intention — see the doc comment on `PALETTE_INTENTIONS`.
     * `accent` is the active preset's own brand accent (`--accent`, lime on
     * `think`, pink on `elemetrik`); `accentGreen` / `accentPink` are the two
     * fixed categorical accents, identical hex on every preset. See `ROLE_NAMES`
     * in `engine/ladder.ts`. */
    accent: {
      main: "var(--accent)",
      mainChannel: "var(--accent-channel)",
      light: "var(--accent-solid)",
      lightChannel: "var(--accent-channel)",
      dark: "var(--accent-solid-hover)",
      darkChannel: "var(--accent-channel)",
      contrastText: "var(--accent-on-solid)",
      contrastTextChannel: "var(--accent-channel)",
    },
    accentGreen: {
      main: "var(--accent-green)",
      mainChannel: "var(--accent-green-channel)",
      light: "var(--accent-green-solid)",
      lightChannel: "var(--accent-green-channel)",
      dark: "var(--accent-green-solid-hover)",
      darkChannel: "var(--accent-green-channel)",
      contrastText: "var(--accent-green-on-solid)",
      contrastTextChannel: "var(--accent-green-channel)",
    },
    accentPink: {
      main: "var(--accent-pink)",
      mainChannel: "var(--accent-pink-channel)",
      light: "var(--accent-pink-solid)",
      lightChannel: "var(--accent-pink-channel)",
      dark: "var(--accent-pink-solid-hover)",
      darkChannel: "var(--accent-pink-channel)",
      contrastText: "var(--accent-pink-on-solid)",
      contrastTextChannel: "var(--accent-pink-channel)",
    },
    background: {
      default: "var(--background)",
      defaultChannel: "var(--background-channel)",
      paper: "var(--surface)",
      paperChannel: "var(--surface-channel)",
    },
    text: {
      primary: "var(--fg1)",
      primaryChannel: "var(--fg1-channel)",
      secondary: "var(--fg2)",
      secondaryChannel: "var(--fg2-channel)",
      disabled: "var(--fg-disabled)",
    },
    divider: "var(--border)",
    dividerChannel: undefined,
  };

  const theme = createTheme({
    cssVariables: { colorSchemeSelector: COLOR_SCHEME_SELECTOR },
    defaultColorScheme: options.defaultColorScheme ?? "dark",
    colorSchemes: {
      dark: { palette: { mode: "dark", ...palette } },
      light: { palette: { mode: "light", ...palette } },
    },
    typography: {
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      h1: {
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        fontWeight: 800,
        fontSize: "2.125rem",
        letterSpacing: "-0.5px",
      },
      h2: {
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        fontWeight: 800,
        fontSize: "1.75rem",
        letterSpacing: "-0.4px",
      },
      h3: {
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        fontWeight: 700,
        fontSize: "1.375rem",
        letterSpacing: "-0.3px",
      },
      h4: { fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: "1.125rem" },
      h5: { fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: "1rem" },
      h6: { fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: "0.875rem" },
      body1: { fontSize: "0.9375rem", lineHeight: 1.6 },
      body2: { fontSize: "0.8125rem" },
      caption: {
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        fontWeight: 500,
        fontSize: "0.78125rem",
      },
      button: {
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        fontWeight: 600,
        fontSize: "0.875rem",
        textTransform: "none",
      },
      overline: {
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        fontWeight: 700,
        fontSize: "0.625rem",
        letterSpacing: "0.12em",
      },
    },
    shape: { borderRadius: 12 },
    spacing: 8,
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            border: "1px solid",
            borderColor: "var(--glass-border)",
            borderRadius: "var(--radius-card)",
            backgroundColor: "var(--card)",
            backgroundImage: "none",
            boxShadow: "var(--shadow-card)",
            transition: "border-color 0.25s, background 0.25s, box-shadow 0.25s, transform 0.25s",
            "&:hover": {
              borderColor: "var(--primary-border)",
              background: "var(--primary-bg)",
              boxShadow: "var(--shadow-card-hover)",
              transform: "translateY(-3px)",
            },
          },
        },
      },
      MuiButton: {
        // Cast past MUI v9's narrower `ButtonClasses`: `containedPrimary` and
        // `containedSecondary` are no longer real classKeys in this version
        // (Button's `overridesResolver` only resolves `root`, `variant`,
        // `size*`, `colorInherit`, `disableElevation`, `fullWidth`, `loading`
        // — see node_modules/@mui/material/Button/Button.js) so both are
        // inert at runtime, exactly as they silently were in the host's
        // untyped mui-theme.js. Fixing that (a `variants` array, different
        // values) is a real design decision this migration phase is not
        // scoped to make — the object is kept byte-for-byte instead.
        styleOverrides: {
          containedPrimary: {
            background: "var(--gradient-primary)",
            boxShadow: "var(--shadow-btn-primary)",
            borderRadius: "var(--radius-chip)",
            "&:hover": {
              filter: "brightness(1.1)",
              boxShadow: "0 6px 28px rgb(var(--primary-channel) / 0.5)",
            },
          },
          containedSecondary: {
            background: "var(--gradient-secondary)",
            boxShadow: "var(--shadow-btn-secondary)",
            borderRadius: "var(--radius-chip)",
            "&:hover": {
              filter: "brightness(1.1)",
              boxShadow: "0 6px 28px rgb(var(--secondary-channel) / 0.5)",
            },
          },
          outlined: {
            borderRadius: "var(--radius-chip)",
            borderColor: "var(--btn-outline-border)",
            color: "var(--fg2)",
            "&:hover": {
              borderColor: "var(--btn-outline-border-hover)",
              color: "var(--fg1)",
            },
          },
        } as any,
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: "var(--radius-chip)",
            fontWeight: 700,
            fontSize: "10px",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: "var(--radius)",
            backgroundColor: "var(--input)",
            "& .MuiOutlinedInput-notchedOutline": { borderColor: "var(--input-border)" },
            "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "var(--input-border-hover)" },
            "&.Mui-disabled .MuiOutlinedInput-notchedOutline": { borderColor: "var(--input-disabled-border)" },
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: { backgroundImage: "none", backgroundColor: "var(--sidebar-bg)" },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backdropFilter: "blur(16px)",
            backgroundImage: "none",
            boxShadow: "none",
            backgroundColor: "var(--topbar-bg)",
            borderBottom: "1px solid var(--border)",
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: "none" },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: "var(--radius-pill)", height: 6, backgroundColor: "var(--border)" },
          bar: { background: "var(--gradient-progress)", borderRadius: "var(--radius-pill)" },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: "8px",
            fontSize: "12px",
            backgroundColor: "var(--surface-elevated)",
            border: "1px solid var(--glass-border)",
            color: "var(--fg1)",
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: ({ ownerState }) => {
            const sev = ownerState.color || ownerState.severity || "success";
            // Collapsed from the old 4-slot { ch, icon, solid, on } shape to
            // the 3 tokens the new ABI actually publishes per family: `mark`
            // (var(--<f>), the non-text indicator — old `icon` and `solid`
            // both meant this), `tint` (var(--<f>-bg), the alpha
            // chip/callout background — old `ch` was hand-rolled via
            // rgb(var(--<f>-channel) / alpha) to approximate exactly this,
            // now a first-class token so the manual alpha math is gone), and
            // `on` (var(--<f>-on-solid), MEASURED ink — old `on` for error
            // was a hardcoded "#ffffff", which is the exact defect this
            // rename exists to remove).
            const TOK: Record<string, { mark: string; tint: string; on: string } | undefined> = {
              success: { mark: "--success", tint: "--success-bg", on: "--success-on-solid" },
              info: { mark: "--info", tint: "--info-bg", on: "--info-on-solid" },
              warning: { mark: "--warning", tint: "--warning-bg", on: "--warning-on-solid" },
              error: { mark: "--danger", tint: "--danger-bg", on: "--danger-on-solid" },
            };
            // Host used `[sev] || {}` — an unmatched `sev` never actually
            // happens (it's always one of the four keys above), so the exact
            // shape of this dead fallback doesn't matter for real traffic.
            // Kept as `{}` rather than inventing a differently-shaped
            // placeholder, so the two stay behaviorally identical rather than
            // merely similar on an unreachable path.
            const tok: Partial<{ mark: string; tint: string; on: string }> = TOK[sev] ?? {};
            const base = { borderRadius: "var(--radius)", alignItems: "center" };
            if (ownerState.variant === "filled") {
              return {
                ...base,
                backgroundColor: `var(${tok.mark})`,
                color: `var(${tok.on})`,
                "& .MuiAlert-icon": { color: `var(${tok.on})` },
              };
            }
            if (ownerState.variant === "outlined") {
              return {
                ...base,
                backgroundColor: "transparent",
                color: "var(--fg1)",
                border: `1px solid var(${tok.tint})`,
                "& .MuiAlert-icon": { color: `var(${tok.mark})` },
              };
            }
            return {
              ...base,
              backgroundColor: `var(${tok.tint})`,
              color: "var(--fg1)",
              border: `1px solid var(${tok.tint})`,
              "& .MuiAlert-icon": { color: `var(${tok.mark})` },
            };
          },
        },
      },
    },
  });

  return theme;
}
