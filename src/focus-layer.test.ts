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

  it("focus.css defines a `focus` cascade layer for FiltersSidebar", () => {
    const focusCss = read("src/styles/focus.css");
    expect(focusCss).toMatch(/@layer\s+focus\s*\{/);
  });

  it("focus.css uses the accent token for focus rings", () => {
    const focusCss = read("src/styles/focus.css");
    expect(focusCss).toMatch(/outline:\s*2px solid var\(--accent\)/);
  });

  it("focus.css uses a 3px ring offset", () => {
    const focusCss = read("src/styles/focus.css");
    expect(focusCss).toMatch(/outline-offset:\s*3px/);
  });

  it("focus.css defines focus-visible rules for FiltersSidebar interactive elements", () => {
    const focusCss = read("src/styles/focus.css");
    expect(focusCss).toMatch(/\.filters-sidebar[\s\S]*?focus-visible/);
    expect(focusCss).toMatch(/\.filter-group__header:focus-visible/);
    expect(focusCss).toMatch(/\.filter-checkbox:focus-visible/);
    expect(focusCss).toMatch(/\.filter-input:focus-visible/);
  });

  it("Dropdown trigger no longer overrides :focus-visible with inline outline:none", () => {
    const dropdown = read("src/components/Dropdown.tsx");
    expect(dropdown).not.toMatch(/outline:\s*open\s*\?[^:]*:\s*["']none["']/);
  });

  it("focus.css defines focus-visible rules for MarketplacePage interactive elements", () => {
    const focusCss = read("src/styles/focus.css");
    expect(focusCss).toMatch(/\.pill-bar__item:focus-visible/);
    expect(focusCss).toMatch(/\.api-tag-filter__pill:focus-visible/);
    expect(focusCss).toMatch(/\.density-toggle-button:focus-visible/);
    expect(focusCss).toMatch(/\.marketplace-filter-button:focus-visible/);
    expect(focusCss).toMatch(/\.pagination-button:focus-visible/);
    expect(focusCss).toMatch(/\.page-size-select:focus-visible/);
    expect(focusCss).toMatch(/\.recently-active-rail button:focus-visible/);
    expect(focusCss).toMatch(/\.empty-state button:focus-visible/);
    expect(focusCss).toMatch(/\.bottom-sheet__close:focus-visible/);
    expect(focusCss).toMatch(/\.bottom-sheet__show-btn:focus-visible/);
  });

  it("focus.css uses accent token and 3px offset for MarketplacePage rules", () => {
    const focusCss = read("src/styles/focus.css");
    expect(focusCss).toMatch(/\.pill-bar__item:focus-visible[\s\S]*?outline:\s*2px solid var\(--accent\)/);
    expect(focusCss).toMatch(/\.pill-bar__item:focus-visible[\s\S]*?outline-offset:\s*3px/);
    expect(focusCss).toMatch(/\.api-tag-filter__pill:focus-visible[\s\S]*?outline:\s*2px solid var\(--accent\)/);
    expect(focusCss).toMatch(/\.api-tag-filter__pill:focus-visible[\s\S]*?outline-offset:\s*3px/);
    expect(focusCss).toMatch(/\.density-toggle-button:focus-visible[\s\S]*?outline:\s*2px solid var\(--accent\)/);
    expect(focusCss).toMatch(/\.density-toggle-button:focus-visible[\s\S]*?outline-offset:\s*3px/);
  });

  it("MarketplacePage components use :focus-visible, not bare :focus", () => {
    const categoryPills = read("src/components/CategoryPills.tsx");
    const apiTagFilter = read("src/pages/ApiTagFilter.tsx");
    const marketplacePage = read("src/pages/MarketplacePage.tsx");
    const recentlyActiveRail = read("src/components/RecentlyActiveRail.tsx");

    expect(categoryPills).not.toMatch(/\.pill-bar__item:focus\s*\{/);
    expect(apiTagFilter).not.toMatch(/\.api-tag-filter__pill:focus\s*\{/);
    expect(marketplacePage).not.toMatch(/\.density-toggle-button:focus\s*\{/);
    expect(marketplacePage).not.toMatch(/\.marketplace-filter-button:focus\s*\{/);
    expect(recentlyActiveRail).not.toMatch(/button:focus\s*\{/);
  });
});