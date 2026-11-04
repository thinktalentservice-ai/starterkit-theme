import { describe, expect, it } from "vitest";
import { createStarterkitTheme, PALETTE_INTENTIONS, REQUIRED_INTENTION_KEYS } from "./index";

/* Regression test for the exact bug `PALETTE_INTENTIONS`'s doc comment warns
 * about: MUI's `augmentColor()` runs over every palette intention and derives
 * any key a theme didn't supply explicitly. Derivation parses the colour —
 * and `var(--primary)` is unparseable — so a missing key throws at
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

  it("primary/secondary/warning/error/info token names match the new semantic ABI, both schemes", () => {
    // Spot-checks, not full byte parity: the migration's whole premise is
    // "same role, new var() names" — a couple of concrete assertions catch
    // a copy-paste token-name typo that "does not throw" cannot, since a wrong
    // but still-parseable-looking var() name never throws at creation time.
    for (const scheme of ["dark", "light"] as const) {
      const palette = theme.colorSchemes[scheme]!.palette;
      expect(palette.primary.main, scheme).toBe("var(--primary)");
      expect(palette.primary.contrastText, scheme).toBe("var(--primary-on-solid)");
      expect(palette.secondary.main, scheme).toBe("var(--secondary)");
      expect(palette.warning.main, scheme).toBe("var(--warning)");
      // `error` is the one PALETTE_INTENTIONS key whose family name diverges
      // from the MUI key: the ABI's `danger` family backs MUI's `error`.
      expect(palette.error.main, scheme).toBe("var(--danger)");
      // `info` now backs directly onto the ABI's own `info` family — it used to
      // borrow `--accent`, which collided the brand's own accent hue with a
      // categorical status colour. `info` is real now, not a stand-in.
      expect(palette.info.main, scheme).toBe("var(--info)");
      // `accent` / `accentGreen` / `accentPink` are not standard MUI
      // intentions (see `PALETTE_INTENTIONS`'s doc comment) but are still
      // full palette colours, reachable the same way as any built-in one.
      expect(palette.accent.main, scheme).toBe("var(--accent)");
      expect(palette.accentGreen.main, scheme).toBe("var(--accent-green)");
      expect(palette.accentPink.main, scheme).toBe("var(--accent-pink)");
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
    expect(filled.backgroundColor).toBe("var(--success)");
    expect(filled.color).toBe("var(--success-on-solid)");
  });

  describe("solid-fill overrides (MuiButton / MuiFab / MuiChip / MuiBadge)", () => {
    // These read ownerState; the earlier containedPrimary keys were inert on MUI v9.
    const so = theme.components as any;
    const call = (slot: any, ownerState: Record<string, unknown>) => slot({ ownerState, theme });

    it("contained error button fills with the danger SOLID rung and its measured ink", () => {
      const r = call(so.MuiButton.styleOverrides.root, { variant: "contained", color: "error" });
      expect(r.backgroundColor).toBe("var(--danger-solid)");
      expect(r.color).toBe("var(--danger-on-solid)");
      expect(r["&:hover"].backgroundColor).toBe("var(--danger-solid-hover)");
    });

    it("contained primary adds the gradient as backgroundImage, never the shorthand", () => {
      const r = call(so.MuiButton.styleOverrides.root, { variant: "contained", color: "primary" });
      expect(r.backgroundImage).toBe("var(--gradient-primary)");
      expect(r.background).toBeUndefined();
      expect(r.boxShadow).toBe("var(--shadow-btn-primary)");
    });

    it("disabled and loading buttons keep the radius but get no fill", () => {
      for (const extra of [{ disabled: true }, { loading: true }]) {
        const r = call(so.MuiButton.styleOverrides.root, { variant: "contained", color: "primary", ...extra });
        expect(r).toEqual({ borderRadius: "var(--radius-chip)" });
      }
    });

    it("non-contained buttons are untouched by root", () => {
      expect(call(so.MuiButton.styleOverrides.root, { variant: "outlined", color: "primary" })).toEqual({});
    });

    it("a prototype-chain colour name never reaches a var() reference", () => {
      for (const color of ["constructor", "toString", "__proto__"]) {
        const r = call(so.MuiButton.styleOverrides.root, { variant: "contained", color });
        expect(JSON.stringify(r)).not.toContain("function");
        expect(r.backgroundColor).toBeUndefined();
      }
    });

    it("Fab, filled Chip and Badge use the solid rung; default / outlined / disabled do not", () => {
      expect(call(so.MuiFab.styleOverrides.root, { color: "primary" }).backgroundColor).toBe("var(--primary-solid)");
      expect(call(so.MuiFab.styleOverrides.root, { color: "default" })).toEqual({});
      expect(call(so.MuiFab.styleOverrides.root, { color: "primary", disabled: true })).toEqual({});
      expect(call(so.MuiChip.styleOverrides.root, { variant: "filled", color: "info" }).backgroundColor).toBe("var(--info-solid)");
      expect(call(so.MuiChip.styleOverrides.root, { variant: "outlined", color: "info" }).backgroundColor).toBeUndefined();
      expect(call(so.MuiChip.styleOverrides.root, { variant: "filled", color: "default" }).backgroundColor).toBeUndefined();
      expect(call(so.MuiBadge.styleOverrides.badge, { color: "error" }).backgroundColor).toBe("var(--danger-solid)");
      expect(call(so.MuiBadge.styleOverrides.badge, { color: "default" })).toEqual({});
    });
  });

  describe("input typography (MuiInputBase)", () => {
    // Every MUI text field (TextField outlined/filled/standard, Autocomplete, multiline,
    // Select's input) renders through InputBase, so this one slot is the only place the
    // placeholder size can be fixed for all of them. Without it the input inherits
    // typography.body1 (15px) and reads bigger than the 14px Bootstrap inputs beside it.
    const ib = (theme.components as any).MuiInputBase.styleOverrides;

    it("typed text is 14px, not the 15px body1 it would inherit", () => {
      expect(ib.root.fontSize).toBe("0.875rem");
    });

    it("::placeholder is pinned to 13px on the input slot", () => {
      expect(ib.input["&::placeholder"].fontSize).toBe("13px");
    });


    it("does not override placeholder colour or opacity (MUI owns those)", () => {
      expect(Object.keys(ib.input["&::placeholder"])).toEqual(["fontSize"]);
    });
  });
});
