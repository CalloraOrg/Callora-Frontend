import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { SortValue } from "../components/SortDropdown";

export const DEFAULT_SORT: SortValue = "popularity";

/** The full, URL-backed marketplace filter state. The URL is the single
 *  source of truth: every value is derived from `searchParams` on render and
 *  every setter only writes to the URL. There is no second, local mirror that
 *  could drift out of sync (the "stale state" defect in #989). */
export interface MarketplaceUrlState {
  query: string;
  queryDraft: string;
  commitQuery: (value: string) => void;
  setQueryDraft: (value: string) => void;
  categories: Set<string>;
  setCategories: (next: Set<string>) => void;
  statuses: Set<string>;
  setStatuses: (next: Set<string>) => void;
  tag: string | null;
  setTag: (tag: string | null) => void;
  minPrice: number | null;
  setMinPrice: (value: number | null) => void;
  maxPrice: number | null;
  setMaxPrice: (value: number | null) => void;
  popularity: string;
  setPopularity: (value: string) => void;
  favoritesOnly: boolean;
  setFavoritesOnly: (value: boolean) => void;
  sort: SortValue;
  setSort: (value: SortValue) => void;
  clearAll: () => void;
}

const LIST_PARAMS = [
  "q",
  "categories",
  "statuses",
  "tag",
  "minPrice",
  "maxPrice",
  "popularity",
  "favorites",
  "sort",
  "cursor",
] as const;

function parseList(value: string | null): Set<string> {
  if (!value) return new Set();
  return new Set(
    value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  );
}

function parseNumber(value: string | null): number | null {
  if (value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function writeList(
  params: URLSearchParams,
  key: string,
  next: Set<string>,
): void {
  if (next.size > 0) params.set(key, [...next].join(","));
  else params.delete(key);
}

/**
 * Hook that makes the URL the authoritative store for marketplace filters.
 *
 * - Reads are pure: derived from the live `searchParams` on every render, so
 *   back/forward navigation, refreshes, and deep links always win.
 * - Writes are pure URL mutations: no local state is cached, so a setter can
 *   never report a mutation as successful while the URL disagrees.
 * - `queryDraft` is the only local value and exists purely so the search input
 *   feels responsive while typing; it is re-synced from the URL whenever the
 *   URL changes, guaranteeing the field can never go stale after navigation.
 */
export function useMarketplaceUrlState(): MarketplaceUrlState {
  const [searchParams, setSearchParams] = useSearchParams();

  // Raw param strings — primitives whose identity is stable across renders
  // while the URL is unchanged. We derive the parsed values from these so the
  // derived objects keep a STABLE identity (see below). This matters because
  // consumers (e.g. the cursor-reset effect in MarketplacePage) depend on the
  // parsed values; a fresh object every render would make those effects fire
  // on every render and clobber newer state (#989 race/stale concerns).
  const query = searchParams.get("q") ?? "";
  const categoriesParam = searchParams.get("categories");
  const statusesParam = searchParams.get("statuses");
  const tag = searchParams.get("tag") ?? null;
  const minPriceParam = searchParams.get("minPrice");
  const maxPriceParam = searchParams.get("maxPrice");
  const popularity = searchParams.get("popularity") ?? "any";
  const favoritesOnly = searchParams.get("favorites") === "1";
  const sort = (searchParams.get("sort") ?? DEFAULT_SORT) as SortValue;

  // Memoized so the returned Set/array identity only changes when the
  // underlying param actually changes — never on an unrelated re-render.
  const categories = useMemo(() => parseList(categoriesParam), [categoriesParam]);
  const statuses = useMemo(() => parseList(statusesParam), [statusesParam]);
  const minPrice = useMemo(() => parseNumber(minPriceParam), [minPriceParam]);
  const maxPrice = useMemo(() => parseNumber(maxPriceParam), [maxPriceParam]);

  const update = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          mutate(next);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setCategories = useCallback(
    (next: Set<string>) =>
      update((p) => writeList(p, "categories", next)),
    [update],
  );

  const setStatuses = useCallback(
    (next: Set<string>) => update((p) => writeList(p, "statuses", next)),
    [update],
  );

  const setTag = useCallback(
    (next: string | null) =>
      update((p) => {
        if (next) p.set("tag", next);
        else p.delete("tag");
      }),
    [update],
  );

  const setMinPrice = useCallback(
    (value: number | null) =>
      update((p) => {
        if (value !== null) p.set("minPrice", String(value));
        else p.delete("minPrice");
      }),
    [update],
  );

  const setMaxPrice = useCallback(
    (value: number | null) =>
      update((p) => {
        if (value !== null) p.set("maxPrice", String(value));
        else p.delete("maxPrice");
      }),
    [update],
  );

  const setPopularity = useCallback(
    (value: string) =>
      update((p) => {
        if (value !== "any") p.set("popularity", value);
        else p.delete("popularity");
      }),
    [update],
  );

  const setFavoritesOnly = useCallback(
    (value: boolean) =>
      update((p) => {
        if (value) p.set("favorites", "1");
        else p.delete("favorites");
      }),
    [update],
  );

  const setSort = useCallback(
    (value: SortValue) =>
      update((p) => {
        if (value !== DEFAULT_SORT) p.set("sort", value);
        else p.delete("sort");
      }),
    [update],
  );

  const setQuery = useCallback(
    (value: string) =>
      update((p) => {
        if (value) p.set("q", value);
        else p.delete("q");
      }),
    [update],
  );

  const clearAll = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        LIST_PARAMS.forEach((key) => next.delete(key));
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  // Local draft for the search box only. Re-synced from the URL on every URL
  // change so navigation (back/forward) cannot leave the field stale.
  const [queryDraft, setQueryDraft] = useState(query);
  useEffect(() => {
    setQueryDraft(query);
  }, [query]);

  const commitQuery = useCallback(
    (value: string) => {
      setQueryDraft(value);
      setQuery(value);
    },
    [setQuery],
  );

  return {
    query,
    queryDraft,
    commitQuery,
    setQueryDraft,
    categories,
    setCategories,
    statuses,
    setStatuses,
    tag,
    setTag,
    minPrice,
    setMinPrice,
    maxPrice,
    setMaxPrice,
    popularity,
    setPopularity,
    favoritesOnly,
    setFavoritesOnly,
    sort,
    setSort,
    clearAll,
  };
}
