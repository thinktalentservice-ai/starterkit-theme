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
  },
});
