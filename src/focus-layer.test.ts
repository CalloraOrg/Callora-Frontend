import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("@layer focus contract", () => {
  const css = read("src/index.css");

  it("defines a single `focus` cascade layer", () => {
    expect(css).toMatch(/@layer\s+focus\s*\{/);
  });

  it("restores the ring on :focus-visible using the accent token", () => {
    expect(css).toMatch(/\*:focus-visible[\s\S]*?outline:\s*2px solid var\(--accent\)/);
  });

  it("uses a 3px ring offset", () => {
    expect(css).toMatch(/outline-offset:\s*3px/);
  });

  it("MethodChip uses :focus-visible, not bare :focus", () => {
    const chip = read("src/components/MethodChip.css");
    expect(chip).toMatch(/\.method-chip:focus-visible/);
    expect(chip).not.toMatch(/\.method-chip:focus\s*\{/);
  });

  it("SearchBar carries no inline outline override", () => {
    expect(read("src/components/SearchBar.tsx")).not.toMatch(/outline:\s*["'][^"']*none/i);
  });
});