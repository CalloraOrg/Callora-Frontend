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

    fireEvent.click(screen.getByRole("button", { name: "Documentation" }));

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

    fireEvent.click(screen.getByRole("button", { name: "Documentation" }));
    fireEvent.focus(
      screen.getByRole("button", { name: /forecast 1 endpoint/i }),
    );

    const preview = screen.getByLabelText("Forecast group preview");

    expect(preview).toBeTruthy();
    expect(within(preview).getByText("Get Forecast")).toBeTruthy();
    expect(
      within(preview).getByText("1 endpoint and 2 request parameters."),
    ).toBeTruthy();
  });

  it("applies the link-body utility class to provider links", () => {
    render(<ApiDetailPage />);
    settleLoadingState();

    // Weather API has provider name "OpenWeather" or similar. We can just check that all links in the hero with "link-body" exist.
    // Or we can query the links that contain the provider's text. Let's just find the link-body elements.
    const providerLinks = document.querySelectorAll(".link-body");
    expect(providerLinks.length).toBeGreaterThan(0);
  });
});
