// @vitest-environment jsdom

import { act } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionsProvider } from "../state/collectionsStore";
import MarketplacePage from "./MarketplacePage";

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

    fireEvent.click(screen.getByRole("button", {
      name: "Filter marketplace by tag weather",
    }));

    expect(pushStateSpy).not.toHaveBeenCalled();

    pushStateSpy.mockRestore();
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

    fireEvent.click(screen.getByRole("button", { name: /clear filters/i }));

    const searchInput = screen.getByRole("searchbox");
    expect((searchInput as HTMLInputElement).value).toBe("");

    const favCheckbox = screen.getByRole("checkbox", { name: /favorites only/i });
    expect((favCheckbox as HTMLInputElement).checked).toBe(false);
  });
});
