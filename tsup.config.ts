import { defineConfig, type Options } from "tsup";

/* TWO configs, deliberately — not one with a shared banner.
 *
 * The card and button packages ship a blanket `banner: { js: '"use client";' }`,
 * which is right for them: every entry they have is a component. It is wrong
 * here. The colour engine has to run in three places a client bundle cannot:
 *
 *   - `scripts/brand-emit.mjs` in the host, at build time, under plain Node
 *   - a Next.js route handler serving `/api/brand/[tenant]`
 *   - potentially the edge runtime, resolving a tenant in middleware
 *
 * A `"use client"` directive on the core entry makes all three impossible, and
 * it fails at *import* time in a server context rather than at build — the kind
 * of error that shows up in a deploy log, not in a diff. So the banner is
 * scoped to the one entry that needs it.
 *
 * Both configs write into `dist`, and NEITHER cleans it. `clean: true` on two
 * configs sharing an output directory is a race: tsup starts them together, so
 * the second config's clean can land after the first has begun writing. It is
 * not hypothetical — the first build here produced a correct `dist` purely on
 * timing. `clean: false` on only the second config would merely make the
 * corruption order-dependent instead of removing it.
 *
 * So the wipe happens once, before tsup runs at all, in the `clean` npm script.
 * One deleter, no overlap, deterministic.
 */

/* `satisfies` rather than `as const`: a const assertion makes `format` a
   readonly tuple, which tsup's `Options` rejects, and it also drops the
   contextual typing that gives `outExtension` its parameter types. */
const shared = {
  format: ["esm", "cjs"],
  dts: true,
  // See the header: the `clean` npm script owns this, exactly once.
  clean: false,
  sourcemap: true,
  target: "es2020",
  // NOT `treeshake: true`. That option post-processes through rollup, which
  // strips module-level directives — it silently removed the "use client"
  // banner in the card package and shipped a build Next treated as a server
  // component. esbuild already tree-shakes when bundling, so it bought nothing.
  outExtension: ({ format }) => ({ js: format === "cjs" ? ".cjs" : ".js" }),
} satisfies Options;

export default defineConfig([
  {
    ...shared,
    // Core: engine, presets, MUI theme factory. Runs anywhere JS runs.
    // NO banner. The smoke test asserts this, because a regression here is
    // invisible until something imports it from a server context.
    entry: {
      index: "src/index.ts",
      presets: "src/presets/index.ts",
      mui: "src/mui/index.ts",
    },
    outDir: "dist",
    // @mui/material is a peer and optional — never bundle it. Consumers who
    // never import `./mui` should not be forced to install it.
    external: ["react", "react-dom", "@mui/material", "@mui/material/styles"],
  },
  {
    ...shared,
    // React bindings only. These attach effects and read context, so Next's
    // RSC compiler must see the directive. esbuild strips top-of-file
    // directives, hence re-attaching it per output chunk.
    entry: { "react/index": "src/react/index.ts" },
    outDir: "dist",
    banner: { js: '"use client";' },
    external: ["react", "react-dom", "@mui/material", "@mui/material/styles"],
  },
]);
