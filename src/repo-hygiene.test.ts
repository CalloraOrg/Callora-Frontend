// @vitest-environment node
//
// Repository-hygiene guard for issue #1147. It runs in the node environment
// because it inspects the filesystem at the project root rather than any UI.
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const atRoot = (...segments: string[]) => path.join(projectRoot, ...segments);
const exists = (...segments: string[]) => existsSync(atRoot(...segments));

/**
 * Files that used to clutter the repository root. Change notes belong under
 * `docs/`; generated logs and commit drafts do not belong in version control.
 */
const STRAY_ROOT_FILES = [
  "COMMIT_MESSAGE.txt",
  "ENDPOINT_GROUP_HOVER_CHANGES.md",
  "SORT_MENU_PRINT_CHANGES.md",
  "TODO.md",
  "test-output.txt",
];

describe("repository root hygiene (#1147)", () => {
  it("keeps stray notes and generated artifacts out of the repository root", () => {
    for (const stray of STRAY_ROOT_FILES) {
      expect(exists(stray), `${stray} should not live at the repository root`).toBe(
        false,
      );
    }
  });

  it("keeps relocated change notes under docs/", () => {
    expect(exists("docs", "EndpointGroupHover.md")).toBe(true);
    expect(exists("docs", "SortMenu-print.md")).toBe(true);
    expect(exists("docs", "NotificationCenter-responsive-srcset.md")).toBe(true);
  });

  it("ignores test output and build-info artifacts", () => {
    const gitignore = readFileSync(atRoot(".gitignore"), "utf8");
    expect(gitignore).toMatch(/^test-output\*\.txt$/m);
    expect(gitignore).toMatch(/^\*\.tsbuildinfo$/m);
  });
});
