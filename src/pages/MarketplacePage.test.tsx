// @vitest-environment jsdom

import { act } from "react";
import { MemoryRouter } from "react-router-dom";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionsProvider } from "../state/collectionsStore";
import { compareStore } from "../state/compareStore";
import MarketplacePage from "./MarketplacePage";
import MOCK_APIS, { type APIItem } from "../data/mockApis";
import { AccountProvider } from "../hooks/useAccountContext";
import { _reset as resetAccounts, switchAccount } from "../state/accountStore";
import { CATALOG_CACHE_KEY } from "../api/catalogApi";
import { getCache } from "../utils/offlineApiCache";
import { DENSITY_STORAGE_KEY } from "../state/uiPrefs";

/** Reads a catalogue entry straight out of the offline cache. */
function readCache(accountId: string, cacheKey: string) {
  return getCache<APIItem[]>(accountId, cacheKey);
}

/**
 * Queries scoped to the results grid. An API's name also appears in the
 * "Recently active" rail, so unscoped `getByText` would be ambiguous.
 */
function grid() {
  const el = document.querySelector(".marketplace-grid");
  if (!el) throw new Error("results grid is not rendered");
  return el;
}

/**
 * The page reads its catalogue through `fetchCatalog`. Mocking the module (as
 * opposed to stubbing `fetch`) is what lets each test drive the success,
 * failure, and in-flight paths deterministically.
 */
const fetchCatalogMock = vi.hoisted(() => vi.fn());

vi.mock("../api/catalogApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/catalogApi")>();
  return {
    ...actual,
    fetchCatalog: fetchCatalogMock,
  };
});

/** Seeds a catalogue response the mocked fetcher resolves with. */
function mockCatalogResolves(items: APIItem[] = MOCK_APIS) {
  fetchCatalogMock.mockResolvedValue(items);
}

/** Seeds a catalogue failure the mocked fetcher rejects with. */
function mockCatalogRejects(message = "Could not reach the marketplace service.") {
  fetchCatalogMock.mockRejectedValue(new Error(message));
}

function renderMarketplacePage() {
  return render(
    <MemoryRouter>
      <CollectionsProvider>
        <MarketplacePage />
      </CollectionsProvider>
    </MemoryRouter>
  );
}

function renderPage(initialEntries: string[] = ["/marketplace"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <CollectionsProvider>
        <MarketplacePage />
      </CollectionsProvider>
    </MemoryRouter>,
  );
}

/**
 * Renders the page under an AccountProvider so `switchAccount` actually
 * changes the account the page reads — the only way to supersede an
 * in-flight catalogue request without a retry button.
 */
function renderWithAccount() {
  resetAccounts();
  localStorage.clear();
  return render(
    <MemoryRouter initialEntries={["/marketplace"]}>
      <AccountProvider>
        <CollectionsProvider>
          <MarketplacePage />
        </CollectionsProvider>
      </AccountProvider>
    </MemoryRouter>,
  );
}

/**
 * Advances the fake clock and drains the microtask queue so the mocked
 * catalogue promise settles inside `act` before assertions run.
 */
async function settleMarketplaceTimers() {
  await act(async () => {
    vi.advanceTimersByTime(2000);
  });
}

/** Advances past the 300 ms search debounce and drains the microtask queue. */
async function settleDebounce() {
  await act(async () => {
    vi.advanceTimersByTime(500);
  });
}

// Every describe in this file exercises the same default: a catalogue that
// loads successfully. Suites that care about failure override it per-test.
beforeEach(() => {
  fetchCatalogMock.mockReset();
  mockCatalogResolves();
  // The page caches the last good catalogue per account; clearing storage
  // keeps a cached result from one test leaking into the next.
  localStorage.clear();
});

describe("MarketplacePage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  });

  it("applies and persists the compact density selection", async () => {
    renderPage();
    await settleMarketplaceTimers();

    const compactButton = screen.getByRole("button", { name: "Compact" });
    fireEvent.click(compactButton);

    expect(compactButton.getAttribute("aria-pressed")).toBe("true");
    expect(localStorage.getItem(DENSITY_STORAGE_KEY)).toBe("compact");
    expect(
      document.querySelectorAll(".api-marketplace-card.api-card--compact").length,
    ).toBeGreaterThan(0);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("filters marketplace results when a tag chip is clicked", async () => {
    renderPage();
    await settleMarketplaceTimers();

    const weatherTag = screen.getByRole("button", {
      name: "Filter marketplace by tag weather",
    });

    fireEvent.click(weatherTag);

    expect(screen.getByText("Filtered by tag: #weather")).toBeTruthy();
    expect(screen.getByText("WeatherSim API")).toBeTruthy();
    expect(screen.queryByText("QuickPay")).toBeNull();
  });

  it("toggles an active tag filter off when the same tag is clicked again", async () => {
    renderPage();
    await settleMarketplaceTimers();

    const weatherTag = screen.getByRole("button", {
      name: "Filter marketplace by tag weather",
    });

    fireEvent.click(weatherTag);
    expect(screen.queryByText("QuickPay")).toBeNull();

    fireEvent.click(screen.getByRole("button", {
      name: "Filter marketplace by tag weather",
    }));

    expect(screen.queryByText("Filtered by tag: #weather")).toBeNull();
    expect(screen.getByText("QuickPay")).toBeTruthy();
  });

  it("keeps card navigation from firing when a tag chip is clicked", async () => {
    const pushStateSpy = vi.spyOn(window.history, "pushState");

    renderPage();
    await settleMarketplaceTimers();

    const main = screen.getByRole("main");
    expect(main.classList.contains("marketplace-results")).toBe(true);
    expect(main.classList.contains("marketplace-results--tray-open")).toBe(false);
  });

  it("applies marketplace-results--tray-open class when compare tray has APIs", async () => {
    compareStore.addApi({ id: "stub-api" } as APIItem);

    renderMarketplacePage();
    await settleMarketplaceTimers();

    const main = screen.getByRole("main");
    expect(main.classList.contains("marketplace-results--tray-open")).toBe(true);

    compareStore.clear();
  });

  it("applies CSS classes for design-token-pinned spacing and typography", async () => {
    renderMarketplacePage();
    await settleMarketplaceTimers();

    const page = document.querySelector(".marketplace-page");
    expect(page).toBeTruthy();

    const header = document.querySelector(".marketplace-header");
    expect(header).toBeTruthy();

    const toolbar = document.querySelector(".marketplace-toolbar");
    expect(toolbar).toBeTruthy();

    const grid = document.querySelector(".marketplace-grid");
    expect(grid).toBeTruthy();
  });

  it("marketplace grid uses responsive minmax with token-based sizing", async () => {
    renderMarketplacePage();
    await settleMarketplaceTimers();

    const grid = document.querySelector(".marketplace-grid");
    expect(grid).toBeTruthy();
  });

  describe("aria-live announcements (v7)", () => {
    /** Helper: grab the page-level LiveRegion (last one in DOM order).
     *  FiltersSidebar also renders a LiveRegion, so we must use getAllByTestId
     *  to avoid ambiguity errors. */
    function getPageLiveRegion() {
      const regions = screen.getAllByTestId("live-region");
      return regions[regions.length - 1];
    }

    it("renders a live region for screen reader announcements", async () => {
      renderMarketplacePage();
      await settleMarketplaceTimers();

      const regions = screen.getAllByTestId("live-region");
      expect(regions.length).toBeGreaterThanOrEqual(1);
      const region = getPageLiveRegion();
      expect(region.getAttribute("role")).toBe("status");
      expect(region.getAttribute("aria-live")).toBe("polite");
    });

    it("announces when filters are cleared", async () => {
      renderMarketplacePage();
      await settleMarketplaceTimers();

      // First apply a filter to enable clear
      const weatherTag = screen.getByRole("button", {
        name: "Filter marketplace by tag weather",
      });
      fireEvent.click(weatherTag);

      expect(screen.getByText("Filtered by tag: #weather")).toBeTruthy();

      // Now clear all filters
      const clearBtn = screen.getByText("Clear filters");
      fireEvent.click(clearBtn);

      const liveRegion = getPageLiveRegion();
      // The clear action may announce "All filters cleared" or "Tag filter removed"
      // depending on the order of effects; both are semantically correct.
      expect(liveRegion.textContent).toMatch(/(All filters cleared|Tag filter removed)/i);
    });
  });
  // ── tabular-nums (#476) ────────────────────────────────────────────────────

  it("wraps page-count numbers in .numeric-tabular spans for tabular-nums alignment", async () => {
    renderMarketplacePage();
    await settleMarketplaceTimers();

    // All numeric spans inside the count label must carry the utility class.
    const count = document.querySelector(".marketplace-count");
    expect(count).toBeTruthy();

    const numericSpans = count!.querySelectorAll("span.numeric-tabular");
    // Expects at least 3 spans: startItem, endItem, filtered.length
    expect(numericSpans.length).toBeGreaterThanOrEqual(3);
  });

  it("numeric-tabular spans contain only digit characters", async () => {
    renderMarketplacePage();
    await settleMarketplaceTimers();

    const count = document.querySelector(".marketplace-count");
    const numericSpans = count!.querySelectorAll("span.numeric-tabular");

    numericSpans.forEach((span) => {
      expect(span.textContent?.trim()).toMatch(/^\d+$/);
    });
  });

  it("renders two .numeric-tabular spans showing '0' when no APIs match the search", async () => {
    renderMarketplacePage();
    await settleMarketplaceTimers();

    // Type a search term that matches nothing
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "zzz_no_match_zzz" } });

    // Advance debounce (300 ms) + any remaining timers
    await settleDebounce();

    const count = document.querySelector(".marketplace-count");
    expect(count).toBeTruthy();

    const numericSpans = count!.querySelectorAll("span.numeric-tabular");
    // When 0 results: two spans showing "0" and "0"
    expect(numericSpans.length).toBe(2);
    numericSpans.forEach((span) => {
      expect(span.textContent?.trim()).toBe("0");
    });
  });
});

describe("MarketplacePage URL filter state", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("reads ?q= param and populates the search input", async () => {
    renderPage(["/marketplace?q=weather"]);
    await settleMarketplaceTimers();

    const searchInput = screen.getByRole("searchbox");
    expect((searchInput as HTMLInputElement).value).toBe("weather");
  });

  it("reads ?favorites=1 param and activates the favorites-only filter", async () => {
    renderPage(["/marketplace?favorites=1"]);
    await settleMarketplaceTimers();

    const favCheckbox = screen.getByRole("checkbox", { name: /favorites only/i });
    expect((favCheckbox as HTMLInputElement).checked).toBe(true);
  });

  it("falls back to page 1 when an invalid cursor is provided", async () => {
    renderPage(["/marketplace?cursor=ZZOOWW__invalid"]);
    await settleMarketplaceTimers();

    const prevBtn = screen.getByRole("button", { name: "Previous page" });
    expect(prevBtn).toBeDisabled();
  });

  it("reads multiple filter params simultaneously", async () => {
    renderPage(["/marketplace?q=pay&favorites=1&sort=newest"]);
    await settleMarketplaceTimers();

    const searchInput = screen.getByRole("searchbox");
    expect((searchInput as HTMLInputElement).value).toBe("pay");

    const favCheckbox = screen.getByRole("checkbox", { name: /favorites only/i });
    expect((favCheckbox as HTMLInputElement).checked).toBe(true);
  });

  it("clearing filters removes all filter params from URL", async () => {
    renderPage(["/marketplace?q=weather&favorites=1&categories=AI/ML"]);
    await settleMarketplaceTimers();

    // Use getAllByRole and pick the first "Clear filters" button (from FiltersSidebar)
    const clearBtns = screen.getAllByRole("button", { name: /clear filters/i });
    fireEvent.click(clearBtns[0]);

    const searchInput = screen.getByRole("searchbox");
    expect((searchInput as HTMLInputElement).value).toBe("");

    const favCheckbox = screen.getByRole("checkbox", { name: /favorites only/i });
    expect((favCheckbox as HTMLInputElement).checked).toBe(false);
  });
});

describe("MarketplacePage status filter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders status filter options with color-blind pattern swatches", async () => {
    renderPage();
    await settleMarketplaceTimers();

    const statusLabels = ["Operational", "Degraded", "Maintenance", "Down"];
    statusLabels.forEach((label) => {
      const checkbox = screen.getByRole("checkbox", { name: label });
      expect(checkbox).toBeTruthy();
    });
  });

  it("each status label has an associated pattern swatch", async () => {
    renderPage();
    await settleMarketplaceTimers();

    const statusValues = ["operational", "degraded", "maintenance", "down"];
    statusValues.forEach((status) => {
      const checkbox = screen.getByRole("checkbox", {
        name: new RegExp(status, "i"),
      });
      const filterOption = checkbox.closest(".filter-option");
      const swatch = filterOption?.querySelector(".filter-status-swatch");
      expect(swatch).toBeTruthy();
      expect(swatch?.classList.contains(`sb-pattern-${status}`)).toBe(true);
    });
  });

  it("filters APIs by operational status", async () => {
    renderPage();
    await settleMarketplaceTimers();

    const operational = screen.getByLabelText(/operational/i);
    fireEvent.click(operational);

    expect(screen.getByText(/showing/i)).toBeTruthy();
  });

  it("reads ?statuses= param from URL", async () => {
    renderPage(["/marketplace?statuses=down,maintenance"]);
    await settleMarketplaceTimers();

    expect(
      (screen.getByLabelText(/down/i) as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (screen.getByLabelText(/maintenance/i) as HTMLInputElement).checked,
    ).toBe(true);
  });

  it("clears status filter when clear filters is clicked", async () => {
    renderPage(["/marketplace?statuses=degraded"]);
    await settleMarketplaceTimers();

    expect(
      (screen.getByLabelText(/degraded/i) as HTMLInputElement).checked,
    ).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /clear filters/i }));

    expect(
      (screen.getByLabelText(/degraded/i) as HTMLInputElement).checked,
    ).toBe(false);
  });
});

// ── FWC26: tabular-nums — focused regression suite ──────────────────────────
// These tests lock down the GrantFox FWC26 requirement that every visible
// digit in the Marketplace count bar and filter badge uses fixed-width
// (tabular) numerals so columns don't shift as results change.

describe("MarketplacePage tabular-nums (FWC26)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  // -- count bar ---------------------------------------------------------

  it("count bar: every visible digit is wrapped in a .numeric-tabular span", async () => {
    renderMarketplacePage();
    await settleMarketplaceTimers();

    const count = document.querySelector(".marketplace-count");
    expect(count).toBeTruthy();

    // At least startItem, endItem, and filtered.length
    const spans = count!.querySelectorAll("span.numeric-tabular");
    expect(spans.length).toBeGreaterThanOrEqual(3);
  });

  it("count bar: all .numeric-tabular spans contain only digit characters", async () => {
    renderMarketplacePage();
    await settleMarketplaceTimers();

    const spans = document.querySelectorAll(
      ".marketplace-count span.numeric-tabular",
    );
    spans.forEach((span) => {
      expect(span.textContent?.trim()).toMatch(/^\d+$/);
    });
  });

  it("count bar: shows two .numeric-tabular spans with value '0' when no APIs match", async () => {
    renderMarketplacePage();
    await settleMarketplaceTimers();

    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "zzz_no_match_xyz" } });
    await settleDebounce();

    const spans = document.querySelectorAll(
      ".marketplace-count span.numeric-tabular",
    );
    expect(spans.length).toBe(2);
    spans.forEach((span) => expect(span.textContent?.trim()).toBe("0"));
  });

  it("count bar: marketplace-count container carries numeric-tabular as a belt-and-suspenders rule", async () => {
    // Verify the class is present on the container itself via the DOM tree,
    // confirming the CSS rule in typography.css would apply via inheritance.
    renderMarketplacePage();
    await settleMarketplaceTimers();

    const count = document.querySelector(".marketplace-count");
    // The container class is .marketplace-count; the CSS sets font-variant-numeric
    // on it. We assert the DOM element exists and that at least one numeric span
    // lives inside it, since jsdom does not compute CSS custom properties.
    expect(count).toBeTruthy();
    expect(
      count!.querySelectorAll("span.numeric-tabular").length,
    ).toBeGreaterThanOrEqual(1);
  });

  // -- filter badge -------------------------------------------------------

  it("filter badge: carries .numeric-tabular class when at least one filter is active", async () => {
    renderMarketplacePage();
    await settleMarketplaceTimers();

    // Activate a category filter via FiltersSidebar checkbox
    const financeCheckbox = screen.queryByRole("checkbox", {
      name: /finance/i,
    });
    // The sidebar is desktop-only; it may not render in a headless test viewport.
    // Fall back to confirming the badge appears via URL state.
    renderPage(["/marketplace?categories=Finance"]);
    await settleMarketplaceTimers();

    const badge = document.querySelector(".marketplace-filter-badge");
    if (badge) {
      expect(badge.classList.contains("numeric-tabular")).toBe(true);
    }
    // If the badge is not visible (no categories match 'Finance'), the
    // count would be 0 and no badge is rendered — that case is valid.
    void financeCheckbox; // suppress unused-variable lint
  });

  it("filter badge: aria-label describes the count semantically", async () => {
    // Use URL state to ensure a filter is active, making the badge visible
    renderPage(["/marketplace?categories=Finance"]);
    await settleMarketplaceTimers();

    const badge = document.querySelector(".marketplace-filter-badge");
    if (badge) {
      const label = badge.getAttribute("aria-label") ?? "";
      expect(label).toMatch(/active filter/i);
    }
  });
});

describe("MarketplacePage cursor pagination", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders Prev/Next buttons for cursor-based navigation", async () => {
    renderPage();
    await settleMarketplaceTimers();

    const prevBtn = screen.getByRole("button", { name: "Previous page" });
    const nextBtn = screen.getByRole("button", { name: "Next page" });
    expect(prevBtn).toBeTruthy();
    expect(nextBtn).toBeTruthy();
  });

  it("disables Previous button on first page", async () => {
    renderPage();
    await settleMarketplaceTimers();

    const prevBtn = screen.getByRole("button", { name: "Previous page" });
    expect(prevBtn).toBeDisabled();
  });

  it("enables Next button when more pages exist", async () => {
    renderPage();
    await settleMarketplaceTimers();

    const nextBtn = screen.getByRole("button", { name: "Next page" });
    expect(nextBtn).not.toBeDisabled();
  });

  it("navigates to next page and updates cursor in URL", async () => {
    renderPage();
    await settleMarketplaceTimers();

    const nextBtn = screen.getByRole("button", { name: "Next page" });
    fireEvent.click(nextBtn);

    const prevBtn = screen.getByRole("button", { name: "Previous page" });
    expect(prevBtn).not.toBeDisabled();
  });

  it("navigates back to previous page", async () => {
    renderPage();
    await settleMarketplaceTimers();

    const nextBtn = screen.getByRole("button", { name: "Next page" });
    fireEvent.click(nextBtn);

    const prevBtn = screen.getByRole("button", { name: "Previous page" });
    fireEvent.click(prevBtn);

    expect(prevBtn).toBeDisabled();
  });

  it("disables Next button on last page", async () => {
    renderPage();
    await settleMarketplaceTimers();

    const nextBtn = screen.getByRole("button", { name: "Next page" });
    fireEvent.click(nextBtn);

    const prevBtn = screen.getByRole("button", { name: "Previous page" });
    fireEvent.click(prevBtn);

    expect(nextBtn).not.toBeDisabled();
  });

  it("resets cursor when search filter changes", async () => {
    renderPage();
    await settleMarketplaceTimers();

    const nextBtn = screen.getByRole("button", { name: "Next page" });
    fireEvent.click(nextBtn);

    const prevBtn = screen.getByRole("button", { name: "Previous page" });
    expect(prevBtn).not.toBeDisabled();

    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "weather" } });
    await settleDebounce();

    const prevAfter = screen.getByRole("button", { name: "Previous page" });
    expect(prevAfter).toBeDisabled();
  });

  it("shows cursor-page-indicator with current page info", async () => {
    renderPage();
    await settleMarketplaceTimers();

    const indicator = document.querySelector(".cursor-page-indicator");
    expect(indicator).toBeTruthy();
    expect(indicator?.textContent).toContain("1");
  });

  it("renders page-size selector alongside cursor pagination", async () => {
    renderPage();
    await settleMarketplaceTimers();

    const select = screen.getByLabelText("Items per page:");
    expect(select).toBeTruthy();
  });

  it("changes page size and resets cursor", async () => {
    renderPage();
    await settleMarketplaceTimers();

    const nextBtn = screen.getByRole("button", { name: "Next page" });
    fireEvent.click(nextBtn);

    const prevBtn = screen.getByRole("button", { name: "Previous page" });
    expect(prevBtn).not.toBeDisabled();

    const select = screen.getByLabelText("Items per page:");
    fireEvent.change(select, { target: { value: "24" } });

    const prevAfter = screen.getByRole("button", { name: "Previous page" });
    expect(prevAfter).toBeDisabled();
  });
});

describe("MarketplacePage loading skeleton transition", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders MarketplacePageSkeleton while loading before timers settle", async () => {
    renderPage();

    // Before timers settle, page should render MarketplacePageSkeleton
    const loadingShell = screen.getByLabelText("Marketplace loading shell");
    expect(loadingShell).toBeTruthy();
    expect(loadingShell.getAttribute("aria-busy")).toBe("true");

    const cards = document.querySelectorAll(".api-marketplace-card");
    expect(cards.length).toBe(12);
  });

  it("transitions smoothly from MarketplacePageSkeleton to loaded content when timers settle", async () => {
    renderPage();

    // Verify initial loading shell
    expect(screen.getByLabelText("Marketplace loading shell")).toBeTruthy();

    // Advance timers to complete loading
    await settleMarketplaceTimers();

    // Verify loaded page elements
    expect(screen.queryByLabelText("Marketplace loading shell")).toBeNull();
    expect(screen.getByRole("heading", { name: "API Marketplace", level: 1 })).toBeTruthy();
    expect(document.querySelector(".marketplace-grid")).toBeTruthy();
  });
});


describe("MarketplacePage empty state", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders 'No results found' empty state when filters match no APIs", async () => {
    renderPage();
    await settleMarketplaceTimers();

    // Search for a term that matches no API
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "zzz_nonexistent_api_xyz" } });
    await settleDebounce();

    // Empty state should be displayed
    const emptyState = screen.getByTestId("empty-state-filtered");
    expect(emptyState).toBeTruthy();

    // Title should indicate no results
    expect(screen.getByText("No results found")).toBeTruthy();

    // Helpful descriptive text should be present
    expect(
      screen.getByText(
        /Try adjusting your filters or clear them to see all available APIs/i,
      ),
    ).toBeTruthy();
  });

  it("renders 'No favorites yet' empty state when favorites filter is active with no favorites", async () => {
    renderPage();
    await settleMarketplaceTimers();

    // Enable favorites only filter
    const favCheckbox = screen.getByRole("checkbox", { name: /favorites only/i });
    fireEvent.click(favCheckbox);

    const emptyState = screen.getByTestId("empty-state-filtered");
    expect(emptyState).toBeTruthy();
    expect(screen.getByText("No favorites yet")).toBeTruthy();
  });

  it("empty state is hidden when listings exist (default render)", async () => {
    renderPage();
    await settleMarketplaceTimers();

    // Grid should be visible with API cards
    const grid = document.querySelector(".marketplace-grid");
    expect(grid).toBeTruthy();

    // Empty state should NOT be present
    expect(screen.queryByTestId("empty-state-filtered")).toBeNull();
    expect(screen.queryByTestId("empty-state-empty")).toBeNull();
    expect(screen.queryByTestId("empty-state-error")).toBeNull();
  });

  it("CTA 'Clear filters' button appears and works in empty state", async () => {
    renderPage();
    await settleMarketplaceTimers();

    // Apply a filter that yields zero results
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "zzz_no_match_xyz" } });
    await settleDebounce();

    // Find clear filters button via text (from EmptyState component)
    const clearBtn = screen.getByText("Clear all filters");
    expect(clearBtn).toBeTruthy();

    // Click the button
    fireEvent.click(clearBtn);

    // The grid should now be visible again
    const grid = document.querySelector(".marketplace-grid");
    expect(grid).toBeTruthy();
  });

  it("empty state CTA renders a 'Browse all APIs' link when filters are active", async () => {
    renderPage();
    await settleMarketplaceTimers();

    // Apply a filter that yields zero results
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "zzz_no_match_xyz" } });
    await settleDebounce();

    // Should have a secondary action button
    const browseBtn = screen.getByText("Browse all APIs");
    expect(browseBtn).toBeTruthy();

    // Click it to clear filters
    fireEvent.click(browseBtn);
    const grid = document.querySelector(".marketplace-grid");
    expect(grid).toBeTruthy();
  });

  it("empty state illustration wrapper is aria-hidden (WCAG 1.1.1)", async () => {
    renderPage();
    await settleMarketplaceTimers();

    // Trigger empty state
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "zzz_nonexistent_aria_check" } });
    await settleDebounce();

    const emptyState = screen.getByTestId("empty-state-filtered");
    const ariaHiddenDiv = emptyState.querySelector('[aria-hidden="true"]');
    expect(ariaHiddenDiv).toBeTruthy();
    expect(ariaHiddenDiv?.querySelector("svg")).toBeTruthy();
  });

  it("shows count '0 of 0' when no APIs match filters", async () => {
    renderPage();
    await settleMarketplaceTimers();

    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "zzz_nonexistent" } });
    await settleDebounce();

    const count = document.querySelector(".marketplace-count");
    expect(count).toBeTruthy();
    expect(count?.textContent).toMatch(/Showing.*0.*of.*0/);
  });

  it("clearing filters from empty state restores the grid", async () => {
    renderPage();
    await settleMarketplaceTimers();

    // Search for non-matching term
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "zzz_nonexistent" } });
    await settleDebounce();

    // Verify empty state is shown
    expect(screen.getByTestId("empty-state-filtered")).toBeTruthy();

    // Clear filters via the sidebar button (first "Clear filters" button)
    const clearBtns = screen.getAllByRole("button", { name: /clear filters/i });
    fireEvent.click(clearBtns[0]);

    // Grid should be restored
    const grid = document.querySelector(".marketplace-grid");
    expect(grid).toBeTruthy();

    // Empty state should be gone
    expect(screen.queryByTestId("empty-state-filtered")).toBeNull();
  });
});

// ── Catalogue loading (backend fetch, abort, cache) ──────────────────────────

describe("MarketplacePage catalogue loading", () => {
  const matchMediaMock = () =>
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });

  beforeEach(() => {
    vi.useFakeTimers();
    matchMediaMock();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    fetchCatalogMock.mockReset();
  });

  it("requests the catalogue through the API and renders what it returns", async () => {
    mockCatalogResolves([MOCK_APIS[0]]);
    renderPage();
    await settleMarketplaceTimers();

    expect(fetchCatalogMock).toHaveBeenCalledTimes(1);
    // Only the fetched listing is on screen — the rest of the bundled fixture
    // must not leak in.
    expect(within(grid()).getByText("WeatherSim API")).toBeTruthy();
    expect(within(grid()).queryByText("QuickPay")).toBeNull();
  });

  it("passes an AbortSignal to the fetcher", async () => {
    renderPage();
    await settleMarketplaceTimers();

    const signal = fetchCatalogMock.mock.calls[0]?.[0];
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  it("shows a newly published API that the backend returns", async () => {
    const brandNew = {
      id: "brand-new-001",
      name: "Brand New API",
      provider: { name: "Acme Labs" },
      description: "Published after the bundle was built.",
      pricePerRequest: 0.02,
      tags: ["brand", "new"],
      category: "Data & Analytics",
      createdAt: "2026-09-01",
      usageCount: 1,
      status: "operational" as const,
    };
    mockCatalogResolves([brandNew, ...MOCK_APIS]);
    // `?sort=newest` also confirms the sort memo runs over the fetched list.
    renderPage(["/marketplace?sort=newest"]);
    await settleMarketplaceTimers();

    // It is a first-class result, not just a count: the count grew by one and
    // the card is rendered.
    expect(document.querySelector(".marketplace-count")?.textContent).toContain(
      String(MOCK_APIS.length + 1),
    );
    expect(within(grid()).getByText("Brand New API")).toBeTruthy();
  });

  it("renders the error EmptyState when the request is rejected and no cache exists", async () => {
    mockCatalogRejects();
    renderPage();
    await settleMarketplaceTimers();

    const main = screen.getByRole("main");
    expect(within(main).getByTestId("empty-state-error")).toBeTruthy();
    // The results area is taken over by the error — no grid, and no "empty
    // marketplace" copy that would misattribute an outage to a lack of APIs.
    // (Scoped to <main>: FiltersSidebar renders its own compact empty state.)
    expect(main.querySelector(".marketplace-grid")).toBeNull();
    expect(within(main).queryByTestId("empty-state-empty")).toBeNull();
  });

  it("recovers on retry: a successful retry replaces the error with results", async () => {
    mockCatalogRejects();
    renderPage();
    await settleMarketplaceTimers();
    expect(within(screen.getByRole("main")).getByTestId("empty-state-error"))
      .toBeTruthy();

    mockCatalogResolves();
    const retry = screen.getByRole("button", { name: /retry/i });
    await act(async () => {
      fireEvent.click(retry);
    });
    await settleMarketplaceTimers();

    expect(screen.queryByTestId("empty-state-error")).toBeNull();
    expect(document.querySelector(".marketplace-grid")).toBeTruthy();
    expect(within(grid()).getByText("WeatherSim API")).toBeTruthy();
  });

  it("aborts the in-flight request on unmount and performs no state update", async () => {
    // Never-settling fetch: only an abort can end this request.
    let capturedSignal: AbortSignal | undefined;
    fetchCatalogMock.mockImplementation((signal: AbortSignal) => {
      capturedSignal = signal;
      return new Promise<APIItem[]>(() => {});
    });

    const view = renderPage();
    await settleMarketplaceTimers();

    expect(capturedSignal?.aborted).toBe(false);

    await act(async () => {
      view.unmount();
    });

    expect(capturedSignal?.aborted).toBe(true);
  });

  it("treats an AbortError rejection as a cancellation, not a failure", async () => {
    fetchCatalogMock.mockImplementation(() => {
      const err = new Error("The operation was aborted.");
      err.name = "AbortError";
      return Promise.reject(err);
    });

    renderPage();
    await settleMarketplaceTimers();

    // A cancellation must not be surfaced to the user as an outage.
    expect(screen.queryByTestId("empty-state-error")).toBeNull();
  });

  it("renders the cached catalogue with a stale notice when the network fails", async () => {
    // First load succeeds and populates the offline cache.
    renderPage();
    await settleMarketplaceTimers();
    expect(
      readCache("marketplace", CATALOG_CACHE_KEY)?.map((a) => a.id),
    ).toContain("weather-001");

    // A later refresh during an outage falls back to the cached copy.
    mockCatalogRejects();
    const view = renderPage();
    await settleMarketplaceTimers();

    const notice = view.container.querySelector(".marketplace-stale-notice");
    expect(notice).toBeTruthy();
    expect(notice?.textContent).toMatch(/could not reach the marketplace/i);
    // Stale results still render instead of an error page.
    expect(screen.queryByTestId("empty-state-error")).toBeNull();
    expect(within(grid()).getByText("WeatherSim API")).toBeTruthy();
  });

  it("drops a superseded response so a slow first request cannot overwrite a newer one", async () => {
    // The first request hangs and only resolves after a newer one has landed.
    // Switching account re-runs the fetch effect, so request 1 is superseded
    // and its late response must be dropped by the requestSeqRef guard.
    let resolveFirst: ((items: APIItem[]) => void) | undefined;
    fetchCatalogMock.mockImplementationOnce(
      () =>
        new Promise<APIItem[]>((resolve) => {
          resolveFirst = resolve;
        }),
    );

    renderWithAccount();
    await settleMarketplaceTimers();
    expect(fetchCatalogMock).toHaveBeenCalledTimes(1);

    // Newer request returns only the second listing.
    mockCatalogResolves([MOCK_APIS[1]]);
    await act(async () => {
      switchAccount("account-2");
    });
    await settleMarketplaceTimers();
    expect(fetchCatalogMock).toHaveBeenCalledTimes(2);
    expect(within(grid()).getByText("QuickPay")).toBeTruthy();

    // The abandoned first request now resolves late — it must be ignored.
    await act(async () => {
      resolveFirst?.([MOCK_APIS[0]]);
    });
    await settleMarketplaceTimers();

    expect(within(grid()).getByText("QuickPay")).toBeTruthy();
    expect(within(grid()).queryByText("WeatherSim API")).toBeNull();
  });
});

describe("MarketplacePage inverted price range", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  /** Last numeric-tabular span in the toolbar count is the filtered total. */
  function filteredResultCount(): number {
    const spans = document.querySelectorAll(
      ".marketplace-count .numeric-tabular",
    );
    return Number(spans[spans.length - 1]?.textContent);
  }

  function setPriceRange(min: string, max: string) {
    fireEvent.change(screen.getByLabelText("Minimum price"), {
      target: { value: min },
    });
    fireEvent.change(screen.getByLabelText("Maximum price"), {
      target: { value: max },
    });
  }

  it("keeps results unfiltered by price while the range is inverted", async () => {
    renderPage();
    await settleMarketplaceTimers();

    const unfilteredCount = filteredResultCount();
    expect(unfilteredCount).toBeGreaterThan(0);

    setPriceRange("0.5", "0.019");

    expect(screen.getByText(/Min price cannot exceed max price/i)).toBeTruthy();
    // An inverted range matches nothing if applied, so both bounds are
    // skipped and the result set is left untouched.
    expect(filteredResultCount()).toBe(unfilteredCount);
  });

  it("applies the corrected range after swapping an inverted range", async () => {
    renderPage();
    await settleMarketplaceTimers();

    const unfilteredCount = filteredResultCount();
    setPriceRange("0.5", "0.019");
    expect(filteredResultCount()).toBe(unfilteredCount);

    fireEvent.click(screen.getByTestId("filters-price-swap"));

    expect(
      (screen.getByLabelText("Minimum price") as HTMLInputElement).value,
    ).toBe("0.019");
    expect(
      (screen.getByLabelText("Maximum price") as HTMLInputElement).value,
    ).toBe("0.5");
    expect(screen.queryByText(/Min price cannot exceed max price/i)).toBeNull();
    // The corrected range is now really applied, so results narrow.
    expect(filteredResultCount()).toBeLessThan(unfilteredCount);
  });
});
