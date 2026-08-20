#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   Generates src/tokens/names.ts — the token ABI — from the checked-in fixture.

   WHY A GENERATOR AND NOT A HAND-WRITTEN LIST: these names are an ABI. Two
   published packages (@devopsnext/starterkit-button-component, -card-component)
   alias them and render a vendored obsidian default when one goes missing —
   silently, with no console error, on a page that is supposed to be branded.
   A hand-maintained list is how DESIGN.md fell 42 tokens behind the sheet.

   THE SOURCE IS THE DEFAULT PRESET'S OWN SHEET, and that is a downgrade worth
   stating plainly. It used to be src/tokens/__fixtures__/obsidian-2026-08-06.css
   — a byte-verified snapshot of a hand-tuned sheet that predated this engine, so
   the ABI was defined by something the engine had to MATCH rather than by
   something it produced. Deleting obsidian deletes that independent anchor:
   names.ts now describes what the engine emits, and can no longer disagree with
   it. What survives is that a token DISAPPEARING is still loud (the two sibling
   packages' aliases are checked against ROOT_TOKEN_NAMES by property.test.ts
   assertion 15), and that the colour MATHS keeps its brand-free anchors —
   contrast.test.ts, deltaE.test.ts's Sharma/Wu/Dalal reference data and its
   20k-pair culori cross-check, oklch.test.ts, gamut.test.ts.

   ORDER COMES FROM THE PRESET, NOT FROM THIS FILE'S OWN OUTPUT. presets/<id>.css
   is serialized with `order: Object.keys(preset.provenance)` precisely so this
   generator reads an order it did not itself produce. Without that, sheet order
   would be "whatever names.ts said last time", seeded by a file that no longer
   exists — i.e. alphabetical forever.

     node scripts/gen-token-names.mjs            rewrite names.ts
     node scripts/gen-token-names.mjs --check    exit 1 if stale (CI)
   ═══════════════════════════════════════════════════════════════════════════ */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
/* The default preset's emitted sheet. Kept as one constant rather than derived
   from PRESET_IDS[0]: this script is plain Node and cannot import the TypeScript
   catalogue, and a generator that guessed its own input is worse than one that
   names it. src/presets/index.ts exports DEFAULT_PRESET_ID; schema.test.ts and
   property.test.ts are what keep the two agreeing. */
const SOURCE_PRESET = "think";
const FIXTURE_NAME = `presets/${SOURCE_PRESET}.css`;
const FIXTURE = join(ROOT, "presets", `${SOURCE_PRESET}.css`);
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

const rootNames = [...root.keys()].filter((n) => !PROVENANCE.includes(n));

/* COMPUTED, never read back out of the sheet.
   `--tokens-version` in presets/<id>.css is written BY the emitter FROM this
   constant, so parsing it back would make the version a fixed point of itself —
   it could never change, whatever the ABI did. Hashing the name set is what the
   doc comment always claimed this was, and it makes the version change exactly
   when the contract does and not on every rebuild. */
const version = createHash("sha256")
  .update(rootNames.join("\n"))
  .digest("hex")
  .slice(0, 12);
const lightNames = [...light.keys()].filter((n) => !PROVENANCE.includes(n));
const channelNames = rootNames.filter((n) => n.endsWith("-channel"));

/* A channel token must be the space-separated RGB triple of its base token —
   32 call sites across the two packages do `rgb(var(--x-channel) / α)`, and a
   brand that writes a hex there invalidates all of them at computed-value time
   with no error anywhere. Pairing them here lets the property test assert it
   for every preset instead of trusting a naming convention. */
/* The convention is `--x` / `--x-channel`, and under the semantic ABI there are
   now NO irregular pairings — the old `--amber-channel` -> `--amber-brand`
   departure went away with the hue-named families, which is one of the concrete
   things the rename bought. The table stays (empty) rather than being deleted,
   because the honest way to express a future irregular pairing is a row here,
   not a special case in the loop below.
   `--white-channel` / `--black-channel` have no `--white` / `--black` base at
   all; they are fixed overlay constants that do not follow a brand, so no
   pairing exists to assert and they fall through to `orphanChannels`. */
const CHANNEL_BASE_ALIASES = {};

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
 * Source of truth: ${FIXTURE_NAME} — the default preset's emitted sheet, whose
 * order comes from sheetOrder() in src/presets/base.ts. */

/** The sheet these names were derived from. */
export const TOKENS_FIXTURE = ${JSON.stringify(FIXTURE_NAME)};

/** Content hash over the token NAME set, so it changes when the contract
 *  changes — not on every rebuild. Emitted into every sheet as
 *  \`--tokens-version\`, and computed here rather than read back from one. */
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
