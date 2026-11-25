import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("public/robots.txt", () => {
  const robotsTxt = readFileSync(resolve(process.cwd(), "public/robots.txt"), "utf-8");
  const lines = robotsTxt
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  it("sets User-agent: * and Allow: /", () => {
    expect(lines).toContain("User-agent: *");
    expect(lines).toContain("Allow: /");
  });

  it("disallows gated and error routes", () => {
    expect(lines).toContain("Disallow: /billing");
    expect(lines).toContain("Disallow: /apis/my-apis");
    expect(lines).toContain("Disallow: /webhooks");
    expect(lines).toContain("Disallow: /500");
  });
});
