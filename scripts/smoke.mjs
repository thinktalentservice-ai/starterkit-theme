#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   Phase-0 gate: the core build must run under plain Node.

   The whole two-config tsup split exists so the colour engine can run in three
   places a client bundle cannot — a build-time emit script, a Next.js route
   handler, and possibly middleware at the edge. Nothing about that is visible
   in a diff: adding `"use client"` to the shared tsup config, or re-exporting
   one React binding from `src/index.ts`, breaks all three at IMPORT time in a
   server context. That surfaces in a deploy log, not in a test run.

   So it is asserted mechanically, on every build:

     1. no core output carries the directive
     2. the react output DOES carry it (a stripped banner is the card
        package's documented `treeshake` bug, and it fails the other way)
     3. every core entry actually loads under Node, ESM and CJS both, with no
        DOM globals present
     4. no core output pulls in react at runtime

   Check 3 is the one that matters: 1 and 2 are greps, and a grep cannot catch
   a transitive import of something that touches `document` on load.
   ═══════════════════════════════════════════════════════════════════════════ */
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const DIRECTIVE = /^\s*(?:"use client"|'use client')/m;

const CORE = ["index", "presets", "mui"];
const CLIENT = ["react/index"];

const fail = [];
const note = (ok, message) => {
  console.log(`  ${ok ? "✓" : "✗"} ${message}`);
  if (!ok) fail.push(message);
};

/** Guard against a green run that checked nothing because dist was empty. */
for (const name of [...CORE, ...CLIENT]) {
  for (const ext of [".js", ".cjs", ".d.ts"]) {
    const file = join(ROOT, "dist", name + ext);
    if (!existsSync(file)) fail.push(`missing build output: dist/${name}${ext}`);
  }
}
if (fail.length) {
  console.error("✗ smoke: build output missing — run `pnpm build` first\n  - " + fail.join("\n  - "));
  process.exit(1);
}

console.log("directive scoping");
for (const name of CORE) {
  for (const ext of [".js", ".cjs"]) {
    const src = readFileSync(join(ROOT, "dist", name + ext), "utf8");
    note(
      !DIRECTIVE.test(src),
      `dist/${name}${ext} has no "use client" — core must load in Node, a route handler and the edge`,
    );
  }
}
for (const name of CLIENT) {
  for (const ext of [".js", ".cjs"]) {
    const src = readFileSync(join(ROOT, "dist", name + ext), "utf8");
    note(DIRECTIVE.test(src), `dist/${name}${ext} carries "use client" — rollup strips it when treeshake is on`);
  }
}

console.log("\nno react in the core bundle");
for (const name of CORE) {
  for (const ext of [".js", ".cjs"]) {
    const src = readFileSync(join(ROOT, "dist", name + ext), "utf8");
    note(
      !/require\(["']react["']\)|from\s*["']react["']/.test(src),
      `dist/${name}${ext} does not pull in react`,
    );
  }
}

console.log("\ncore loads under plain Node");
/* No jsdom, no globals shimmed. If an entry reaches for `document` or `window`
   on load this throws here rather than in a deploy. */
for (const name of CORE) {
  try {
    const mod = require(join(ROOT, "dist", `${name}.cjs`));
    note(typeof mod === "object" && mod !== null, `require("./dist/${name}.cjs") resolved`);
  } catch (error) {
    note(false, `require("./dist/${name}.cjs") threw: ${error.message}`);
  }
  try {
    const mod = await import(pathToFileURL(join(ROOT, "dist", `${name}.js`)).href);
    note(typeof mod === "object" && mod !== null, `import("./dist/${name}.js") resolved`);
  } catch (error) {
    note(false, `import("./dist/${name}.js") threw: ${error.message}`);
  }
}

console.log("\nthe ABI actually arrived");
/* A build that exports nothing would pass every check above. */
const core = require(join(ROOT, "dist", "index.cjs"));
note(Array.isArray(core.ROOT_TOKEN_NAMES) && core.ROOT_TOKEN_NAMES.length > 100,
  `ROOT_TOKEN_NAMES has ${core.ROOT_TOKEN_NAMES?.length ?? 0} entries`);
note(Array.isArray(core.CHANNEL_PAIRS) && core.CHANNEL_PAIRS.length > 0,
  `CHANNEL_PAIRS has ${core.CHANNEL_PAIRS?.length ?? 0} entries`);
note(core.isTokenName?.("--mint") === true && core.isTokenName?.("--nope") === false,
  "isTokenName accepts a real token and rejects a typo");

const presets = require(join(ROOT, "dist", "presets.cjs"));
note(presets.PRESET_IDS?.[0] === "obsidian", "PRESET_IDS[0] is obsidian (the golden-test preset)");

if (fail.length) {
  console.error(`\n✗ smoke: ${fail.length} check(s) failed`);
  process.exit(1);
}
console.log("\n✓ smoke: core is server-safe, client entry is marked, ABI is present.");
