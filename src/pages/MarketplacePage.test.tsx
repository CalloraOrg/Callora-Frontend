// @vitest-environment jsdom

import { act } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MarketplacePage from "./MarketplacePage";

function settleMarketplaceTimers() {
  act(() => {
    vi.advanceTimersByTime(2000);
  });
}

describe("MarketplacePage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("filters marketplace results when a tag chip is clicked", () => {
    render(<MarketplacePage />);
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
    render(<MarketplacePage />);
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

    render(<MarketplacePage />);
    settleMarketplaceTimers();

    fireEvent.click(screen.getByRole("button", {
      name: "Filter marketplace by tag weather",
    }));

    expect(pushStateSpy).not.toHaveBeenCalled();

    pushStateSpy.mockRestore();
  });
});
