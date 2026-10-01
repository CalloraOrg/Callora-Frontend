// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    // Only files matching these patterns are treated as test suites.
    include: ["src/**/*.test.{ts,tsx}"],
    // Enable CSS handling if components import CSS.
    css: true,
    setupFiles: ["src/setupTests.ts"],
    coverage: {
      // V8 is the provider already shipped via @vitest/coverage-v8.
      provider: "v8",
      // `text` prints the per-file table; `lcov` feeds CI/code-review tooling.
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      // Still emit the report (and evaluate thresholds) when a suite fails,
      // so coverage gaps are visible instead of hidden behind a failing run.
      reportOnFailure: true,
      // Measure every source module, including ones no test imports yet, so
      // untested files (App.tsx, Toast.tsx, Pagination.tsx, ...) surface as 0%.
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "src/**/__mocks__/**",
        "src/**/*.mock.{ts,tsx}",
        "src/**/*.d.ts",
        "src/setupTests.ts",
      ],
      // Modest global floors that currently pass with headroom; ratchet these
      // up as coverage improves. See issue #1131.
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 70,
        branches: 80,
      },
    },
  },
});
