// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { APIItem } from "../data/mockApis";
import { computeFacetCounts, matchesFilters } from "./facetCounts";

function api(overrides: Partial<APIItem> & { id: string }): APIItem {
  return {
    name: overrides.id,
    description: "",
    provider: { name: "Provider" },
    pricePerRequest: 1,
    ...overrides,
  };
}

const catalog: APIItem[] = [
  api({
    id: "weather-1",
    name: "Weather Pro",
    category: "Data & Analytics",
    tags: ["Weather", "Geo"],
    pricePerRequest: 2,
    status: "operational",
  }),
  api({
    id: "weather-2",
    name: "Forecast",
    category: "Data & Analytics",
    tags: ["weather"],
    pricePerRequest: 8,
    status: "degraded",
  }),
  api({
    id: "pay-1",
    name: "Payments",
    category: "Payment Processing",
    tags: ["Payments", "Cards"],
    pricePerRequest: 5,
    status: "operational",
  }),
  api({ id: "untagged", name: "Untagged", category: "Utilities" }),
];

describe("computeFacetCounts", () => {
  it("counts every category and lower-cased tag in the catalogue", () => {
    const counts = computeFacetCounts(catalog, {});

    expect(counts.categories).toEqual({
      "Data & Analytics": 2,
      "Payment Processing": 1,
      Utilities: 1,
    });
    expect(counts.tags).toEqual({
      weather: 2,
      geo: 1,
      payments: 1,
      cards: 1,
    });
  });

  it("ignores a facet's own selection so siblings keep their counts", () => {
    const counts = computeFacetCounts(catalog, {
      categories: new Set(["Payment Processing"]),
    });

    expect(counts.categories).toEqual({
      "Data & Analytics": 2,
      "Payment Processing": 1,
      Utilities: 1,
    });
    // Tag counts do respect the category selection.
    expect(counts.tags).toEqual({ payments: 1, cards: 1 });
  });

  it("matches tags case-insensitively and still counts other tags", () => {
    const counts = computeFacetCounts(catalog, { tag: "WEATHER" });

    expect(counts.categories).toEqual({ "Data & Analytics": 2 });
    // The tag facet ignores its own selection, so every tag is still counted.
    expect(counts.tags).toEqual({
      weather: 2,
      geo: 1,
      payments: 1,
      cards: 1,
    });
  });

  it("reacts to search text, status, price and favourites", () => {
    expect(computeFacetCounts(catalog, { query: "forecast" }).categories).toEqual({
      "Data & Analytics": 1,
    });

    expect(
      computeFacetCounts(catalog, { statuses: new Set(["degraded"]) }).categories,
    ).toEqual({ "Data & Analytics": 1 });

    expect(computeFacetCounts(catalog, { maxPrice: 2 }).categories).toEqual({
      "Data & Analytics": 1,
      Utilities: 1,
    });

    expect(
      computeFacetCounts(catalog, {
        favoritesOnly: true,
        favorites: ["pay-1"],
      }).categories,
    ).toEqual({ "Payment Processing": 1 });
  });

  it("counts a tag only once per API", () => {
    const counts = computeFacetCounts(
      [api({ id: "dup", tags: ["Weather", "weather", "GEO"] })],
      {},
    );

    expect(counts.tags).toEqual({ weather: 1, geo: 1 });
  });

  it("skips entries with no category or tags", () => {
    const counts = computeFacetCounts([api({ id: "bare" })], {});

    expect(counts).toEqual({ categories: {}, tags: {} });
  });

  it("returns empty counts for an empty catalogue", () => {
    expect(computeFacetCounts([], {})).toEqual({ categories: {}, tags: {} });
  });

  it("skips price filtering while the range is inverted", () => {
    const counts = computeFacetCounts(catalog, { minPrice: 10, maxPrice: 1 });

    expect(counts.categories["Data & Analytics"]).toBe(2);
  });
});

describe("matchesFilters", () => {
  it("matches provider name and tags in the search query", () => {
    const pay = catalog[2]!;

    expect(matchesFilters(pay, { query: "provider" })).toBe(true);
    expect(matchesFilters(pay, { query: "cards" })).toBe(true);
    expect(matchesFilters(pay, { query: "nothing" })).toBe(false);
  });

  it("treats a missing category as unmatched when categories are active", () => {
    const bare = api({ id: "bare" });

    expect(matchesFilters(bare, { categories: new Set(["Utilities"]) })).toBe(false);
  });
});
