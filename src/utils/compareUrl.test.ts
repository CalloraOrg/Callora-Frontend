import { describe, it, expect } from "vitest";
import {
  parseCompareIds,
  buildCompareShareUrl,
  MAX_COMPARE_ID_LENGTH,
} from "./compareUrl";

describe("parseCompareIds", () => {
  it("returns empty array for empty or missing ids param", () => {
    expect(parseCompareIds("")).toEqual([]);
    expect(parseCompareIds("?q=weather")).toEqual([]);
    expect(parseCompareIds("?ids=")).toEqual([]);
    expect(parseCompareIds("?ids=,,,")).toEqual([]);
  });

  it("parses comma-separated ids and trims whitespace", () => {
    expect(parseCompareIds("?ids=api-1, api-2 ,api-3")).toEqual([
      "api-1",
      "api-2",
      "api-3",
    ]);
  });

  it("deduplicates ids while preserving order", () => {
    expect(parseCompareIds("?ids=api-2,api-1,api-2,api-3,api-1")).toEqual([
      "api-2",
      "api-1",
      "api-3",
    ]);
  });

  it("caps at 3 ids", () => {
    expect(parseCompareIds("?ids=a,b,c,d,e")).toEqual(["a", "b", "c"]);
  });

  it("drops empty and oversized ids", () => {
    const oversized = "x".repeat(MAX_COMPARE_ID_LENGTH + 1);
    const maxAllowed = "y".repeat(MAX_COMPARE_ID_LENGTH);
    expect(
      parseCompareIds(`?ids=, ,${oversized},valid-1,${maxAllowed}`),
    ).toEqual(["valid-1", maxAllowed]);
  });

  it("decodes URL-encoded ids", () => {
    expect(parseCompareIds("?ids=org%2Fapi-1,api%20two")).toEqual([
      "org/api-1",
      "api two",
    ]);
  });
});

describe("buildCompareShareUrl", () => {
  it("builds a marketplace URL with comma-separated ids", () => {
    expect(buildCompareShareUrl(["api-1", "api-2"], "https://callora.app")).toBe(
      "https://callora.app/marketplace?ids=api-1,api-2",
    );
  });

  it("strips trailing slash from origin", () => {
    expect(buildCompareShareUrl(["api-1"], "https://callora.app/")).toBe(
      "https://callora.app/marketplace?ids=api-1",
    );
  });

  it("returns bare marketplace URL when no valid ids remain", () => {
    expect(buildCompareShareUrl(["", "   "], "https://callora.app")).toBe(
      "https://callora.app/marketplace",
    );
  });

  it("deduplicates, caps at 3, and drops oversized ids", () => {
    const oversized = "z".repeat(MAX_COMPARE_ID_LENGTH + 5);
    expect(
      buildCompareShareUrl(
        ["a", oversized, "b", "a", "c", "d"],
        "https://callora.app",
      ),
    ).toBe("https://callora.app/marketplace?ids=a,b,c");
  });

  it("round-trips through parseCompareIds including special characters", () => {
    const ids = ["org/weather-api", "pay api", "geo_v2"];
    const url = buildCompareShareUrl(ids, "https://callora.app");
    const parsed = parseCompareIds(new URL(url).search);
    expect(parsed).toEqual(ids);
  });
});
