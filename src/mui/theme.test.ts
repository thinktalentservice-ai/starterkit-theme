import { describe, expect, it } from "vitest";
import { createStarterkitTheme, PALETTE_INTENTIONS, REQUIRED_INTENTION_KEYS } from "./index";

/* Regression test for the exact bug `PALETTE_INTENTIONS`'s doc comment warns
 * about: MUI's `augmentColor()` runs over every palette intention and derives
 * any key a theme didn't supply explicitly. Derivation parses the colour —
 * and `var(--mint)` is unparseable — so a missing key throws at
 * `createTheme()` time, i.e. at build/import time, not later when a component
 * happens to render. */
describe("createStarterkitTheme", () => {
  it("does not throw with no options", () => {
    expect(() => createStarterkitTheme()).not.toThrow();
  });

  it('does not throw with { defaultColorScheme: "light" }', () => {
    expect(() => createStarterkitTheme({ defaultColorScheme: "light" })).not.toThrow();
  });

  const theme = createStarterkitTheme();

  for (const scheme of ["dark", "light"] as const) {
    for (const intention of PALETTE_INTENTIONS) {
      it(`${scheme} palette's "${intention}" intention defines every required key`, () => {
        const colorSystem = theme.colorSchemes[scheme];
        expect(colorSystem, scheme).toBeDefined();
        const paletteColor = colorSystem!.palette[intention] as unknown as Record<string, unknown>;
        for (const key of REQUIRED_INTENTION_KEYS) {
          expect(paletteColor[key], `${scheme}.${intention}.${key}`).toBeDefined();
        }
      });
    }
  }

  it("divider is defined and dividerChannel is explicitly present but undefined, not merely absent", () => {
    const dark = theme.colorSchemes.dark;
    expect(dark).toBeDefined();
    expect(dark!.palette.divider).not.toBeUndefined();
    // MUI's auto-derivation guard is `if (!('dividerChannel' in obj))` — a
    // PROPERTY-PRESENCE check, not a value check. `toBeUndefined()` alone
    // can't tell "key present, value undefined" (what this theme sets, on
    // purpose) apart from "key absent" (which would trigger MUI's derivation
    // and silently regenerate a dividerChannel from an rgba() it can't parse,
    // the exact failure this whole module exists to prevent).
    expect("dividerChannel" in dark!.palette).toBe(true);
    expect(dark!.palette.dividerChannel).toBeUndefined();
  });

  it("primary/secondary/warning token names match the host sheet exactly, both schemes", () => {
    // Spot-checks, not full byte parity: the migration's whole premise is
    // "same var() names, same values" — a couple of concrete assertions catch
    // a copy-paste token-name typo that "does not throw" cannot, since a wrong
    // but still-parseable-looking var() name never throws at creation time.
    for (const scheme of ["dark", "light"] as const) {
      const palette = theme.colorSchemes[scheme]!.palette;
      expect(palette.primary.main, scheme).toBe("var(--mint)");
      expect(palette.primary.contrastText, scheme).toBe("#ffffff");
      expect(palette.secondary.main, scheme).toBe("var(--electric)");
      expect(palette.warning.main, scheme).toBe("var(--amber-brand)");
      expect(palette.error.main, scheme).toBe("var(--rose)");
      expect(palette.background.default, scheme).toBe("var(--background)");
      expect(palette.text.primary, scheme).toBe("var(--fg1)");
    }
  });

  it("MuiCard and MuiAlert overrides carry the host's exact token references", () => {
    const card = theme.components?.MuiCard?.styleOverrides?.root as Record<string, unknown>;
    expect(card.backgroundColor).toBe("var(--card)");
    expect(card.boxShadow).toBe("var(--shadow-card)");

    const alertRoot = theme.components?.MuiAlert?.styleOverrides?.root;
    expect(typeof alertRoot).toBe("function");
    const filled = (alertRoot as (ctx: { ownerState: { variant: string; color: string } }) => Record<string, unknown>)({
      ownerState: { variant: "filled", color: "success" },
    });
    expect(filled.backgroundColor).toBe("var(--mint)");
    expect(filled.color).toBe("var(--on-mint)");
  });
});
