/** @vitest-environment jsdom */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { createStarterkitTheme } from "../mui/index";
import { BRAND_STYLE_ELEMENT_ID, BrandProvider, useBrand, useConcreteTheme, ThemeToggle } from "./index";

/* jsdom doesn't implement `matchMedia`. Without it MUI's `useColorScheme`
 * still works (`mode`/`setMode` don't depend on it) but can never resolve a
 * concrete `colorScheme` from "system" — every `useConcreteTheme()` call
 * would hit its "dark" fallback branch and the fallback is all the test
 * could ever observe. Polyfilling it here (not in vitest.config.ts, which
 * this phase doesn't touch) lets the resolved-scheme assertion below be
 * a real one. */
beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
});

const theme = createStarterkitTheme();

describe("BrandProvider / useBrand", () => {
  it("renders exactly one <style id=brand-vars> with the given css, and renders children", () => {
    const css = ':root[data-mui-color-scheme="dark"] { --mint: #10b981; }';
    const { container } = render(
      <BrandProvider id="think" css={css} theme={theme}>
        <div data-testid="child">hello</div>
      </BrandProvider>,
    );

    const styleEls = container.querySelectorAll(`#${BRAND_STYLE_ELEMENT_ID}`);
    expect(styleEls).toHaveLength(1);
    expect(styleEls[0]?.tagName).toBe("STYLE");
    expect(styleEls[0]?.innerHTML).toBe(css);

    expect(screen.getByTestId("child").textContent).toBe("hello");
  });

  it("useBrand() throws when called outside a BrandProvider", () => {
    function Consumer() {
      useBrand();
      return null;
    }

    // A component throwing during render logs to console.error twice (the
    // error itself, plus React's "above error occurred in" boundary notice).
    // That's expected here — this is the one test that provokes it on
    // purpose — so it's suppressed rather than left to spam the run.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(<Consumer />)).toThrow("useBrand must be used within a BrandProvider");
    } finally {
      consoleError.mockRestore();
    }
  });

  it("useBrand() returns the exact { id, css } passed to the nearest BrandProvider", () => {
    const css = ':root[data-mui-color-scheme="light"] { --mint: #059669; }';
    let observed: { id?: string; css: string } | null = null;

    function Consumer() {
      observed = useBrand();
      return null;
    }

    render(
      <BrandProvider id="think" css={css} theme={theme}>
        <Consumer />
      </BrandProvider>,
    );

    expect(observed).toEqual({ id: "think", css });
  });
});

describe("ThemeToggle", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("cycles light -> dark -> system -> light via clicks, and aria-label reflects each state", () => {
    render(
      <ThemeProvider theme={theme}>
        <ThemeToggle />
      </ThemeProvider>,
    );

    const button = screen.getByRole("button");
    // No stored preference: MUI's own default mode is "system".
    expect(button.getAttribute("aria-label")).toBe("Theme: system. Click to change.");

    fireEvent.click(button);
    expect(button.getAttribute("aria-label")).toBe("Theme: light. Click to change.");

    fireEvent.click(button);
    expect(button.getAttribute("aria-label")).toBe("Theme: dark. Click to change.");

    fireEvent.click(button);
    expect(button.getAttribute("aria-label")).toBe("Theme: system. Click to change.");

    fireEvent.click(button);
    expect(button.getAttribute("aria-label")).toBe("Theme: light. Click to change.");
  });

  it("accepts a className prop", () => {
    render(
      <ThemeProvider theme={theme}>
        <ThemeToggle className="my-toggle" />
      </ThemeProvider>,
    );
    expect(screen.getByRole("button").classList.contains("my-toggle")).toBe(true);
  });
});

describe("useConcreteTheme", () => {
  it("resolves the polyfilled matchMedia's system preference, not a hardcoded value", () => {
    // The `beforeAll` polyfill above answers `matches: false` for
    // "(prefers-color-scheme: dark)", which MUI resolves to "light". Asserting
    // the specific value (not `["light","dark"]).toContain(...)`) is what makes
    // this test capable of catching a hook that silently ignores MUI's
    // resolution and always answers one hardcoded scheme regardless of input.
    let observed: string | null = null;

    function Probe() {
      observed = useConcreteTheme();
      return null;
    }

    render(
      <ThemeProvider theme={theme}>
        <Probe />
      </ThemeProvider>,
    );

    expect(observed).toBe("light");
  });

  it("falls back to the theme's OWN defaultColorScheme, not a hardcoded one, before mode resolves", () => {
    // Regression test for a real bug caught in review: the first implementation
    // fell back to a hardcoded "dark" whenever MUI's `colorScheme` was
    // undefined, which disagrees with the rendered CSS for any theme actually
    // configured with `defaultColorScheme: "light"`. `useTheme()`'s
    // `defaultColorScheme` is available synchronously (it's a static theme
    // property, not resolved state), so this checks the very first render —
    // before `useColorScheme()`'s effects have had a chance to run — is
    // already correct, not just eventually correct after `useConcreteTheme`'s
    // own fallback kicks in the same way `colorScheme` does.
    const lightTheme = createStarterkitTheme({ defaultColorScheme: "light" });
    let firstRenderValue: string | null = null;

    function Probe() {
      const value = useConcreteTheme();
      if (firstRenderValue === null) firstRenderValue = value;
      return null;
    }

    render(
      <ThemeProvider theme={lightTheme}>
        <Probe />
      </ThemeProvider>,
    );

    expect(firstRenderValue).toBe("light");
  });
});
