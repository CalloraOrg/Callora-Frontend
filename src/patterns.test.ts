import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("status-chip color-blind-safe patterns", () => {
  const patterns = read("src/styles/patterns.css");

  const variants = [
    { cls: ".status-chip.input", pattern: "dots", baseline: false },
    { cls: ".status-chip.approving", pattern: "cross-hatch", baseline: false },
    { cls: ".status-chip.pending", pattern: "stripes", baseline: false },
    { cls: ".status-chip.confirmed", pattern: "none", baseline: true },
    { cls: ".status-chip.failed", pattern: "stripes", baseline: false },
  ];

  it("defines a pattern rule for every .status-chip variant", () => {
    for (const v of variants) {
      expect(patterns).toMatch(new RegExp(`${v.cls.replace(".", "\\.")}\\s*\\{`));
    }
  });

  it("uses background-image:none for the confirmed baseline", () => {
    expect(patterns).toMatch(/\.status-chip\.confirmed\s*\{[^}]*background-image:\s*none/s);
  });

  it("uses inline SVG data URIs for all patterned variants", () => {
    for (const v of variants) {
      if (v.baseline) continue;
      expect(patterns).toMatch(
        new RegExp(`${v.cls.replace(".", "\\.")}\\s*\\{[^}]*url\\("data:image/svg\\+xml`)
      );
    }
  });

  it("applies currentColor in SVG so patterns adapt to theme tokens", () => {
    expect(patterns).toMatch(/\.status-chip\.input\s*\{[^}]*currentColor/s);
    expect(patterns).toMatch(/\.status-chip\.failed\s*\{[^}]*currentColor/s);
  });

  it("includes a descriptive comment block for the .status-chip section", () => {
    expect(patterns).toMatch(/\.status-chip color-blind-safe patterns/);
    expect(patterns).toMatch(/WCAG 1\.4\.1/);
  });
});

describe("StatusBadge sb-pattern color-blind-safe patterns", () => {
  const patterns = read("src/styles/patterns.css");

  const allVariants = [
    "sb-pattern-success",
    "sb-pattern-operational",
    "sb-pattern-error",
    "sb-pattern-down",
    "sb-pattern-warning",
    "sb-pattern-degraded",
    "sb-pattern-pending",
    "sb-pattern-maintenance",
  ];

  const baselineVariants = ["sb-pattern-success", "sb-pattern-operational"];
  const patternedVariants = [
    "sb-pattern-error",
    "sb-pattern-down",
    "sb-pattern-warning",
    "sb-pattern-degraded",
    "sb-pattern-pending",
    "sb-pattern-maintenance",
  ];

  it("defines a CSS class for every sb-pattern variant", () => {
    for (const v of allVariants) {
      expect(patterns).toContain(`.${v}`);
    }
  });

  it("baseline variants (success, operational) have no background pattern", () => {
    const block = patterns.match(/\.sb-pattern-success\s*,[^}]*background-image:\s*none\s*;/);
    expect(block).toBeTruthy();
  });

  it("uses inline SVG data URIs for all patterned variants", () => {
    for (const v of patternedVariants) {
      const escaped = v.replace(/\./g, "\\.");
      expect(patterns).toMatch(
        new RegExp(`\\.${escaped}[^}]*url\\("data:image/svg\\+xml`)
      );
    }
  });

  it("each pattern group (diagonal, opposite, dots, crosshatch) uses a distinct SVG data URI", () => {
    const patternGroups = ["sb-pattern-error", "sb-pattern-warning", "sb-pattern-pending", "sb-pattern-maintenance"];
    const uris = patternGroups.map((v) => {
      const re = new RegExp(`\\.${v}[^}]*url\\("([^"]+)"\\)`);
      const m = re.exec(patterns);
      return m ? m[1] : "";
    });
    for (let i = 0; i < uris.length; i++) {
      for (let j = i + 1; j < uris.length; j++) {
        expect(uris[i]).not.toBe(uris[j]);
      }
    }
  });

  it("applies currentColor in SVG so patterns adapt to theme tokens", () => {
    for (const v of patternedVariants) {
      expect(patterns).toMatch(
        new RegExp(`\\.${v}[^}]*currentColor`)
      );
    }
  });

  it("pattern style modifiers exist (disabled, dense, high-contrast)", () => {
    expect(patterns).toMatch(/\.sb-pattern--disabled\s*\{/);
    expect(patterns).toMatch(/\.sb-pattern--dense\s*\{/);
    expect(patterns).toMatch(/\.sb-pattern--high-contrast\s*\{/);
  });
});
