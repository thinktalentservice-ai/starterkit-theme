/* The CDN distribution artifact — one token sheet per preset, safe to publish
 * to a public URL and `@import`/`<link>` into ANY page, not just this one.
 *
 * This supersedes a host-app stopgap (`scripts/gen-cdn-sheet.mjs` in
 * template-starterkit-nextjs) that derived a single CDN copy from one
 * hand-authored preset's sheet, because the published copy had gone two
 * months stale and was still serving a WCAG failure a hand-fix had already
 * corrected locally. That stopgap's own header names its replacement as
 * "phase 7b in @devopsnext/starterkit-theme, which emits one sheet per brand
 * preset" — this file is that replacement, generalized from one hand-tuned
 * sheet to every engine-resolved preset.
 *
 * FIVE INVARIANTS, ENFORCED HERE, NOT LEFT FOR A COMMENT TO PROMISE:
 *   1. never emit a self-@import
 *   2. never emit a component rule — tokens only
 *   3. never embed a font @import — fonts are `buildFontsSheet()`'s own file
 *   4. always carry --tokens-version / --tokens-brand
 *   5. always emit every name in ROOT_TOKEN_NAMES
 * `assertCdnSafe` below checks all five against the actual generated text,
 * every call, not just in a test that could go stale independently of the
 * code it was written to guard.
 */
import { resolveBrand } from "../engine/resolve";
import { serializeBrandCss } from "../engine/serialize";
import type { PresetSpec } from "../engine/spec";
import { DEFAULT_PRESET_ID } from "../presets/index";
import { ROOT_TOKEN_NAMES } from "../tokens/names";

export type CdnBrandSheetOptions = {
  /** This package's own `package.json` version — the CDN's immutable path is
   *  versioned by it (`tokens/v<version>/<id>.css`), not by a content hash:
   *  a published version is what a consumer's `sync-tokens.mjs` pins to, and
   *  a release is the unit that pin should track. */
  packageVersion: string;
};

/* Comments stripped BEFORE any check below runs — the same lesson
 * `src/engine/parse.ts` and `scripts/gen-token-names.mjs` already learned the
 * hard way (see either's header comment): the generated header prose here
 * literally contains the word "@import" while explaining that this file
 * doesn't have one, and a check run against the raw text would flag its own
 * documentation as the violation it's describing. Strip first, check second —
 * the ordering IS the fix, not a preference. */
const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * If `text` starts (after only whitespace already stripped by the caller)
 * with `selectorPrefix`, returns the index just past that block's matching
 * closing `}`. Returns -1 if the prefix isn't there or the block never closes.
 *
 * Brace-MATCHED, not regex-`[\s\S]*`-matched: a regex's wildcard can't tell
 * "the rest of this block's content" from "a second rule appended after it"
 * — `/\{[\s\S]*\}$/` matches `:root {...}.evil{color:red}` just fine, because
 * the greedy wildcard happily swallows the appended rule and the string still
 * ends in `}`. This is the exact gap found in review: a first version of this
 * check used that regex, and a component rule tacked onto a valid sheet slid
 * right through it. Depth-counted brace matching (the same technique
 * `src/engine/parse.ts`'s `ruleBody` already uses in this repo, for the
 * identical reason) can't be fooled that way — it tracks nesting, not text
 * shape. */
function consumeBlock(text: string, selectorPrefix: string): number {
  if (!text.startsWith(selectorPrefix)) return -1;
  const open = text.indexOf("{", selectorPrefix.length - 1);
  if (open === -1) return -1;
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}") {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/** Throws with every violation found, not just the first — a CDN publish is
 *  a batch of 6 sheets, and stopping at the first failure hides the other 5
 *  results from whoever is staring at a failed CI step deciding what to fix. */
export function assertCdnSafe(css: string, presetId: string): void {
  const problems: string[] = [];
  const code = stripComments(css).trim();

  // Case-insensitive: CSS at-rules are case-insensitive by spec, and this is
  // a general-purpose safety check (exported, callable on arbitrary CSS), not
  // only ever fed serializeBrandCss's own lowercase output.
  if (/@import/i.test(code)) {
    problems.push("contains an @import — a CDN sheet must be a leaf, never itself fetch anything");
  }

  // Exactly a `:root {...}` block followed by the light-scheme block, and
  // NOTHING else before, between, or after — see consumeBlock's doc comment
  // for why this has to be brace-matched rather than a regex.
  const afterRoot = consumeBlock(code, ":root");
  const afterLight = afterRoot === -1 ? -1 : consumeBlock(code.slice(afterRoot).trimStart(), '[data-mui-color-scheme="light"]');
  const trailing = afterLight === -1 ? "" : code.slice(afterRoot).trimStart().slice(afterLight).trim();
  if (afterRoot === -1 || afterLight === -1 || trailing !== "") {
    problems.push('does not match the expected shape — exactly one ":root {...}" block followed by one light-scheme block, nothing else');
  }

  if (!code.includes("--tokens-version:")) problems.push("missing --tokens-version");
  if (!code.includes("--tokens-brand:")) problems.push("missing --tokens-brand");

  const missing = ROOT_TOKEN_NAMES.filter((name) => !code.includes(`\n  ${name}:`));
  if (missing.length > 0) {
    problems.push(`missing ${missing.length} of ${ROOT_TOKEN_NAMES.length} ROOT_TOKEN_NAMES: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? ", …" : ""}`);
  }

  if (problems.length > 0) {
    throw new Error(`CDN sheet for "${presetId}" is unsafe to publish:\n  - ${problems.join("\n  - ")}`);
  }
}

/** One preset, resolved and serialized for CDN publication. Font `@import`s
 *  are deliberately absent (invariant 3) — a token sheet that forces three
 *  font families and a `fonts.googleapis.com` CSP entry onto every consumer,
 *  including ones that only want the colours, is not a token sheet. See
 *  `buildFontsSheet` for the font half, shipped as its own artifact so a
 *  consumer opts in once regardless of which brand(s) they load. */
export function buildCdnBrandSheet(preset: PresetSpec, options: CdnBrandSheetOptions): string {
  const brand = resolveBrand(preset);
  const header = `/* starterkit/tokens — ${preset.name} (${preset.id})
   ═══════════════════════════════════════════════════════════
   GENERATED by @devopsnext/starterkit-theme's CDN emitter (\`pnpm brand:emit
   --target=cdn\`). Do not hand-edit — a hand-edited copy is exactly how the
   previous CDN artifact drifted two months behind its source and kept
   serving a WCAG failure the source had already fixed.

   Safe to load into ANY page: every declaration here is a CSS custom
   property under :root or a light-scheme selector — this file fetches
   nothing of its own and defines no component rule or reset. Fonts are a
   separate file; see fonts.css.

   Consumer CSP: style-src <this origin>
   ═══════════════════════════════════════════════════════════ */`;

  const css = serializeBrandCss(brand, {
    header,
    provenance: { version: options.packageVersion, brand: preset.id },
  });

  assertCdnSafe(css, preset.id);
  return css;
}

/** The curated font whitelist, one `@import` per family actually referenced
 *  by a shipped preset's `--font-heading`/`--font-body`/`--font-mono`. Kept
 *  as ONE shared file rather than per-brand, so a consumer loads this once
 *  regardless of which brand(s) they end up rendering rather than
 *  re-fetching an overlapping set per brand switch. The family list below
 *  must stay cross-checked against every preset's literal font
 *  declarations, not assumed.
 *
 *  Weight lists are a reasonable default (400/500/600/700, plus 800 for
 *  headings), NOT verified against actual per-preset typography usage.
 *  Narrowing this once real pages using both presets exist is a follow-up,
 *  not a defect in this file. */
export function buildFontsSheet(): string {
  const families = [
    /* Outfit is no longer referenced by any shipped preset — `--font-heading`
       is Plus Jakarta Sans now, same as the body face. Kept in the whitelist
       so consumers who set their own heading face to Outfit against this
       shared sheet do not lose it; @import of an unused family costs one CSS
       response and downloads no font files. */
    "family=Outfit:wght@400;500;600;700;800",
    "family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400",
    "family=Inter+Tight:wght@400;500;600;700;800",
    "family=Inter:wght@400;500;600;700",
    "family=Fraunces:wght@400;500;600;700;800",
    "family=Source+Sans+3:wght@400;500;600;700",
    "family=Public+Sans:wght@400;500;600;700;800",
    "family=Geist:wght@400;500;600;700;800",
    "family=Geist+Mono:wght@400;500",
    "family=Space+Grotesk:wght@400;500;600;700",
  ];
  const url = `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap`;

  return `/* starterkit/fonts.css — the curated font whitelist for all 6 presets
   ═══════════════════════════════════════════════════════════
   GENERATED by @devopsnext/starterkit-theme's CDN emitter. One shared file,
   not one per brand — see this module's buildFontsSheet() doc comment for
   why. Load once; every preset's --font-heading/--font-body/--font-mono
   resolves against these families regardless of which brand is active.

   Consumer CSP: style-src <this origin> https://fonts.googleapis.com
                 font-src  https://fonts.gstatic.com
   ═══════════════════════════════════════════════════════════ */
@import url('${url}');
`;
}

export type CdnPaths = {
  /** Immutable — what a package's own `sync-tokens.mjs` pins to. */
  versioned: string;
  /** Short-cache — brand delivery for a consumer not tracking a pinned version. */
  latest: string;
  /** Only the default preset gets one: the pre-migration CDN URL a consumer
   *  or a published package's vendored-default generator may still
   *  reference. A fresh consumer should use `latest/<id>.css`; this exists
   *  so the exact URL that used to serve the old default preset's sheet
   *  keeps serving today's default preset's sheet, not a 404, for however
   *  long anything still points at it. Tracks `DEFAULT_PRESET_ID` from
   *  `../presets/index` — `src/presets/index.ts`'s own doc comment on that
   *  constant is what asserts the two must agree. */
  legacyAlias: string | null;
};

export function cdnPaths(presetId: string, packageVersion: string): CdnPaths {
  return {
    versioned: `starterkit/tokens/v${packageVersion}/${presetId}.css`,
    latest: `starterkit/tokens/latest/${presetId}.css`,
    legacyAlias: presetId === DEFAULT_PRESET_ID ? "starterkit/colors_and_type.css" : null,
  };
}
