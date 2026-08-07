/* A CSS custom-property reader, used by the golden test, the validator and the
 * CDN emitter.
 *
 * There is no third-party parser here for the same reason there is no colour
 * library: this package runs in a build script, a route handler and possibly the
 * edge, and 80 lines of brace matching is not worth a dependency.
 *
 * COMMENTS ARE REMOVED BEFORE ANYTHING IS TOKENIZED, and that ordering is the
 * whole correctness story. A previous version stripped them after splitting on
 * `;` — so a semicolon inside a comment ended a "declaration" mid-comment, and
 * the real declaration that followed was silently dropped. It cost the ABI a
 * token (`--on-brand-ink`, whose doc comment contains "…made here; until then…")
 * and nothing failed, because a name that was never parsed looks exactly like a
 * name that was never there.
 */

/** Strip `/* … *​/` comments. Run this first, always. */
/* `.replace(/…/g, …)` and not `.replaceAll` throughout this package: replaceAll
   is ES2021, and a published library should not raise its declared floor for a
   method that buys nothing over a `g` flag. */
export const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * Body of the first top-level `selector { … }`, by brace matching.
 *
 * Brace matching rather than a regex because the light-scheme rule is not the
 * last rule in the sheet and `[\s\S]*?\}` would stop at the first nested close.
 */
export function ruleBody(css: string, selector: string): string {
  const at = css.indexOf(`${selector} {`);
  if (at === -1) throw new Error(`selector not found: ${selector}`);
  const open = css.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`unterminated rule: ${selector}`);
}

/**
 * Custom properties of a rule body, in source order.
 *
 * Paren-aware, so the `;`-less commas inside `rgba(a, b, c, d)` and the nested
 * parens of `linear-gradient(135deg, var(--x), var(--y))` do not split a value.
 * Whitespace inside values is collapsed: the fixture aligns some declarations
 * with extra spaces, and a token's value is not different for being padded.
 */
export function customProps(body: string): Map<string, string> {
  const out = new Map<string, string>();
  let depth = 0;
  let buf = "";

  const flush = (): void => {
    const decl = buf.trim();
    buf = "";
    const at = decl.indexOf(":");
    if (at === -1) return;
    const name = decl.slice(0, at).trim();
    if (name.startsWith("--")) out.set(name, decl.slice(at + 1).trim().replace(/\s+/g, " "));
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

/** Comment-strip + brace-match + read, the combination every caller wants. */
export function readTokens(css: string, selector: string): Map<string, string> {
  return customProps(ruleBody(stripComments(css.split("\r\n").join("\n")), selector));
}
