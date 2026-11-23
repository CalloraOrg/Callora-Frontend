/**
 * Guards the configuration docs against drift from the code.
 *
 * Every `VITE_*` name the app reads must be documented twice: in
 * `.env.example` (as an active or commented assignment) and in
 * `docs/Configuration.md` (as a `###` heading). When a variable is added to
 * `src/` or `vite.config.ts` without those two entries, this test fails.
 *
 * Deliberately does not import the Stellar SDK or the app config: it only
 * scans text files with `node:fs`, so it stays fast.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SRC_DIR = join(ROOT, "src");
const EXTRA_SOURCES = [join(ROOT, "vite.config.ts")];
const ENV_EXAMPLE_PATH = join(ROOT, ".env.example");
const CONFIG_DOC_PATH = join(ROOT, "docs", "Configuration.md");

const VITE_VAR_PATTERN = /VITE_[A-Z0-9_]+/g;

function isSourceFile(path: string): boolean {
  if (!/\.(ts|tsx)$/.test(path)) return false;
  if (/\.test\.(ts|tsx)$/.test(path)) return false;
  return !path.split(sep).includes("__tests__");
}

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "node_modules") continue;
      files.push(...collectSourceFiles(path));
    } else if (isSourceFile(path)) {
      files.push(path);
    }
  }
  return files;
}

/** Sorted list of every `VITE_*` name referenced by app code. */
function collectViteVariables(): string[] {
  const names = new Set<string>();
  for (const file of [...collectSourceFiles(SRC_DIR), ...EXTRA_SOURCES]) {
    const contents = readFileSync(file, "utf8");
    for (const match of contents.matchAll(VITE_VAR_PATTERN)) {
      names.add(match[0]);
    }
  }
  return Array.from(names).sort();
}

function hasEnvAssignment(contents: string, name: string): boolean {
  return new RegExp(`^\\s*#?\\s*${name}\\s*=`, "m").test(contents);
}

function hasDocHeading(contents: string, name: string): boolean {
  return new RegExp(`^###\\s+\`${name}\``, "m").test(contents);
}

describe("VITE_* documentation", () => {
  const variables = collectViteVariables();
  const envExample = readFileSync(ENV_EXAMPLE_PATH, "utf8");
  const configDoc = readFileSync(CONFIG_DOC_PATH, "utf8");

  it("finds the variables the app actually reads", () => {
    expect(variables.length).toBeGreaterThan(0);
    expect(variables).toEqual(expect.arrayContaining(["VITE_API_BASE_URL"]));
  });

  it("lists every variable in .env.example as an assignment or commented example", () => {
    const missing = variables.filter(
      (name) => !hasEnvAssignment(envExample, name),
    );
    expect(missing, `.env.example is missing: ${missing.join(", ")}`).toEqual([]);
  });

  it("gives every variable its own ### section in docs/Configuration.md", () => {
    const missing = variables.filter((name) => !hasDocHeading(configDoc, name));
    expect(
      missing,
      `docs/Configuration.md is missing sections for: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("scans src outside test files only", () => {
    const scanned = collectSourceFiles(SRC_DIR).map((file) =>
      relative(ROOT, file).split(sep).join("/"),
    );
    expect(scanned).toContain("src/config/constants.ts");
    expect(scanned.some((file) => file.includes(".test."))).toBe(false);
  });
});
