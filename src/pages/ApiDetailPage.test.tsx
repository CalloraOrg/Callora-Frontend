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

  it("interactive elements are focusable (issue #541)", () => {
    render(<ApiDetailPage />);
    settleLoadingState();

    const tabs = screen.getAllByRole("tab");
    tabs.forEach(tab => {
      fireEvent.focus(tab);
      expect(document.activeElement).toBe(tab);
    });

    const connectButton = screen.getByRole("button", { name: /Connect API/i });
    fireEvent.focus(connectButton);
    expect(document.activeElement).toBe(connectButton);
  });
});
