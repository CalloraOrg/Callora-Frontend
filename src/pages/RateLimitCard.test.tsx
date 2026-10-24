// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import RateLimitCard, { PLAN_PATTERNS, type RateLimitCardProps } from "./RateLimitCard";
import type { APIItem } from "../data/mockApis";
import { ROUTE_CATALOGUE } from "../config/routeCatalogue";

/**
 * RateLimitCard tests – per-API rate limits at `/marketplace/:apiId/rate-limits`.
 *
 * Covers loading / ready / not-published / not-found / error states, optional
 * columns, current-plan marking, mobile cards, breadcrumb and number format.
 */

const FIXTURES: APIItem[] = [
  {
    id: "three-tier",
    name: "Three Tier API",
    rateLimits: [
      { plan: "Free", requestsPerMinute: 60, burstLimit: 120, concurrentConnections: 2 },
      { plan: "Pro", requestsPerMinute: 6000, burstLimit: 9000, concurrentConnections: 50 },
      { plan: "Enterprise", requestsPerMinute: 120000, burstLimit: 200000, concurrentConnections: 500 },
    ],
  },
  {
    id: "no-burst",
    name: "No Burst API",
    rateLimits: [
      { plan: "Standard", requestsPerMinute: 300 },
      { plan: "Premium", requestsPerMinute: 3000 },
    ],
  },
  { id: "unpublished", name: "Unpublished API" },
] as unknown as APIItem[];

const fetchCatalogMock = vi.fn();

vi.mock("../api/catalogApi", () => ({
  fetchCatalog: (...args: unknown[]) => fetchCatalogMock(...args),
  isCatalogAbortError: (err: unknown) =>
    err instanceof DOMException && err.name === "AbortError",
}));

function mockViewport(isMobile: boolean) {
  const original = window.matchMedia;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: isMobile,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}

function renderPage(apiId: string, props: Omit<RateLimitCardProps, "apiId"> = {}) {
  return render(
    <MemoryRouter initialEntries={[`/marketplace/${apiId}/rate-limits`]}>
      <Routes>
        <Route path="/marketplace/:apiId/rate-limits" element={<RateLimitCard {...props} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RateLimitCard", () => {
  let restoreViewport: () => void = () => {};

  beforeEach(() => {
    fetchCatalogMock.mockReset();
    fetchCatalogMock.mockResolvedValue(FIXTURES);
    restoreViewport = mockViewport(false);
  });

  afterEach(() => {
    cleanup();
    restoreViewport();
  });

  it("shows a loading state first", () => {
    renderPage("three-tier");
    expect(screen.getByRole("status").textContent).toMatch(/loading/i);
  });

  it("renders three rows and a caption naming the API", async () => {
    renderPage("three-tier");
    const table = await screen.findByRole("table", { name: /Three Tier API/ });
    expect(within(table).getByText(/Rate limit tiers for Three Tier API/)).toBeTruthy();
    expect(within(table).getAllByRole("row").length).toBe(4); // header + 3
    expect(within(table).getByText(new Intl.NumberFormat().format(120000))).toBeTruthy();
    expect(within(table).getByText("Burst limit")).toBeTruthy();
    expect(within(table).getByText("Concurrent connections")).toBeTruthy();
  });

  it("omits Burst and Concurrent columns when no tier has them", async () => {
    renderPage("no-burst");
    const table = await screen.findByRole("table", { name: /No Burst API/ });
    expect(within(table).queryByText("Burst limit")).toBeNull();
    expect(within(table).queryByText("Concurrent connections")).toBeNull();
    expect(within(table).getByText("Requests / min")).toBeTruthy();
  });

  it("shows the not-published state when the API has no rateLimits", async () => {
    renderPage("unpublished");
    expect(await screen.findByText("This provider has not published rate limits.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows a not-found panel for an unknown id", async () => {
    renderPage("does-not-exist");
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/API Not Found/);
    expect(within(alert).getByRole("link", { name: /Back to Marketplace/ }).getAttribute("href")).toBe("/marketplace");
  });

  it("shows an error panel when the catalogue fails to load", async () => {
    fetchCatalogMock.mockRejectedValue(new Error("boom"));
    renderPage("three-tier");
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/unavailable/i);
  });

  it("builds a breadcrumb from the API name whose hrefs all resolve to existing routes", async () => {
    renderPage("three-tier");
    await screen.findByRole("table");
    const nav = screen.getByRole("navigation", { name: /breadcrumb/i });
    expect(nav.textContent).toContain("Marketplace");
    expect(nav.textContent).toContain("Three Tier API");
    const hrefs = Array.from(nav.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    for (const href of hrefs) {
      expect(href).toMatch(/^\/(marketplace|details\/three-tier|marketplace\/three-tier\/rate-limits)$/);
    }
  });

  it("marks the specified currentPlan row with a 'Current plan' badge", async () => {
    renderPage("three-tier", { currentPlan: "Pro" });
    const table = await screen.findByRole("table");
    const currentRow = table.querySelector('tbody tr[aria-current="true"]');
    expect(currentRow?.textContent).toContain("Pro");
    expect(currentRow?.textContent).toContain("Current plan");
    expect(table.querySelectorAll('tbody tr:not([aria-current="true"])').length).toBe(2);
  });

  it("renders stacked plan cards and no table on mobile viewports", async () => {
    restoreViewport();
    restoreViewport = mockViewport(true);
    const { container } = renderPage("three-tier");
    await screen.findByText("Enterprise");
    expect(screen.queryByRole("table")).toBeNull();
    expect(container.querySelectorAll(".rate-limit-plan-card").length).toBe(3);
  });

  it("renders numbers inside a tabular-nums span with a pattern badge per plan", async () => {
    renderPage("three-tier");
    await screen.findByRole("table");
    const span = screen.getByText(new Intl.NumberFormat().format(6000));
    expect(span.tagName).toBe("SPAN");
    expect(span.classList.contains("rate-limit-number")).toBe(true);
    for (const plan of ["Free", "Pro", "Enterprise"]) {
      const badge = screen.getByText(plan);
      expect(badge.classList.contains("rate-limit-badge")).toBe(true);
      expect(badge.classList.contains(PLAN_PATTERNS[plan].class)).toBe(true);
      expect(badge.getAttribute("data-pattern")).toBeTruthy();
    }
  });

  it("contains no GrantFox literals", async () => {
    const { container } = renderPage("three-tier");
    await screen.findByRole("table");
    expect(container.textContent).not.toMatch(/GrantFox/i);
  });
});

describe("ROUTE_CATALOGUE", () => {
  it("has no dead /rate-limit entry", () => {
    expect(ROUTE_CATALOGUE.some((entry) => entry.path === "/rate-limit")).toBe(false);
  });
});
