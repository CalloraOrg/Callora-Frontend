// @vitest-environment node
//
// This suite inspects the config as a module (which pulls in esbuild via
// `vitest/config`) and reads files from disk, so it must run in the node
// environment rather than jsdom.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import config from "../vitest.config";

/**
 * Guard tests for the Vitest coverage gate (issue #1131).
 *
 * These lock in the coverage configuration so it cannot silently regress:
 * the v8 provider, text + lcov reporters, the source include list, the
 * test/mock/setup exclusions, non-zero global thresholds, and a single
 * source of truth for test settings (vitest.config.ts, not vite.config.ts).
 */
type CoverageConfig = {
  provider?: string;
  reporter?: string | string[];
  include?: string[];
  exclude?: string[];
  thresholds?: Record<string, number>;
};

type TestConfig = {
  include?: string[];
  setupFiles?: string[];
  coverage?: CoverageConfig;
};

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const testConfig = ((config as { test?: TestConfig }).test ?? {}) as TestConfig;

describe("vitest coverage configuration (#1131)", () => {
  it("uses the v8 coverage provider", () => {
    expect(testConfig.coverage?.provider).toBe("v8");
  });

  it("emits both text and lcov reporters", () => {
    expect(testConfig.coverage?.reporter).toEqual(["text", "lcov"]);
  });

  it("measures every source file under src/**", () => {
    expect(testConfig.coverage?.include).toContain("src/**/*.{ts,tsx}");
  });

  it("excludes tests, mocks and setupTests.ts from coverage", () => {
    const exclude = testConfig.coverage?.exclude ?? [];
    expect(exclude).toContain("src/**/*.test.{ts,tsx}");
    expect(exclude).toContain("src/setupTests.ts");
    expect(exclude.some((pattern) => pattern.includes("__mocks__"))).toBe(true);
  });

  it("defines non-zero global thresholds for every metric", () => {
    const thresholds = testConfig.coverage?.thresholds ?? {};
    for (const metric of ["lines", "statements", "functions", "branches"]) {
      expect(thresholds[metric], `missing ${metric} threshold`).toBeGreaterThan(0);
    }
  });

  it("keeps test settings out of vite.config.ts", () => {
    const viteConfig = readFileSync(
      path.join(projectRoot, "vite.config.ts"),
      "utf8",
    );
    // A top-level `test:` key in vite.config.ts would duplicate (and could
    // silently override) the settings in vitest.config.ts.
    expect(viteConfig).not.toMatch(/(^|\n)\s*test\s*:/);
  });
});
