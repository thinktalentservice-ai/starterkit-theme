#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   Emits the CDN distribution artifact: dist/cdn/starterkit/**, one token
   sheet per shipped preset plus one shared font sheet. This is `pnpm
   brand:emit --target=cdn` from the migration plan — `--target` is required
   and validated (not defaulted) because a future second target (a static
   site export, say) getting silently routed through the CDN's path scheme
   and invariants would be a worse failure than an explicit "unknown target".

   WHY THIS RUNS AGAINST dist/, NOT src/: same reasoning, same precedent, as
   scripts/gen-preset-css.mjs (no ts-node/tsx devDependency in this repo) —
   see that script's own header for the full argument. This one imports
   dist/index.js (for buildCdnBrandSheet/buildFontsSheet/cdnPaths) and
   dist/presets.js (for PRESETS/PRESET_IDS), so it must run AFTER `pnpm build`.

   The 5 CDN-safety invariants are enforced by buildCdnBrandSheet() itself
   (via assertCdnSafe, src/emit/cdn.ts) — this script does not re-check them,
   it just fails loudly if the build throws. BUILD EVERY SHEET BEFORE WRITING
   ANY OF THEM — a first version of this script built-then-wrote per preset in
   one loop, so a throw on preset 4 of 6 left presets 1-3 already on disk
   (mixed with whatever was there before, since dist/cdn isn't cleaned first)
   while 4-6 and fonts.css were missing: the exact "partially-written dist/cdn
   is a worse state than wrote nothing" failure this script means to avoid,
   caught by an adversarial review actually tracing the control flow rather
   than trusting an earlier version of this comment's claim. Two passes below,
   not one: build+validate everything into memory first, write only after
   every build has succeeded.

     node scripts/brand-emit.mjs --target=cdn
   ═══════════════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST_INDEX = join(ROOT, "dist", "index.js");
const DIST_PRESETS = join(ROOT, "dist", "presets.js");
const OUT_ROOT = join(ROOT, "dist", "cdn");

const targetArg = process.argv.find((a) => a.startsWith("--target="));
const target = targetArg?.slice("--target=".length);
if (target !== "cdn") {
  console.error(`✗ brand-emit: --target=cdn is required (got ${targetArg ?? "no --target flag"})`);
  process.exit(1);
}

if (!existsSync(DIST_INDEX) || !existsSync(DIST_PRESETS)) {
  console.error("✗ brand-emit: build output missing (dist/index.js, dist/presets.js) — run `pnpm build` first");
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const packageVersion = pkg.version;

const { buildCdnBrandSheet, buildFontsSheet, cdnPaths } = await import(pathToFileURL(DIST_INDEX).href);
const { PRESETS, PRESET_IDS } = await import(pathToFileURL(DIST_PRESETS).href);

// Pass 1: build + validate every file's content, write nothing yet. Any
// preset's assertCdnSafe throw aborts here, before a single byte is written.
const files = [];

for (const id of PRESET_IDS) {
  const preset = PRESETS[id];
  if (!preset) throw new Error(`no preset registered for id: ${id}`);
  const css = buildCdnBrandSheet(preset, { packageVersion });
  const paths = cdnPaths(id, packageVersion);

  files.push([paths.versioned, css], [paths.latest, css]);
  if (paths.legacyAlias) files.push([paths.legacyAlias, css]);
}

files.push(["starterkit/fonts.css", buildFontsSheet()]);

// Pass 2: everything validated — write it all.
for (const [relativePath, content] of files) {
  const absolute = join(OUT_ROOT, relativePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf8");
}

console.log(`✓ brand-emit --target=cdn: wrote ${files.length} files under dist/cdn/`);
for (const [relativePath] of files) console.log(`  - ${relativePath}`);
