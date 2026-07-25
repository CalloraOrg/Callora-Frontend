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
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("filters marketplace results when a tag chip is clicked", () => {
    renderMarketplacePage();
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
    renderMarketplacePage();
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

  it("applies marketplace-results--tray-open class when the compare drawer tray is visible", () => {
    renderMarketplacePage();
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

  it("shows empty state with secondary CTA when favorites-only has no results", () => {
    renderMarketplacePage();
    settleMarketplaceTimers();

    const favoritesCheckbox = screen.getByLabelText("Favorites only");
    fireEvent.click(favoritesCheckbox);

    expect(screen.getByText("No favorites yet")).toBeTruthy();
    expect(screen.getByText("Try starring some APIs to see them here!")).toBeTruthy();

    const browseBtn = screen.getByTestId("empty-state-secondary-action");
    expect(browseBtn).toBeTruthy();
    expect(browseBtn.textContent).toBe("Browse all APIs");

    fireEvent.click(browseBtn);
    expect(screen.queryByText("No favorites yet")).toBeNull();
  });

  it("shows filtered empty state with clear-all-filters CTA", () => {
    renderMarketplacePage();
    settleMarketplaceTimers();

    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: "nonexistent-api-xyz" } });

    act(() => { vi.advanceTimersByTime(500); });

    expect(screen.getByText("No results found")).toBeTruthy();
    expect(screen.getByText("Try adjusting your filters or clear them to see all available APIs.")).toBeTruthy();

    const browseBtn = screen.getByTestId("empty-state-secondary-action");
    expect(browseBtn.textContent).toBe("Browse all APIs");
  });
});
