/**
 * ReviewsTab.print.test.ts
 *
 * Contract tests for FWC26: "Hide chrome + expand collapsibles when printing
 * ReviewsTab".  These are intentionally file-level (no jsdom) because they
 * verify CSS and markup contracts that a browser @media print rule enforces at
 * render time — not runtime React state.
 *
 * What we test:
 *  1. The sort controls wrapper carries the `reviews-sort-controls` and
 *     `no-print` class names so the @media print rule hides it.
 *  2. The "Write a Review" button carries `no-print` so it is hidden on print.
 *  3. The reviews <section> carries `data-reviews-section` so the
 *     CSS selector `[data-reviews-section] .preview-card` can target review
 *     cards for expand rules.
 *  4. The review cards grid carries the `reviews-list` class for single-column
 *     print layout.
 *  5. The @media print block in index.css contains the ReviewsTab-specific
 *     expansion rules.
 *  6. No separate print.css import exists in main.tsx (preserved from prior
 *     contract in src/print.test.ts).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

// ─── Markup contracts (ApiDetailPage.tsx) ────────────────────────────────────

describe("ReviewsTab markup: no-print chrome", () => {
  const page = read("src/pages/ApiDetailPage.tsx");

  it("sort controls wrapper has reviews-sort-controls and no-print classes", () => {
    // The sort-by row must include both class names so @media print can hide it.
    expect(page).toMatch(
      /className="reviews-sort-controls no-print"/,
    );
  });

  it("Write a Review button carries no-print", () => {
    // Interactive buttons are meaningless on paper.
    expect(page).toMatch(/className="secondary-button no-print"/);
  });

  it("reviews <section> has data-reviews-section attribute", () => {
    // CSS selector [data-reviews-section] targets print expansion rules.
    expect(page).toMatch(/data-reviews-section/);
  });

  it("review list grid carries reviews-list class", () => {
    // .reviews-list is used by the print block to enforce single-column layout.
    expect(page).toMatch(/className="reviews-list"/);
  });
});

// ─── CSS contracts (index.css @media print) ──────────────────────────────────

describe("ReviewsTab print CSS: expansion rules in index.css", () => {
  const css = read("src/index.css");

  it("expands review cards inside data-reviews-section", () => {
    expect(css).toMatch(
      /\[data-reviews-section\]\s+\.preview-card[\s\S]*?display:\s*block\s*!important/,
    );
  });

  it("removes max-height clipping from review cards", () => {
    expect(css).toMatch(
      /\[data-reviews-section\]\s+\.preview-card[\s\S]*?max-height:\s*none\s*!important/,
    );
  });

  it("expands aria-hidden collapsible regions inside reviews panel", () => {
    expect(css).toMatch(
      /\[data-reviews-section\]\s+\[aria-hidden="true"\][\s\S]*?display:\s*block\s*!important/,
    );
  });

  it("expands <details> elements inside the reviews panel", () => {
    expect(css).toMatch(
      /\[data-reviews-section\]\s+details\s*\{[\s\S]*?display:\s*block\s*!important/,
    );
  });

  it("expands [hidden] elements inside the reviews panel", () => {
    expect(css).toMatch(
      /\[data-reviews-section\]\s+\[hidden\][\s\S]*?display:\s*block\s*!important/,
    );
  });

  it("forces single-column layout for the reviews list on print", () => {
    expect(css).toMatch(
      /\[data-reviews-section\]\s+\.reviews-list[\s\S]*?grid-template-columns:\s*1fr\s*!important/,
    );
  });

  it("avoids breaking review cards across page boundaries", () => {
    expect(css).toMatch(
      /\[data-reviews-section\]\s+\.preview-card[\s\S]*?break-inside:\s*avoid\s*!important/,
    );
  });

  it("ReviewsTab print rules are located inside the @media print block", () => {
    // Find the last @media print block and verify data-reviews-section appears after it.
    const printStart = css.lastIndexOf("@media print");
    expect(printStart).toBeGreaterThan(-1);
    const afterPrint = css.slice(printStart);
    expect(afterPrint).toMatch(/\[data-reviews-section\]/);
  });
});

// ─── No separate print.css file ──────────────────────────────────────────────

describe("no-print import guard (preserved from src/print.test.ts)", () => {
  it("main.tsx does not import a print.css file", () => {
    const main = read("src/main.tsx");
    expect(main).not.toMatch(/print\.css/);
  });
});
