import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("print stylesheet contract", () => {
  const css = read("src/index.css");

  it("defines @media print near the end of index.css", () => {
    const printIndex = css.lastIndexOf("@media print");
    const fileLength = css.length;
    expect(printIndex).toBeGreaterThan(-1);
    expect(printIndex).toBeGreaterThan(fileLength * 0.85);
  });

  it("hides .no-print elements", () => {
    expect(css).toMatch(
      /@media print[\s\S]*\.no-print\s*\{[\s\S]*?display:\s*none\s*!important/,
    );
  });

  it("forces light theme tokens for print", () => {
    expect(css).toMatch(/--page-bg:\s*#f5f7fa\s*!important/);
    expect(css).toMatch(/--text:\s*#1a2332\s*!important/);
  });

  it("appends href after inline links", () => {
    expect(css).toMatch(/a\[href\][\s\S]*?:after/);
    expect(css).toMatch(/content:\s*"\s*\("\s*attr\(href\)\s*"\)"\s*;/);
  });

  it("excludes javascript: hrefs from printed URLs", () => {
    expect(css).toMatch(/:not\(\[href\^="javascript:"\]\)/);
  });

  it("wraps code samples without clipping", () => {
    expect(css).toMatch(/pre[\s\S]*?white-space:\s*pre-wrap\s*!important/);
    expect(css).toMatch(/pre[\s\S]*?overflow:\s*visible\s*!important/);
  });

  it("forces EndpointSummary collapsibles to expand on print", () => {
    expect(css).toMatch(/\.endpoint-summary-content--collapsed\s*\{[\s\S]*?display:\s*block\s*!important/);
    expect(css).toMatch(/\.endpoint-summary-trigger\s+\.chevron-icon\s*\{[\s\S]*?display:\s*none\s*!important/);
  });
});

describe("no-print markup", () => {
  it("marks App shell chrome as no-print", () => {
    const app = read("src/App.tsx");
    expect(app).toMatch(/className="topbar no-print"/);
    expect(app).toMatch(/className="surface app-footer no-print"/);
    expect(app).toMatch(/className="primary-button no-print" onClick=\{openDeposit\}/);
  });

  it("marks ApiDetailPage chrome as no-print", () => {
    const page = read("src/pages/ApiDetailPage.tsx");
    expect(page).toMatch(/className="api-detail-tabs no-print"/);
    expect(page).toMatch(/className="api-detail-sidebar no-print"/);
    // CTA row uses api-hero__cta--detail modifier; all three classes must be present
    expect(page).toMatch(/className="api-hero__cta api-hero__cta--detail no-print"/);
  });

  it("marks CodeExample header controls as no-print", () => {
    const codeExample = read("src/components/CodeExample.tsx");
    expect(codeExample).toMatch(/className="no-print/);
  });

  it("does not import the removed print.css file", () => {
    const main = read("src/main.tsx");
    expect(main).not.toMatch(/print\.css/);
  });
});

// ── ReviewsTab print contract (issue #580) ────────────────────────────────────

describe("ReviewsTab print markup contract", () => {
  const source = read("src/pages/ReviewsTab.tsx");

  it("wraps the panel in a section with class 'reviews-tab'", () => {
    // The .reviews-tab class is required by the @media print block in index.css
    // to inject the section heading and scope all ReviewsTab-specific rules.
    expect(source).toMatch(/className="reviews-tab"/);
  });

  it("marks the sort-row with both reviews-tab__sort-row and no-print", () => {
    // The sort <select> must be hidden in print media.
    expect(source).toMatch(/reviews-tab__sort-row no-print/);
  });

  it("marks the interactive header with no-print", () => {
    // The 'Write a Review' CTA and heading row must be hidden when printing.
    expect(source).toMatch(/api-detail-reviews-header no-print/);
  });

  it("marks each review card with reviews-tab__card", () => {
    // Required so the @media print rule can apply break-inside: avoid.
    expect(source).toMatch(/reviews-tab__card/);
  });

  it("marks the review list with reviews-tab__list", () => {
    // Required so the @media print rule can collapse the grid gap.
    expect(source).toMatch(/reviews-tab__list/);
  });

  it("wraps star ratings in a span with role=img and aria-label", () => {
    // WCAG 2.1 AA: non-text content must have a text alternative.
    expect(source).toMatch(/role="img"/);
    expect(source).toMatch(/aria-label=\{`\$\{rating\} out of 5 stars`\}/);
  });

  it("uses aria-hidden on decorative SVGs", () => {
    expect(source).toMatch(/aria-hidden="true"/);
  });
});

describe("ReviewsTab @media print CSS rules", () => {
  const css = read("src/index.css");

  it("hides .reviews-tab__sort-row in print", () => {
    expect(css).toMatch(
      /@media print[\s\S]*\.reviews-tab__sort-row[\s\S]*?display:\s*none\s*!important/,
    );
  });

  it("hides .reviews-tab .api-detail-reviews-header in print", () => {
    expect(css).toMatch(
      /@media print[\s\S]*\.reviews-tab\s+\.api-detail-reviews-header[\s\S]*?display:\s*none\s*!important/,
    );
  });

  it("injects a ::before heading on .reviews-tab", () => {
    expect(css).toMatch(
      /@media print[\s\S]*\.reviews-tab::before[\s\S]*?content:\s*"Developer Reviews"/,
    );
  });

  it("applies break-inside: avoid to .reviews-tab__card", () => {
    expect(css).toMatch(
      /@media print[\s\S]*\.reviews-tab__card[\s\S]*?break-inside:\s*avoid\s*!important/,
    );
  });

  it("collapses the grid gap on .reviews-tab__list in print", () => {
    expect(css).toMatch(
      /@media print[\s\S]*\.reviews-tab__list[\s\S]*?display:\s*block\s*!important/,
    );
  });

  it("sets max-height: none on .reviews-tab to expand collapsibles", () => {
    expect(css).toMatch(
      /@media print[\s\S]*\.reviews-tab[\s\S]*?max-height:\s*none\s*!important/,
    );
  });

  it("mirrors the ReviewsTab rules in src/styles/print.css as documentation", () => {
    // The print.css file is the human-readable source of truth; it must define
    // the same key selectors (even though it is not imported by main.tsx).
    const printCss = read("src/styles/print.css");
    expect(printCss).toMatch(/\.reviews-tab__sort-row/);
    expect(printCss).toMatch(/\.reviews-tab::before/);
    expect(printCss).toMatch(/\.reviews-tab__card/);
  });
});
