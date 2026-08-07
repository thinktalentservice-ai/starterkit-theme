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

export type CreateStarterkitThemeOptions = {
  /** Passed straight through to MUI's `defaultColorScheme`, which is a
   *  concrete colour scheme, not a `mode` — MUI's own type for this option
   *  is `SupportedColorScheme`, i.e. one of the keys actually declared under
   *  `colorSchemes` below ("light" | "dark"), never "system". "system" is a
   *  runtime `mode` concept resolved client-side by `useConcreteTheme` (see
   *  `src/react`) via `useColorScheme()`, not something a theme can default
   *  into before there is a browser to resolve it against. Defaults to
   *  "dark" — this package's presets (obsidian) are dark-first, matching
   *  what the host app's own appConfig.DEFAULT_COLOR_SCHEME was set to. */
  defaultColorScheme?: "light" | "dark";
};

/** The Obsidian MUI theme: a `cssVariables`-mode theme whose every palette
 *  value is a `var(--token)` reference into this package's CSS layer, rather
 *  than a literal colour MUI would otherwise try to derive shades from (see
 *  `PALETTE_INTENTIONS`'s doc comment for why that throws). Moved verbatim
 *  out of the host app's `src/utils/theme/mui-theme.js` — same token names,
 *  same values, same component overrides. */
export function createStarterkitTheme(options: CreateStarterkitThemeOptions = {}): Theme {
  const palette = {
    primary: {
      main: "var(--mint)",
      mainChannel: "var(--mint-channel)",
      light: "var(--mint-text)",
      lightChannel: "var(--mint-text-channel)",
      dark: "var(--mint-dark)",
      darkChannel: "var(--mint-dark-channel)",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "var(--electric)",
      mainChannel: "var(--electric-channel)",
      light: "var(--electric-text)",
      lightChannel: "var(--electric-text-channel)",
      dark: "var(--electric-deep)",
      darkChannel: "var(--electric-deep-channel)",
      contrastText: "#ffffff",
    },
    warning: {
      main: "var(--amber-brand)",
      mainChannel: "var(--amber-channel)",
      light: "var(--amber-text)",
      lightChannel: "var(--amber-text-channel)",
      dark: "var(--amber-deep)",
      darkChannel: "var(--amber-deep-channel)",
      contrastText: "#ffffff",
    },
    error: {
      main: "var(--rose)",
      mainChannel: "var(--rose-channel)",
      light: "var(--rose)",
      lightChannel: "var(--rose-channel)",
      dark: "var(--rose-deep)",
      darkChannel: "var(--rose-channel)",
      contrastText: "#ffffff",
    },
    info: {
      main: "var(--sky)",
      mainChannel: "var(--sky-channel)",
      light: "var(--sky)",
      lightChannel: "var(--sky-channel)",
      dark: "var(--sky)",
      darkChannel: "var(--sky-channel)",
      contrastText: "#ffffff",
    },
    success: {
      main: "var(--mint)",
      mainChannel: "var(--mint-channel)",
      light: "var(--mint-text)",
      lightChannel: "var(--mint-text-channel)",
      dark: "var(--mint-dark)",
      darkChannel: "var(--mint-dark-channel)",
      contrastText: "#ffffff",
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
        fontFamily: "'Outfit', system-ui, sans-serif",
        fontWeight: 800,
        fontSize: "2.125rem",
        letterSpacing: "-0.5px",
      },
      h2: {
        fontFamily: "'Outfit', system-ui, sans-serif",
        fontWeight: 800,
        fontSize: "1.75rem",
        letterSpacing: "-0.4px",
      },
      h3: {
        fontFamily: "'Outfit', system-ui, sans-serif",
        fontWeight: 700,
        fontSize: "1.375rem",
        letterSpacing: "-0.3px",
      },
      h4: { fontFamily: "'Outfit', system-ui, sans-serif", fontWeight: 700, fontSize: "1.125rem" },
      h5: { fontFamily: "'Outfit', system-ui, sans-serif", fontWeight: 600, fontSize: "1rem" },
      h6: { fontFamily: "'Outfit', system-ui, sans-serif", fontWeight: 600, fontSize: "0.875rem" },
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
              borderColor: "var(--accent-border)",
              background: "var(--accent-fill)",
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
            boxShadow: "var(--shadow-btn-mint)",
            borderRadius: "var(--radius-chip)",
            "&:hover": {
              filter: "brightness(1.1)",
              boxShadow: "0 6px 28px rgb(var(--mint-channel) / 0.5)",
            },
          },
          containedSecondary: {
            background: "var(--gradient-secondary)",
            boxShadow: "var(--shadow-btn-violet)",
            borderRadius: "var(--radius-chip)",
            "&:hover": {
              filter: "brightness(1.1)",
              boxShadow: "0 6px 28px rgb(var(--electric-channel) / 0.5)",
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
            const TOK: Record<string, { ch: string; icon: string; solid: string; on: string } | undefined> = {
              success: { ch: "--mint-channel", icon: "--mint-text", solid: "--mint", on: "var(--on-mint)" },
              info: { ch: "--sky-channel", icon: "--sky", solid: "--sky", on: "var(--on-sky)" },
              warning: { ch: "--amber-channel", icon: "--amber-text", solid: "--amber-brand", on: "var(--on-amber)" },
              error: { ch: "--rose-channel", icon: "--rose", solid: "--rose", on: "#ffffff" },
            };
            // Host used `[sev] || {}` — an unmatched `sev` never actually
            // happens (it's always one of the four keys above), so the exact
            // shape of this dead fallback doesn't matter for real traffic.
            // Kept as `{}` rather than inventing a differently-shaped
            // placeholder, so the two stay behaviorally identical rather than
            // merely similar on an unreachable path.
            const tok: Partial<{ ch: string; icon: string; solid: string; on: string }> = TOK[sev] ?? {};
            const base = { borderRadius: "var(--radius)", alignItems: "center" };
            if (ownerState.variant === "filled") {
              return {
                ...base,
                backgroundColor: `var(${tok.solid})`,
                color: tok.on,
                "& .MuiAlert-icon": { color: tok.on },
              };
            }
            if (ownerState.variant === "outlined") {
              return {
                ...base,
                backgroundColor: "transparent",
                color: "var(--fg1)",
                border: `1px solid rgb(var(${tok.ch}) / 0.45)`,
                "& .MuiAlert-icon": { color: `var(${tok.icon})` },
              };
            }
            return {
              ...base,
              backgroundColor: `rgb(var(${tok.ch}) / 0.14)`,
              color: "var(--fg1)",
              border: `1px solid rgb(var(${tok.ch}) / 0.30)`,
              "& .MuiAlert-icon": { color: `var(${tok.icon})` },
            };
          },
        },
      },
    },
  });

  return theme;
}
