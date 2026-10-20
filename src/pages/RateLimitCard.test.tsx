// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { APIItem } from "../data/mockApis";
import { isMarketplaceSubpage } from "../routeMatchers";
import { ROUTE_CATALOGUE } from "../config/routeCatalogue";

const catalog: APIItem[] = [
  {
    id: "three-tier",
    name: "Three Tier API",
    provider: { name: "P" },
    description: "d",
    pricePerRequest: 0.01,
    rateLimits: [
      { plan: "Free", requestsPerMinute: 10, burstLimit: 20, concurrentConnections: 2 },
      { plan: "Developer", requestsPerMinute: 120000, burstLimit: 200, concurrentConnections: 10 },
      { plan: "Pro", requestsPerMinute: 600, burstLimit: 1000, concurrentConnections: 50 },
    ],
  },
  {
    id: "no-burst",
    name: "No Burst API",
    provider: { name: "P" },
    description: "d",
    pricePerRequest: 0.01,
    rateLimits: [{ plan: "Standard", requestsPerMinute: 300 }],
  },
  {
    id: "unpublished",
    name: "Unpublished API",
    provider: { name: "P" },
    description: "d",
    pricePerRequest: 0.01,
  },
];

vi.mock("../api/catalogApi", () => ({
  fetchCatalog: vi.fn(() => Promise.resolve(catalog)),
}));

import RateLimitCard from "./RateLimitCard";

function renderPage(apiId: string) {
  return render(
    <MemoryRouter initialEntries={[`/marketplace/${apiId}/rate-limits`]}>
      <Routes>
        <Route path="/marketplace/:apiId/rate-limits" element={<RateLimitCard />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RateLimitCard", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

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
    renderPage("nope");
    expect(await screen.findByTestId("rate-limit-not-found")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("builds a breadcrumb from the API name whose hrefs all resolve to existing routes", async () => {
    renderPage("three-tier");
    await screen.findByRole("table");
    const nav = screen.getByRole("navigation", { name: /breadcrumb/i });
    const hrefs = Array.from(nav.querySelectorAll("a")).map((a) => a.getAttribute("href") ?? "");
    expect(hrefs.length).toBeGreaterThanOrEqual(3);
    for (const href of hrefs) {
      const resolves =
        href === "/marketplace" || href.startsWith("/details/") || isMarketplaceSubpage(href);
      expect(resolves, href).toBe(true);
    }
    expect(nav.textContent).toContain("Three Tier API");
  });

  it("contains no GrantFox literals", async () => {
    const { container } = renderPage("three-tier");
    await screen.findByRole("table");
    expect(container.textContent).not.toMatch(/GrantFox/i);
  });
});

describe("ROUTE_CATALOGUE", () => {
  it("has no dead /rate-limit entry", () => {
    expect(ROUTE_CATALOGUE.some((r) => r.path === "/rate-limit")).toBe(false);
  });
});
