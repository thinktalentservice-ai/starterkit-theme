#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   Generates src/tokens/names.ts — the token ABI — from the checked-in fixture.

   WHY A GENERATOR AND NOT A HAND-WRITTEN LIST: these names are an ABI. Two
   published packages (@devopsnext/starterkit-button-component, -card-component)
   alias them and render a vendored obsidian default when one goes missing —
   silently, with no console error, on a page that is supposed to be branded.
   A hand-maintained list is how DESIGN.md fell 42 tokens behind the sheet.

   THE FIXTURE IS ALSO THE GOLDEN TEST INPUT. src/tokens/__fixtures__/ holds a
   byte-verified snapshot of what the CDN serves at
   https://cdn.thinktalentws48.click/starterkit/colors_and_type.css — the same
   file both packages' `sync-tokens.mjs` fetch. Phase 4's golden test asserts
   that resolveBrand(PRESETS.obsidian) reproduces these exact values, so the
   fixture must never be edited to make a test pass: it is the spec, and if the
   engine disagrees with it the engine is wrong.

     node scripts/gen-token-names.mjs            rewrite names.ts
     node scripts/gen-token-names.mjs --check    exit 1 if stale (CI)
   ═══════════════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const FIXTURE_NAME = "obsidian-2026-08-06.css";
const FIXTURE = join(ROOT, "src", "tokens", "__fixtures__", FIXTURE_NAME);
const TARGET = join(ROOT, "src", "tokens", "names.ts");
const LIGHT_SELECTOR = '[data-mui-color-scheme="light"]';

/** Body of the first top-level `selector { … }`, by brace matching. */
function ruleBody(css, selector) {
  const at = css.indexOf(selector + " {");
  if (at === -1) throw new Error(`selector not found in fixture: ${selector}`);
  const open = css.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}" && (depth -= 1) === 0) return css.slice(open + 1, i);
  }
  throw new Error(`unterminated rule: ${selector}`);
}

/* Comments are removed ONCE, before anything is tokenized.
 *
 * Not a tidiness preference — the previous version stripped them inside flush(),
 * i.e. AFTER splitting on `;`, and a semicolon inside a comment therefore ended a
 * "declaration" in the middle of that comment. The two halves then each failed the
 * `startsWith("--")` test (one began with the comment's opening `/*`, the other
 * carried a stray `*​/` before the real name) and BOTH were dropped — silently,
 * with a green `--check`.
 *
 * It cost a real token: `--on-brand-ink`, whose doc comment contains
 * "…flagged rather than made here; until then…", was absent from the entire ABI.
 * That is the exact failure this generator exists to prevent — and it went
 * unnoticed because a missing name looks identical to a name that was never
 * there. Strip first, tokenize second: the ordering IS the fix. */
const stripComments = (text) => text.replaceAll(/\/\*[\s\S]*?\*\//g, "");

/** Custom properties in source order. Paren-aware so `rgb(a, b)` is not split. */
function customProps(body) {
  const out = new Map();
  let depth = 0;
  let buf = "";
  const flush = () => {
    const decl = buf.trim();
    buf = "";
    const at = decl.indexOf(":");
    if (at === -1) return;
    const name = decl.slice(0, at).trim();
    if (name.startsWith("--")) out.set(name, decl.slice(at + 1).trim().replaceAll(/\s+/g, " "));
  };
  for (const ch of body) {
    if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    if (ch === ";" && depth === 0) flush();
    else buf += ch;
  }
  flush();
  return out;
}

const css = stripComments(readFileSync(FIXTURE, "utf8").replaceAll(/\r\n/g, "\n"));
const root = customProps(ruleBody(css, ":root"));
const light = customProps(ruleBody(css, LIGHT_SELECTOR));

/* Provenance is emitted BY the CDN emitter, not derived from a brand seed.
   Including it in the brand ABI would make every preset owe a value for a
   field only the publisher can know. */
const PROVENANCE = ["--tokens-version", "--tokens-brand"];
const version = (root.get("--tokens-version") ?? '""').replace(/"/g, "");

const rootNames = [...root.keys()].filter((n) => !PROVENANCE.includes(n));
const lightNames = [...light.keys()].filter((n) => !PROVENANCE.includes(n));
const channelNames = rootNames.filter((n) => n.endsWith("-channel"));

/* A channel token must be the space-separated RGB triple of its base token —
   32 call sites across the two packages do `rgb(var(--x-channel) / α)`, and a
   brand that writes a hex there invalidates all of them at computed-value time
   with no error anywhere. Pairing them here lets the property test assert it
   for every preset instead of trusting a naming convention. */
/* The convention is `--x` / `--x-channel`, with two documented departures.
   `--amber-brand` breaks it: its triple is published as `--amber-channel`, not
   `--amber-brand-channel` (while its own siblings DO follow the rule, hence
   `--amber-deep-channel`). Left to the naming convention alone, the pairing
   invariant would quietly skip `--amber-channel` — a token that is wrong in
   every preset and asserted by nothing. An explicit table is the only honest
   way to express "this one is irregular, and here is what it pairs with".
   `--white-channel` / `--black-channel` have no `--white` / `--black` base at
   all (verified against the sheet); they are fixed overlay constants that do
   not follow a brand, so no pairing exists to assert. */
const CHANNEL_BASE_ALIASES = { "--amber-channel": "--amber-brand" };

const paired = [];
const orphanChannels = [];
for (const ch of channelNames) {
  const base = CHANNEL_BASE_ALIASES[ch] ?? ch.slice(0, -"-channel".length);
  if (root.has(base)) paired.push([ch, base]);
  else if (CHANNEL_BASE_ALIASES[ch]) throw new Error(`channel alias points at a missing base: ${ch} -> ${base}`);
  else orphanChannels.push(ch);
}

/* Names the light scheme redefines. A brand that flips a hue must flip these
   and nothing else, or a light page keeps a dark-surface value. */
const flipped = lightNames.filter((n) => root.get(n) !== light.get(n));

const list = (names) => names.map((n) => `  ${JSON.stringify(n)},`).join("\n");

const out = `/* GENERATED by scripts/gen-token-names.mjs — do not edit.
 * Run \`pnpm gen:tokens\`; \`pnpm gen:tokens:check\` fails CI when stale.
 *
 * Source of truth: src/tokens/__fixtures__/${FIXTURE_NAME}, a byte-verified
 * snapshot of the published sheet both design-system packages consume. */

/** The fixture these names were derived from. */
export const TOKENS_FIXTURE = ${JSON.stringify(FIXTURE_NAME)};

/** \`--tokens-version\` carried by that fixture. Content-hashed over the token
 *  NAME set, so it changes when the contract changes — not on every rebuild. */
export const TOKENS_VERSION = ${JSON.stringify(version)};

/** Every custom property a brand must define on \`:root\`. ${rootNames.length} names. */
export const ROOT_TOKEN_NAMES = [
${list(rootNames)}
] as const;

/** Custom properties the light scheme declares. ${lightNames.length} names,
 *  of which ${flipped.length} actually differ from their \`:root\` value. */
export const LIGHT_TOKEN_NAMES = [
${list(lightNames)}
] as const;

/** Light-scheme names whose value differs from \`:root\`. */
export const LIGHT_FLIPPED_TOKEN_NAMES = [
${list(flipped)}
] as const;

/** Space-separated \`R G B\` triples feeding \`rgb(var(--x-channel) / α)\`. */
export const CHANNEL_TOKEN_NAMES = [
${list(channelNames)}
] as const;

/** \`[channel, base]\` pairs. Invariant: channel === rgbTriple(base), in BOTH
 *  schemes. Asserted per-preset by the property tests. */
export const CHANNEL_PAIRS: ReadonlyArray<readonly [string, string]> = [
${paired.map(([c, b]) => `  [${JSON.stringify(c)}, ${JSON.stringify(b)}],`).join("\n")}
];

/** Channel tokens with no same-named base — they stand alone by design
 *  (e.g. a fixed white overlay), so the pairing invariant cannot apply. */
export const UNPAIRED_CHANNEL_TOKEN_NAMES = [
${list(orphanChannels)}
] as const;

/** Emitted by the CDN publisher, not derived from a brand seed. */
export const PROVENANCE_TOKEN_NAMES = [
${list(PROVENANCE)}
] as const;

export type TokenName = (typeof ROOT_TOKEN_NAMES)[number];

const TOKEN_NAME_SET: ReadonlySet<string> = new Set(ROOT_TOKEN_NAMES);

/** Guard for the brand document's \`overrides\` escape hatch. A typo'd token
 *  name is silently ignored by CSS, which is the worst available failure — so
 *  validation rejects it before it can reach a stylesheet. */
export function isTokenName(name: string): name is TokenName {
  return TOKEN_NAME_SET.has(name);
}
`;

const current = existsSync(TARGET) ? readFileSync(TARGET, "utf8").replaceAll(/\r\n/g, "\n") : null;

if (process.argv.includes("--check")) {
  if (current !== out) {
    console.error("✗ src/tokens/names.ts is stale — run `pnpm gen:tokens`");
    process.exit(1);
  }
  console.log(`✓ token ABI up to date (${rootNames.length} root, ${flipped.length} flip, ${channelNames.length} channels)`);
} else {
  writeFileSync(TARGET, out, "utf8");
  console.log(
    `✓ wrote src/tokens/names.ts — ${rootNames.length} root, ${lightNames.length} light (${flipped.length} flip), ` +
      `${channelNames.length} channels (${paired.length} paired, ${orphanChannels.length} unpaired), version ${version}`,
  );
}
