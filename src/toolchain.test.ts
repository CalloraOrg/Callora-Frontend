// @vitest-environment node
//
// Toolchain guard for issue #1421: `.nvmrc`, `package.json` "engines" and the
// CI workflow must all agree on the Node major the project is built with.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const read = (...segments: string[]) =>
  readFileSync(path.join(projectRoot, ...segments), "utf8");

function majorOf(version: string): number {
  const match = version.trim().replace(/^v/, "").match(/^(\d+)/);
  if (!match) throw new Error(`Unparseable Node version: ${version}`);
  return Number(match[1]);
}

/** Lowest major accepted by an `engines.node` range such as ">=20". */
function lowestAcceptedMajor(range: string): number {
  const match = range.match(/(\d+)/);
  if (!match) throw new Error(`Unparseable engines.node range: ${range}`);
  return Number(match[1]);
}

describe("toolchain pinning (#1421)", () => {
  const nvmrc = read(".nvmrc").trim();
  const pkg = JSON.parse(read("package.json")) as {
    engines?: { node?: string; npm?: string };
  };

  it("pins a major-only Node version in .nvmrc", () => {
    expect(nvmrc).toMatch(/^\d+$/);
  });

  it("declares engines.node and engines.npm", () => {
    expect(pkg.engines?.node).toBeTruthy();
    expect(pkg.engines?.npm).toBeTruthy();
  });

  it("engines.node accepts the .nvmrc major", () => {
    const range = pkg.engines?.node ?? "";
    expect(lowestAcceptedMajor(range)).toBeLessThanOrEqual(majorOf(nvmrc));
  });

  it("CI runs the same Node major as .nvmrc", () => {
    const ci = read(".github", "workflows", "ci.yml");
    const match = ci.match(/node-version:\s*['"]?(\d+)/);
    expect(match?.[1]).toBe(nvmrc);
  });
});
