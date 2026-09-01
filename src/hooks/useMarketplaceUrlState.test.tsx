// @vitest-environment jsdom

import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, useSearchParams } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { useMarketplaceUrlState } from "./useMarketplaceUrlState";

/**
 * Harness that exposes the live hook return value (via `captured`) and renders
 * the raw `searchParams` string so tests can assert the URL is the only store.
 */
let captured: ReturnType<typeof useMarketplaceUrlState> | null = null;

function Harness(): JSX.Element {
  const state = useMarketplaceUrlState();
  const [params] = useSearchParams();
  captured = state;
  return <div data-testid="params">{params.toString()}</div>;
}

function renderHookHarness(initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Harness />
    </MemoryRouter>,
  );
}

describe("useMarketplaceUrlState (URL is the single source of truth)", () => {
  beforeEach(() => {
    captured = null;
  });
  afterEach(() => {
    captured = null;
  });

  it("derives every filter purely from the URL", () => {
    renderHookHarness([
      "/marketplace?q=weather&categories=AI/ML,Finance&statuses=down,maintenance&tag=geo&minPrice=1&maxPrice=9&popularity=newest&favorites=1&sort=price-asc",
    ]);

    expect(captured).not.toBeNull();
    expect(captured!.query).toBe("weather");
    expect([...captured!.categories].sort()).toEqual(["AI/ML", "Finance"]);
    expect([...captured!.statuses].sort()).toEqual(["down", "maintenance"]);
    expect(captured!.tag).toBe("geo");
    expect(captured!.minPrice).toBe(1);
    expect(captured!.maxPrice).toBe(9);
    expect(captured!.popularity).toBe("newest");
    expect(captured!.favoritesOnly).toBe(true);
    expect(captured!.sort).toBe("price-asc");
  });

  it("falls back to authoritative defaults when params are absent", () => {
    renderHookHarness(["/marketplace"]);
    expect(captured!.query).toBe("");
    expect(captured!.categories.size).toBe(0);
    expect(captured!.statuses.size).toBe(0);
    expect(captured!.tag).toBeNull();
    expect(captured!.minPrice).toBeNull();
    expect(captured!.maxPrice).toBeNull();
    expect(captured!.popularity).toBe("any");
    expect(captured!.favoritesOnly).toBe(false);
    expect(captured!.sort).toBe("popularity");
  });

  it("setters write ONLY to the URL — there is no second local mirror", () => {
    const { getByTestId } = renderHookHarness(["/marketplace"]);

    act(() => {
      captured!.setCategories(new Set(["AI/ML"]));
    });
    expect(getByTestId("params").textContent).toContain("categories=AI%2FML");
    expect([...captured!.categories]).toEqual(["AI/ML"]);

    act(() => {
      captured!.setStatuses(new Set(["down"]));
    });
    expect(getByTestId("params").textContent).toContain("statuses=down");

    act(() => {
      captured!.setTag("geo");
    });
    expect(getByTestId("params").textContent).toContain("tag=geo");

    act(() => {
      captured!.setMinPrice(2);
    });
    act(() => {
      captured!.setMaxPrice(8);
    });
    act(() => {
      captured!.setPopularity("newest");
    });
    act(() => {
      captured!.setFavoritesOnly(true);
    });
    act(() => {
      captured!.setSort("price-asc");
    });
    const params = getByTestId("params").textContent ?? "";
    expect(params).toContain("minPrice=2");
    expect(params).toContain("maxPrice=8");
    expect(params).toContain("popularity=newest");
    expect(params).toContain("favorites=1");
    expect(params).toContain("sort=price-asc");
  });

  it("toggling a value off removes it from the URL entirely", () => {
    const { getByTestId } = renderHookHarness([
      "/marketplace?categories=AI/ML&favorites=1",
    ]);

    act(() => {
      captured!.setCategories(new Set());
    });
    expect(getByTestId("params").textContent).not.toContain("categories");

    act(() => {
      captured!.setFavoritesOnly(false);
    });
    expect(getByTestId("params").textContent).not.toContain("favorites");
  });

  it("clearAll wipes every filter + cursor param from the URL", () => {
    const { getByTestId } = renderHookHarness([
      "/marketplace?q=weather&categories=AI/ML&statuses=down&tag=geo&minPrice=1&maxPrice=9&popularity=newest&favorites=1&sort=price-asc&cursor=abc",
    ]);

    act(() => {
      captured!.clearAll();
    });
    expect(getByTestId("params").textContent).toBe("");
  });

  it("commitQuery updates the URL and the local draft synchronously", () => {
    renderHookHarness(["/marketplace"]);

    act(() => {
      captured!.commitQuery("hello");
    });
    expect(captured!.query).toBe("hello");
    expect(captured!.queryDraft).toBe("hello");
    expect(screen.getByTestId("params").textContent).toContain("q=hello");
  });
});
