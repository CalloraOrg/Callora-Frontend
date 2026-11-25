import type { APIItem } from "../data/mockApis";

/**
 * Filter values shared by the marketplace result list and the facet counts.
 * Mirrors the state `MarketplacePage` derives from the URL.
 */
export type FacetFilters = {
  query?: string;
  categories?: ReadonlySet<string>;
  statuses?: ReadonlySet<string>;
  favoritesOnly?: boolean;
  favorites?: readonly string[];
  tag?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
};

export type FacetCounts = {
  categories: Record<string, number>;
  tags: Record<string, number>;
};

/**
 * The facet whose own selection is ignored. Standard disjunctive faceting:
 * a category count must not collapse to zero just because that category is
 * selected, otherwise selecting one category hides how many APIs its siblings
 * would return.
 */
type IgnoredFacet = "categories" | "tags";

function matchesQuery(api: APIItem, query: string): boolean {
  if (!query) return true;
  const haystack = [
    api.name,
    api.description,
    api.provider?.name,
    ...(api.tags ?? []),
  ];
  return haystack.some((value) => value?.toLowerCase().includes(query));
}

/**
 * True when `api` passes every active filter except `omit`.
 *
 * Shared by the result list and {@link computeFacetCounts} so the counts can
 * never drift from what clicking a facet actually shows.
 */
export function matchesFilters(
  api: APIItem,
  filters: FacetFilters,
  omit?: IgnoredFacet,
): boolean {
  if (!matchesQuery(api, filters.query?.trim().toLowerCase() ?? "")) {
    return false;
  }

  const categories = filters.categories;
  if (omit !== "categories" && categories && categories.size > 0) {
    if (!categories.has(api.category ?? "")) return false;
  }

  const statuses = filters.statuses;
  if (statuses && statuses.size > 0) {
    if (!api.status || !statuses.has(api.status)) return false;
  }

  if (filters.favoritesOnly && !(filters.favorites ?? []).includes(api.id)) {
    return false;
  }

  const tag = filters.tag?.toLowerCase();
  if (omit !== "tags" && tag) {
    if (!(api.tags ?? []).some((value) => value.toLowerCase() === tag)) {
      return false;
    }
  }

  // An inverted range is skipped here too, matching the result list: the
  // sidebar shows an inline error instead of silently matching nothing.
  const { minPrice = null, maxPrice = null } = filters;
  const hasInvertedPrice =
    minPrice !== null && maxPrice !== null && minPrice > maxPrice;
  if (!hasInvertedPrice) {
    if (minPrice !== null && api.pricePerRequest < minPrice) return false;
    if (maxPrice !== null && api.pricePerRequest > maxPrice) return false;
  }

  return true;
}

/**
 * Count how many catalogue entries each category and tag would return, with
 * each facet ignoring its own selection.
 */
export function computeFacetCounts(
  catalog: readonly APIItem[],
  filters: FacetFilters,
): FacetCounts {
  const categories: Record<string, number> = {};
  const tags: Record<string, number> = {};

  for (const api of catalog) {
    if (api.category && matchesFilters(api, filters, "categories")) {
      categories[api.category] = (categories[api.category] ?? 0) + 1;
    }

    if (api.tags && matchesFilters(api, filters, "tags")) {
      const uniqueTags = new Set(api.tags.map((tag) => tag.toLowerCase()));
      for (const tag of uniqueTags) {
        tags[tag] = (tags[tag] ?? 0) + 1;
      }
    }
  }

  return { categories, tags };
}
