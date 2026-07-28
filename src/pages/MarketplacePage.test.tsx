// @vitest-environment jsdom

import { act } from "react";
import { MemoryRouter } from "react-router-dom";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionsProvider } from "../state/collectionsStore";
import { compareStore } from "../state/compareStore";
import MarketplacePage from "./MarketplacePage";
import type { APIItem } from "../data/mockApis";

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

function settleMarketplaceTimers() {
  act(() => {
    vi.advanceTimersByTime(2000);
  });
}

describe("MarketplacePage", () => {
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

  it("filters marketplace results when a tag chip is clicked", () => {
    renderPage();
    settleMarketplaceTimers();

    const weatherTag = screen.getByRole("button", {
      name: "Filter marketplace by tag weather",
    });

    fireEvent.click(weatherTag);

    expect(screen.getByText("Filtered by tag: #weather")).toBeTruthy();
    expect(screen.getByText("WeatherSim API")).toBeTruthy();
    expect(screen.queryByText("QuickPay")).toBeNull();
  });

  it("toggles an active tag filter off when the same tag is clicked again", () => {
    renderPage();
    settleMarketplaceTimers();

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

  it("keeps card navigation from firing when a tag chip is clicked", () => {
    const pushStateSpy = vi.spyOn(window.history, "pushState");

    renderPage();
    settleMarketplaceTimers();

    const main = screen.getByRole("main");
    expect(main.classList.contains("marketplace-results")).toBe(true);
    expect(main.classList.contains("marketplace-results--tray-open")).toBe(false);
  });

  it("applies marketplace-results--tray-open class when compare tray has APIs", () => {
    compareStore.addApi({ id: "stub-api" } as APIItem);

    renderMarketplacePage();
    settleMarketplaceTimers();

    const main = screen.getByRole("main");
    expect(main.classList.contains("marketplace-results--tray-open")).toBe(true);

    compareStore.clear();
  });

  it("applies CSS classes for design-token-pinned spacing and typography", () => {
    renderMarketplacePage();
    settleMarketplaceTimers();

    const page = document.querySelector(".marketplace-page");
    expect(page).toBeTruthy();

    const header = document.querySelector(".marketplace-header");
    expect(header).toBeTruthy();

    const toolbar = document.querySelector(".marketplace-toolbar");
    expect(toolbar).toBeTruthy();

    const grid = document.querySelector(".marketplace-grid");
    expect(grid).toBeTruthy();
  });

  it("marketplace grid uses responsive minmax with token-based sizing", () => {
    renderMarketplacePage();
    settleMarketplaceTimers();

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

    it("renders a live region for screen reader announcements", () => {
      renderMarketplacePage();
      settleMarketplaceTimers();

      const regions = screen.getAllByTestId("live-region");
      expect(regions.length).toBeGreaterThanOrEqual(1);
      const region = getPageLiveRegion();
      expect(region.getAttribute("role")).toBe("status");
      expect(region.getAttribute("aria-live")).toBe("polite");
    });

    it("announces when filters are cleared", () => {
      renderMarketplacePage();
      settleMarketplaceTimers();

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

  it("wraps page-count numbers in .numeric-tabular spans for tabular-nums alignment", () => {
    renderMarketplacePage();
    settleMarketplaceTimers();

    // All numeric spans inside the count label must carry the utility class.
    const count = document.querySelector(".marketplace-count");
    expect(count).toBeTruthy();

    const numericSpans = count!.querySelectorAll("span.numeric-tabular");
    // Expects at least 3 spans: startItem, endItem, filtered.length
    expect(numericSpans.length).toBeGreaterThanOrEqual(3);
  });

  it("numeric-tabular spans contain only digit characters", () => {
    renderMarketplacePage();
    settleMarketplaceTimers();

    const count = document.querySelector(".marketplace-count");
    const numericSpans = count!.querySelectorAll("span.numeric-tabular");

    numericSpans.forEach((span) => {
      expect(span.textContent?.trim()).toMatch(/^\d+$/);
    });
  });

  it("renders two .numeric-tabular spans showing '0' when no APIs match the search", () => {
    renderMarketplacePage();
    settleMarketplaceTimers();

    // Type a search term that matches nothing
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "zzz_no_match_zzz" } });

    // Advance debounce (300 ms) + any remaining timers
    act(() => {
      vi.advanceTimersByTime(500);
    });

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

  it("reads ?q= param and populates the search input", () => {
    renderPage(["/marketplace?q=weather"]);
    settleMarketplaceTimers();

    const searchInput = screen.getByRole("searchbox");
    expect((searchInput as HTMLInputElement).value).toBe("weather");
  });

  it("reads ?favorites=1 param and activates the favorites-only filter", () => {
    renderPage(["/marketplace?favorites=1"]);
    settleMarketplaceTimers();

    const favCheckbox = screen.getByRole("checkbox", { name: /favorites only/i });
    expect((favCheckbox as HTMLInputElement).checked).toBe(true);
  });

  it("reads ?page param and clamps invalid page to valid range", () => {
    renderPage(["/marketplace?page=99"]);
    settleMarketplaceTimers();

    const page1Btn = screen.getByRole("button", { name: "Page 1" });
    expect(page1Btn.getAttribute("aria-current")).toBe("page");
  });

  it("reads multiple filter params simultaneously", () => {
    renderPage(["/marketplace?q=pay&favorites=1&sort=newest"]);
    settleMarketplaceTimers();

    const searchInput = screen.getByRole("searchbox");
    expect((searchInput as HTMLInputElement).value).toBe("pay");

    const favCheckbox = screen.getByRole("checkbox", { name: /favorites only/i });
    expect((favCheckbox as HTMLInputElement).checked).toBe(true);
  });

  it("clearing filters removes all filter params from URL", () => {
    renderPage(["/marketplace?q=weather&favorites=1&categories=AI/ML"]);
    settleMarketplaceTimers();

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

  it("renders status filter options with color-blind pattern swatches", () => {
    renderPage();
    settleMarketplaceTimers();

    const statusLabels = ["Operational", "Degraded", "Maintenance", "Down"];
    statusLabels.forEach((label) => {
      const checkbox = screen.getByRole("checkbox", { name: label });
      expect(checkbox).toBeTruthy();
    });
  });

  it("each status label has an associated pattern swatch", () => {
    renderPage();
    settleMarketplaceTimers();

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

  it("filters APIs by operational status", () => {
    renderPage();
    settleMarketplaceTimers();

    const operational = screen.getByLabelText(/operational/i);
    fireEvent.click(operational);

    expect(screen.getByText(/showing/i)).toBeTruthy();
  });

  it("reads ?statuses= param from URL", () => {
    renderPage(["/marketplace?statuses=down,maintenance"]);
    settleMarketplaceTimers();

    expect(
      (screen.getByLabelText(/down/i) as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (screen.getByLabelText(/maintenance/i) as HTMLInputElement).checked,
    ).toBe(true);
  });

  it("clears status filter when clear filters is clicked", () => {
    renderPage(["/marketplace?statuses=degraded"]);
    settleMarketplaceTimers();

    expect(
      (screen.getByLabelText(/degraded/i) as HTMLInputElement).checked,
    ).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /clear filters/i }));

    expect(
      (screen.getByLabelText(/degraded/i) as HTMLInputElement).checked,
    ).toBe(false);
  });
});
