# @devopsnext/starterkit-theme

The two-brand semantic token engine — a brandable CSS token engine plus a MUI theme. Zero runtime dependencies.

A brand is a colour family plus geometry: give the engine a seed hex, and it resolves an entire ramp — light scheme, dark scheme, contrast-checked — rather than a single flat colour swap that leaves half the UI stale. Two presets ship out of the box (Think, Elemetrik), each hand-authored and contrast-tested, not generated.

## Install

```bash
pnpm add @devopsnext/starterkit-theme
```

`@mui/material`, `react`, and `react-dom` are optional peer dependencies — install them only if you use the `./mui` or `./react` entry points. The core token engine (`.`) has zero runtime dependencies and is safe to import in Node, a route handler, or the edge.

## Entry points

| Import | Contents | Environment |
| --- | --- | --- |
| `@devopsnext/starterkit-theme` | Token engine: `resolveBrand`, `serializeBrandCss`, ramp/parse utilities, token names | Server-safe — no React, no `"use client"` |
| `@devopsnext/starterkit-theme/presets` | The two curated `PresetSpec` objects plus `PRESET_IDS` / `isPresetId` | Server-safe |
| `@devopsnext/starterkit-theme/mui` | `createStarterkitTheme()` — a `cssVariables`-mode MUI theme wired to the token set | Server-safe (requires `@mui/material`) |
| `@devopsnext/starterkit-theme/react` | `BrandProvider`, `useBrand`, `useConcreteTheme`, `useTokenValue`, `ThemeToggle` | Client-only (`"use client"`) |
| `@devopsnext/starterkit-theme/styles.css` | Think's static token sheet | Any CSS pipeline |
| `@devopsnext/starterkit-theme/presets/*.css` | Pre-built CSS for each preset | Any CSS pipeline |
| `@devopsnext/starterkit-theme/schema.json` | JSON Schema for the tenant-facing brand document | Validation tooling |

## Usage

### Resolve a brand from a preset

```ts
import { resolveBrand, serializeBrandCss } from "@devopsnext/starterkit-theme";
import { THINK } from "@devopsnext/starterkit-theme/presets";

const brand = resolveBrand(THINK);
const css = serializeBrandCss(brand, { provenance: { version: "0.1.0", brand: THINK.id } });
```

`css` is a `:root { ... }` block plus a `[data-mui-color-scheme="light"] { ... }` override block — inject it server-side, or feed it straight into `BrandProvider`.

### MUI theme

```ts
import { createStarterkitTheme } from "@devopsnext/starterkit-theme/mui";

const theme = createStarterkitTheme({ defaultColorScheme: "dark" });
```

### React bindings

```tsx
"use client";
import { BrandProvider, ThemeToggle, useConcreteTheme } from "@devopsnext/starterkit-theme/react";

<BrandProvider id="think" css={css} theme={theme}>
  <ThemeToggle />
</BrandProvider>;
```

## How it works

A colour family is a ramp plus two windows into it. Ramp steps are OKLCH offsets (lightness delta, chroma ratio, hue delta) from a client-supplied seed — never absolute hexes — so changing one seed moves the whole family and keeps its shape. The light scheme is not a second palette to author: it's the same ramp read one step deeper, with per-token overrides only where a WCAG contrast duty forces a different step. See `src/engine/spec.ts` for the full model.

## Scripts

```bash
pnpm build      # typecheck + tsup build (dist/)
pnpm test       # vitest
pnpm verify     # typecheck, tests, build, preset-CSS check, smoke test
```

## License

MIT
