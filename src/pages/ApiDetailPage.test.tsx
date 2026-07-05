// @vitest-environment jsdom

import { act } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ApiDetailPage from "./ApiDetailPage";

// Mock matchMedia for Tabs component
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

function settleLoadingState() {
  act(() => {
    vi.advanceTimersByTime(2000);
  });
}

describe("ApiDetailPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.history.pushState({}, "", "/details/weather-001");
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    window.history.pushState({}, "", "/");
  });

  it("renders endpoint group previews in the documentation tab", () => {
    render(<ApiDetailPage />);
    settleLoadingState();

    fireEvent.click(screen.getByRole("tab", { name: "Documentation" }));

    expect(
      screen.getByRole("heading", { name: "Endpoint groups" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /forecast 1 endpoint/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /historical weather 1 endpoint/i }),
    ).toBeTruthy();
  });

  it("shows the group preview when a trigger receives keyboard focus", () => {
    render(<ApiDetailPage />);
    settleLoadingState();

    fireEvent.click(screen.getByRole("tab", { name: "Documentation" }));
    fireEvent.focus(
      screen.getByRole("button", { name: /forecast 1 endpoint/i }),
    );

    const preview = screen.getByLabelText("Forecast group preview");

    expect(preview).toBeTruthy();
    expect(within(preview).getByText("Get Forecast")).toBeTruthy();
    expect(
      within(preview).getByText(/1 endpoint.*2 request parameter/),
    ).toBeTruthy();
  });

  it("filters documentation endpoints from the search combobox", () => {
    render(<ApiDetailPage />);
    settleLoadingState();

    fireEvent.click(screen.getByRole("tab", { name: "Documentation" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Search endpoints" }), {
      target: { value: "historical" },
    });

    expect(screen.getByRole("status").textContent).toBe("Showing 1 of 2 endpoints");
    expect(screen.getAllByText("Historical Weather").length).toBeGreaterThan(0);
    expect(screen.queryByText("Get Forecast")).toBeNull();
  });

  it("shows a resettable empty state when endpoint search has no matches", () => {
    render(<ApiDetailPage />);
    settleLoadingState();

    fireEvent.click(screen.getByRole("tab", { name: "Documentation" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Search endpoints" }), {
      target: { value: "billing" },
    });

    expect(screen.getByRole("heading", { name: "No endpoints match your search" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear all filters" }));

    expect(screen.getByRole("status").textContent).toBe("2 endpoints available");
    expect(screen.getByText("Get Forecast")).toBeTruthy();
    expect(screen.getAllByText("Historical Weather").length).toBeGreaterThan(0);
  });
});
