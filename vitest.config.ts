import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    globals: true,
    // The engine is pure and runs under plain Node — that is the point of the
    // two-config tsup split, so the default test environment matches it.
    // `src/react/**` opts into jsdom per-file with a @vitest-environment docblock.
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // The default 5000ms is tight for contrast.test.ts's exhaustive OKLCH
    // bisection and fuzz.test.ts's 500-run property test — both measured
    // comfortably under 5s running alone (~3-6.5s) but cross the default
    // timeout under full-suite CPU contention (confirmed 2026-08-07: same
    // files pass 27/27 and 1/1 in isolation, then time out as part of the
    // full ~117-test run). Raised with real margin above the slowest
    // isolated measurement, not raised until red went away.
    testTimeout: 20000,
  },
});
