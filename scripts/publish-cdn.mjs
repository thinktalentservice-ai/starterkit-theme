#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   Computes the CDN publish plan for dist/cdn/** (produced by `pnpm
   brand:emit --target=cdn`) — which file goes to which path, with which
   Cache-Control header, per the migration plan's path scheme:

     starterkit/tokens/v<pkgver>/<brand>.css   max-age=31536000, immutable
     starterkit/tokens/latest/<brand>.css      max-age=300
     starterkit/colors_and_type.css            max-age=300  (obsidian only)
     starterkit/fonts.css                      max-age=300

   DRY RUN BY DESIGN, NOT AS A SAFETY RAIL THAT COULD BE ARGUED AROUND: this
   package has no AWS SDK (or any object-storage client) as a dependency, and
   this repo carries no bucket name, region, or credentials for a real
   target — inventing one would mean guessing at infrastructure this script
   cannot verify exists. Uploading to a production CDN is exactly the kind of
   external, hard-to-reverse action that needs a human holding the actual
   credentials, not a script assuming them. `--exec` is accepted and
   recognized so this script's own help text can describe the eventual shape,
   but it deliberately fails rather than pretending to upload — see the
   `--exec` branch below.

     node scripts/publish-cdn.mjs             print the plan, exit 0
     node scripts/publish-cdn.mjs --exec      refuse — no uploader is wired up yet
   ═══════════════════════════════════════════════════════════════════════════ */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CDN_DIR = join(ROOT, "dist", "cdn");
const EXEC = process.argv.includes("--exec");

if (!existsSync(CDN_DIR)) {
  console.error("✗ publish-cdn: dist/cdn/ missing — run `pnpm brand:emit --target=cdn` first");
  process.exit(1);
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/** Cache-Control by path shape — see the header table. Anything under
 *  `tokens/v<n>/` is the immutable, versioned artifact; everything else
 *  (latest/, the legacy alias, fonts.css) is short-cache. */
function cacheControlFor(relPath) {
  const posix = relPath.replaceAll("\\", "/");
  if (/^starterkit\/tokens\/v[^/]+\//.test(posix)) return "max-age=31536000, immutable";
  return "max-age=300";
}

const files = walk(CDN_DIR).map((absolute) => {
  const relPath = relative(CDN_DIR, absolute);
  const content = readFileSync(absolute, "utf8");
  // Buffer.byteLength, not content.length: this repo's own house style is
  // full of em dashes and other multi-byte characters in generated headers,
  // so a JS string's UTF-16 code-unit count understates the actual UTF-8
  // upload size — the number that matters for a real transfer/cost estimate.
  return { relPath, absolute, bytes: Buffer.byteLength(content, "utf8"), cacheControl: cacheControlFor(relPath) };
});

files.sort((a, b) => a.relPath.localeCompare(b.relPath));

console.log(`Publish plan for dist/cdn/ (${files.length} files):\n`);
for (const f of files) {
  console.log(`  ${f.relPath}`);
  console.log(`    -> Cache-Control: ${f.cacheControl}  (${f.bytes} bytes)`);
}

if (EXEC) {
  console.error(
    "\n✗ publish-cdn --exec: no uploader is wired up. This package has no object-" +
      "storage client dependency and no configured bucket/region/credentials. " +
      "Add a real uploader (aws s3 sync, rclone, or this repo's own CI/CD) before " +
      "using --exec — printing a plan for infrastructure this script can't verify " +
      "exists is as far as it goes on its own.",
  );
  process.exit(1);
}

console.log("\n(dry run — nothing was uploaded; see this script's header for why)");
