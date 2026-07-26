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
    expect(codeExample).toMatch(/className="no-print"/);
  });

  it("does not import the removed print.css file", () => {
    const main = read("src/main.tsx");
    expect(main).not.toMatch(/print\.css/);
  });
});
