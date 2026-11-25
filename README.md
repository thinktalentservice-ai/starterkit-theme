# @devopsnext/starterkit-theme

The two-brand semantic token engine — a brandable CSS token engine plus a MUI theme. Zero runtime dependencies.

A brand is a colour family plus geometry: give the engine a seed hex, and it resolves an entire ramp — light scheme, dark scheme, contrast-checked — rather than a single flat colour swap that leaves half the UI stale. Two presets ship out of the box (Think, Elemetrik), each hand-authored and contrast-tested, not generated.

## Install

```bash
pnpm add @devopsnext/starterkit-theme
```

`@mui/material`, `react`, and `react-dom` are optional peer dependencies — install them only if you use the `./mui` or `./react` entry points. The core token engine (`.`) has zero runtime dependencies and is safe to import in Node, a route handler, or the edge.

Requires Node 18 or later.

## Entry points

| Import | Contents | Environment |
| --- | --- | --- |
| `@devopsnext/starterkit-theme` | Token engine: `resolveBrand`, `serializeBrandCss`, colour/contrast utilities, token names, CDN emit helpers | Server-safe — no React, no `"use client"` |
| `@devopsnext/starterkit-theme/presets` | `THINK`, `ELEMETRIK`, `PRESETS`, `PRESET_IDS`, `DEFAULT_PRESET_ID`, `isPresetId`, `makePreset` | Server-safe |
| `@devopsnext/starterkit-theme/mui` | `createStarterkitTheme()` — a `cssVariables`-mode MUI theme wired to the token set | Server-safe (requires `@mui/material`) |
| `@devopsnext/starterkit-theme/react` | `BrandProvider`, `useBrand`, `useConcreteTheme`, `useTokenValue`, `ThemeToggle` | Client-only (`"use client"`) |
| `@devopsnext/starterkit-theme/styles.css` | Brand-independent structural CSS: reset, keyframes, animation/glow utilities, card overrides | Any CSS pipeline |
| `@devopsnext/starterkit-theme/presets/*.css` | Pre-built token sheet for each preset (`think.css`, `elemetrik.css`) | Any CSS pipeline |
| `@devopsnext/starterkit-theme/bootstrap-bridge.css` | Maps Bootstrap 5.3's `--bs-*` and component-scoped variables onto the token set | Any CSS pipeline |
| `@devopsnext/starterkit-theme/schema.json` | JSON Schema for the tenant-facing brand document | Validation tooling |

## Presets

| Id | Name | Notes |
| --- | --- | --- |
| `think` | Think | Default brand (`DEFAULT_PRESET_ID`). Blue primary, brand-lime accent. |
| `elemetrik` | Elemetrik | Violet primary, pink accent. |

Both presets share every seed except `primary` and `accent`, so the same component code works with either brand — there is nothing per-theme to branch on.

Each preset seeds nine roles: `primary`, `secondary`, `accent`, `success`, `warning`, `danger`, `info`, `accent-green`, `accent-pink`. `info`, `accent-green`, and `accent-pink` are fixed categorical roles, identical in both presets.

**Hand-tuned palette.** On top of the engine's derived ramps, both presets carry a reviewed tuning layer (`src/presets/tuning.ts` for shared values, plus per-brand values in `think.ts` / `elemetrik.ts`). The tuning feeds back through the resolver, so tints, borders, glows, and channels derive from the tuned mark, and every contrast duty is still measured. Where a tuned value misses a duty (for example, white labels on the lime, amber, and green fills), `resolveBrand` reports it in `warnings` — nothing is suppressed.

**Fonts.** Headings and body text default to **Poppins**; mono defaults to **Geist Mono**. The token sheets set `--font-heading`, `--font-body`, and `--font-mono` but do not load font files — load Poppins yourself (or use the CDN `fonts.css` sheet, described below).

## Usage

### Static CSS (no JavaScript)

Load the structural sheet plus one preset sheet:

```css
@import "@devopsnext/starterkit-theme/styles.css";
@import "@devopsnext/starterkit-theme/presets/think.css";
```

The preset sheets are generated from `resolveBrand(PRESETS[id])` at build time, so no engine call is needed at request time.

### Bootstrap 5.3

Load the bridge **after** Bootstrap's own CSS, alongside a preset sheet:

```css
@import "bootstrap/dist/css/bootstrap.css";
@import "@devopsnext/starterkit-theme/presets/think.css";
@import "@devopsnext/starterkit-theme/bootstrap-bridge.css";
```

The bridge repoints Bootstrap's global `--bs-*` variables and also overrides the component-scoped variables (`--bs-btn-bg`, …) that Bootstrap bakes in at Sass-compile time. See the notes at the end of the file for what it does not cover.

### Resolve a brand from a preset

```ts
import { resolveBrand, serializeBrandCss } from "@devopsnext/starterkit-theme";
import { THINK } from "@devopsnext/starterkit-theme/presets";

const brand = resolveBrand(THINK);
const css = serializeBrandCss(brand, { provenance: { version: "1.5.1", brand: THINK.id } });

if (brand.warnings.length > 0) console.warn(brand.warnings);
```

`css` is a `:root { ... }` block plus a `[data-mui-color-scheme="light"] { ... }` override block — inject it server-side, or feed it straight into `BrandProvider`.

### Build a custom brand

```ts
import { makePreset } from "@devopsnext/starterkit-theme/presets";
import { resolveBrand } from "@devopsnext/starterkit-theme";

const acme = makePreset({
  id: "acme",
  name: "Acme",
  seeds: {
    primary: "#0F766E",
    secondary: "#64748B",
    accent: "#F97316",
    success: "#4CAF50",
    warning: "#F59E0B",
    danger: "#F43F5E",
    info: "#37A3FE",
    "accent-green": "#B3D335",
    "accent-pink": "#EE4480",
  },
  // optional: intensity (0..1), radius, fonts, overrides
});

const brand = resolveBrand(acme);
```

### MUI theme

```ts
import { createStarterkitTheme } from "@devopsnext/starterkit-theme/mui";

const theme = createStarterkitTheme({ defaultColorScheme: "dark" });
```

Every palette value is a `var(--token)` reference, so the theme follows whichever preset sheet is loaded. Contained buttons, FABs, filled chips, and badges paint from each family's `-solid` rung.

### React bindings

```tsx
"use client";
import { BrandProvider, ThemeToggle, useConcreteTheme } from "@devopsnext/starterkit-theme/react";

<BrandProvider id="think" css={css} theme={theme}>
  <ThemeToggle />
</BrandProvider>;
```

### Sidebar rail (1.7.0)

The sidebar rail is **dark in both schemes**: `--sidebar-bg` is `#0d0f1a` (the dark `--background`) in dark *and* light, so it is no longer in the light block. Because the scheme's own `--fg1`/`--fg2`/`--border`/`--hover-overlay` turn dark in light mode, the rail has its own scheme-invariant ink:

| Token | Value | Use |
|---|---|---|
| `--sidebar-fg1` | `#ffffff` | active / hovered nav label |
| `--sidebar-fg2` | `#ffffff` | resting nav label |
| `--sidebar-fg-muted` | `rgb(255 255 255 / 0.6)` | section captions |
| `--sidebar-border` | `rgb(255 255 255 / 0.12)` | rail hairlines |
| `--sidebar-hover-overlay` | `rgb(255 255 255 / 0.08)` | row hover veil |

`@devopsnext/starterkit-layout` reads these on `.il-sidebar-area`. A brand that wants a light rail must override `--sidebar-bg` **and** the `--sidebar-fg*` set together — `--sidebar-fg1`/`--sidebar-fg2` carry a 4.5:1 `report` duty on `--sidebar-bg`, so forgetting the ink lands in `warnings`. MUI `Drawer` paper now takes `color: var(--sidebar-fg1)`.

## How it works

A colour family is a ramp plus two windows into it. Ramp steps are OKLCH offsets (lightness delta, chroma ratio, hue delta) from a client-supplied seed — never absolute hexes — so changing one seed moves the whole family and keeps its shape. The light scheme is not a second palette to author: it's the same ramp read one step deeper, with per-token overrides only where a WCAG contrast duty forces a different step. Hand-tuned overrides (see [Presets](#presets)) are applied per scheme and re-measured. See `src/engine/spec.ts` for the full model.

## CDN distribution

```bash
pnpm build
pnpm brand:emit     # writes dist/cdn/starterkit/** — one token sheet per preset plus fonts.css
pnpm publish:cdn    # prints the upload plan (dry run)
```

Published path scheme:

| Path | Cache-Control |
| --- | --- |
| `starterkit/tokens/v<version>/<brand>.css` | `max-age=31536000, immutable` |
| `starterkit/tokens/latest/<brand>.css` | `max-age=300` |
| `starterkit/colors_and_type.css` | `max-age=300` (legacy alias, default preset only) |
| `starterkit/fonts.css` | `max-age=300` |

CDN token sheets contain no font `@import`s; `fonts.css` is a separate, opt-in sheet that loads the curated Google Fonts set (consumer CSP needs `fonts.googleapis.com` and `fonts.gstatic.com`). `publish:cdn` is dry-run only — `--exec` deliberately refuses, since no uploader or credentials are wired up.

## Scripts

```bash
pnpm build              # clean, typecheck, tsup build (dist/)
pnpm dev                # tsup in watch mode
pnpm typecheck          # tsc --noEmit
pnpm test               # vitest
pnpm test:watch         # vitest in watch mode
pnpm test:fuzz          # engine fuzz suite
pnpm smoke              # require() the built bundles under plain Node
pnpm gen:tokens         # regenerate token names (gen:tokens:check fails when stale)
pnpm gen:presets        # regenerate presets/*.css from dist (gen:presets:check fails when stale)
pnpm brand:emit         # emit CDN artifacts (after build)
pnpm publish:cdn        # print CDN publish plan
pnpm verify             # typecheck, token check, tests, fuzz, build, preset-CSS check, smoke
```

Run `pnpm verify` before opening a PR. After changing a preset or the engine, run `pnpm build && pnpm gen:presets` and commit the regenerated sheets.

## CI and releases

- **CI** (`.github/workflows/ci.yml`) builds on every push and on every PR into `main`. Make the **Build** check required on `main` so a PR can only merge once it passes.
- **Release** (`.github/workflows/release.yml`) runs when a GitHub Release is published:
  1. Checks that the release tag (with or without a leading `v`) matches `package.json`'s `version`.
  2. Runs the same build as CI.
  3. Publishes to npm with provenance, using `NPM_TOKEN` from the `npm` environment. Prereleases publish under the `next` tag; others under `latest`. Fails if the version is already on npm.
  4. Redeploys Storybook to GitHub Pages — only if Pages is already enabled and a Storybook build script exists; otherwise this step is skipped.

To release: bump `version` in `package.json`, merge to `main`, then publish a GitHub Release tagged `v<version>`.

## License

MIT
