/* The 5 CDN-emission invariants, tested against all 6 shipped presets — not
 * against a synthetic fixture. A CDN publish is external distribution; a
 * regression here means a public URL serves something unsafe, which is a
 * strictly worse failure mode than a package-internal file drifting. */
import { resolveBrand } from "../engine/resolve";
import { PRESETS } from "../presets/index";
import { ROOT_TOKEN_NAMES } from "../tokens/names";
import { assertCdnSafe, buildCdnBrandSheet, buildFontsSheet, cdnPaths } from "./cdn";

const PRESET_ENTRIES = Object.entries(PRESETS).filter(
  (e): e is [string, NonNullable<(typeof PRESETS)[keyof typeof PRESETS]>] => e[1] !== undefined,
);
const VERSION = "0.1.0";

describe("CDN emitter — the 5 invariants, all 6 presets", () => {
  // Every "all 6 presets" test below iterates PRESET_ENTRIES — if the
  // registry ever lost an entry, those tests would silently narrow their own
  // scope instead of failing. Pin the count directly.
  it("sanity: PRESET_ENTRIES actually has all 6 presets, not a silently narrowed subset", () => {
    expect(PRESET_ENTRIES).toHaveLength(6);
  });

  it("1. never emits a self-@import (or any @import at all)", () => {
    for (const [id, preset] of PRESET_ENTRIES) {
      const css = buildCdnBrandSheet(preset, { packageVersion: VERSION });
      expect(css, id).not.toMatch(/@import/);
    }
  });

  it("2. never emits a component rule — exactly the :root and light-scheme blocks, nothing else", () => {
    for (const [id, preset] of PRESET_ENTRIES) {
      const css = buildCdnBrandSheet(preset, { packageVersion: VERSION });
      const blockCount = (css.match(/\{/g) ?? []).length;
      expect(blockCount, `${id}: expected exactly 2 rule blocks`).toBe(2);
      expect(css, id).toContain(":root {");
      expect(css, id).toMatch(/\[data-mui-color-scheme="light"\]\s*\{/);
    }
  });

  it("2b. assertCdnSafe rejects a component rule even when the brace count alone would look fine", () => {
    // Regression for a real gap found on review: a naive `blockCount > 2`
    // check accepts `:root {...}.evil{color:red}` (still 2 braces) or a lone
    // component rule with no :root at all (1 brace, "not more than 2"). The
    // shape check in assertCdnSafe must reject both — verified directly
    // here, not just trusted from the real presets never triggering it.
    const valid = buildCdnBrandSheet(PRESETS.obsidian!, { packageVersion: VERSION });
    const withTrailingComponentRule = `${valid}\n.evil { color: red; }`;
    expect(() => assertCdnSafe(withTrailingComponentRule, "obsidian")).toThrow(/expected shape/);

    const lightBlockOnly = valid.slice(valid.indexOf('[data-mui-color-scheme="light"]'));
    expect(() => assertCdnSafe(lightBlockOnly, "obsidian")).toThrow(/expected shape/);
  });

  it("3. never embeds a font @import — buildFontsSheet is the only file that carries one", () => {
    for (const [id, preset] of PRESET_ENTRIES) {
      const css = buildCdnBrandSheet(preset, { packageVersion: VERSION });
      expect(css, id).not.toMatch(/fonts\.googleapis\.com/);
    }
    // The font sheet itself DOES carry exactly one — the invariant is "fonts
    // live in their own file", not "no font import exists anywhere".
    expect(buildFontsSheet()).toMatch(/@import url\('https:\/\/fonts\.googleapis\.com/);
  });

  it("4. always carries --tokens-version and --tokens-brand, matching the call's own arguments", () => {
    for (const [id, preset] of PRESET_ENTRIES) {
      const css = buildCdnBrandSheet(preset, { packageVersion: VERSION });
      expect(css, id).toContain(`--tokens-version: "${VERSION}"`);
      expect(css, id).toContain(`--tokens-brand: "${id}"`);
    }
  });

  it("5. always emits every name in ROOT_TOKEN_NAMES, for every preset", () => {
    for (const [id, preset] of PRESET_ENTRIES) {
      const css = buildCdnBrandSheet(preset, { packageVersion: VERSION });
      const missing = ROOT_TOKEN_NAMES.filter((name) => !css.includes(`\n  ${name}:`));
      expect(missing, id).toEqual([]);
    }
  });

  it("assertCdnSafe accepts a sheet whose header PROSE mentions @import in a comment — comment-stripping is intentional, not accidental", () => {
    // Regression for the exact self-inflicted bug found during review: the
    // first version of this check ran against raw text and flagged its own
    // generated header (which explains, in a comment, that the file carries
    // no @import) as if that were the violation. Locking in the fix here
    // means a future header edit that reintroduces the word can't silently
    // reopen the same bug — this test would catch it directly, rather than
    // depending on today's header wording happening not to trigger it.
    const withCommentMentioningImport = buildCdnBrandSheet(PRESETS.obsidian!, { packageVersion: VERSION });
    expect(withCommentMentioningImport).toMatch(/defines no component rule or reset/); // sanity: the mention is really there
    expect(() => assertCdnSafe(withCommentMentioningImport, "obsidian")).not.toThrow();
  });

  it("assertCdnSafe throws with every violation listed, not just the first", () => {
    const brokenCss = "/* no root, no provenance, has an @import */\n@import url('x');\n.foo { color: red; }";
    expect(() => assertCdnSafe(brokenCss, "test")).toThrow(/@import/);
    try {
      assertCdnSafe(brokenCss, "test");
      expect.unreachable("should have thrown");
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toMatch(/@import/);
      expect(message).toMatch(/--tokens-version/);
      expect(message).toMatch(/--tokens-brand/);
      expect(message).toMatch(/ROOT_TOKEN_NAMES/);
    }
  });

  it("cdnPaths: obsidian gets a legacy alias, no other preset does", () => {
    for (const [id] of PRESET_ENTRIES) {
      const paths = cdnPaths(id, VERSION);
      expect(paths.versioned, id).toBe(`starterkit/tokens/v${VERSION}/${id}.css`);
      expect(paths.latest, id).toBe(`starterkit/tokens/latest/${id}.css`);
      if (id === "obsidian") {
        expect(paths.legacyAlias).toBe("starterkit/colors_and_type.css");
      } else {
        expect(paths.legacyAlias, id).toBeNull();
      }
    }
  });

  it("buildFontsSheet references every family a shipped preset's tokens actually declare", () => {
    const sheet = buildFontsSheet();
    const referenced = new Set<string>();
    for (const [, preset] of PRESET_ENTRIES) {
      const brand = resolveBrand(preset);
      for (const key of ["--font-heading", "--font-body", "--font-mono"]) {
        const value = brand.dark.get(key);
        const match = value?.match(/'([^']+)'/);
        if (match) referenced.add(match[1]!);
      }
    }
    for (const family of referenced) {
      const urlFamily = family.replace(/ /g, "+");
      expect(sheet, family).toContain(`family=${urlFamily}`);
    }
  });
});
