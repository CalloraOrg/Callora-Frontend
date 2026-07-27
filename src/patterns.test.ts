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
