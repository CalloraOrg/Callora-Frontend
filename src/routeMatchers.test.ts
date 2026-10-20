import { describe, expect, it } from "vitest";
import { isMarketplaceSubpage } from "./routeMatchers";

describe("isMarketplaceSubpage", () => {
  it.each([
    ["/marketplace", false],
    ["/marketplace?x", false],
    ["/marketplace/a/sla", true],
    ["/marketplace/a/rate-limits", true],
    ["/marketplace/a/rate-limits/", true],
    ["/marketplace/a/other", false],
    ["/marketplace/a/rate-limits/config", false],
  ])("%s -> %s", (path, expected) => {
    expect(isMarketplaceSubpage(path)).toBe(expected);
  });
});
