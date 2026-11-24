// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, "..");

const contrastCss = readFileSync(resolve(__dirname, "./contrast.css"), "utf-8");
const focusCss = readFileSync(resolve(__dirname, "./focus.css"), "utf-8");

function extractForcedColorsBlock(css: string): string {
  const marker = "@media (forced-colors: active)";
  const start = css.indexOf(marker);
  if (start === -1) return "";
  const openBrace = css.indexOf("{", start);
  if (openBrace === -1) return "";

  let depth = 0;
  for (let i = openBrace; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) {
        return css.slice(openBrace + 1, i);
      }
    }
  }
  return "";
}

describe("forced-colors CSS rules", () => {
  describe("src/styles/contrast.css", () => {
    const block = extractForcedColorsBlock(contrastCss);

    it("declares a @media (forced-colors: active) block", () => {
      expect(contrastCss).toContain("@media (forced-colors: active)");
      expect(block.length).toBeGreaterThan(0);
    });

    it("styles StatusBadge (.sb-pattern-*) with system border and colours", () => {
      expect(block).toContain('sb-pattern-');
      expect(block).toContain("CanvasText");
      expect(block).toContain("ButtonText");
      expect(block).toContain("Canvas");
    });

    it("styles .method-chip with a visible CanvasText border", () => {
      expect(block).toContain(".method-chip");
    });

    it("styles .tag-chip and .tag-chip--active with system colours", () => {
      expect(block).toContain(".tag-chip");
      expect(block).toContain(".tag-chip--active");
      expect(block).toContain("Highlight");
      expect(block).toContain("HighlightText");
    });

    it("styles .tabs-indicator and active [role=\"tab\"]", () => {
      expect(block).toContain(".tabs-indicator");
      expect(block).toContain("forced-color-adjust: none");
      expect(block).toContain('[role="tab"][aria-selected="true"]');
    });
  });

  describe("src/styles/focus.css", () => {
    const block = extractForcedColorsBlock(focusCss);

    it("declares a @media (forced-colors: active) block", () => {
      expect(focusCss).toContain("@media (forced-colors: active)");
      expect(block.length).toBeGreaterThan(0);
    });

    it("ensures :focus-visible uses a system-colour outline with offset", () => {
      expect(block).toContain(":focus-visible");
      expect(block).toMatch(/outline:\s*2px\s+solid\s+(Highlight|CanvasText)/);
      expect(block).toContain("outline-offset:");
    });

    it("covers controls that rely on box-shadow or border-color", () => {
      expect(block).toContain(".filter-checkbox:focus-visible");
      expect(block).toContain(".filter-input:focus-visible");
      expect(block).toContain(".pill-bar__item:focus-visible");
      expect(block).toContain(".pagination-button:focus-visible");
    });
  });
});
