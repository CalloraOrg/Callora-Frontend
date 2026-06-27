// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import RouteProgressBar from "./RouteProgressBar";
import {
  startRouteLoading,
  stopRouteLoading,
} from "../hooks/useRouteLoading";

describe("RouteProgressBar", () => {
  afterEach(() => {
    cleanup();
    stopRouteLoading();
  });

  it("renders nothing by default", () => {
    const { container } = render(<RouteProgressBar />);
    expect(container.querySelector(".route-progress-bar")).toBeNull();
  });

  it("appears when loading starts", () => {
    render(<RouteProgressBar />);

    act(() => {
      startRouteLoading();
    });

    const bar = screen.getByRole("progressbar");
    expect(bar).toBeTruthy();
    expect(bar.getAttribute("aria-busy")).toBe("true");
  });

  it("has the active class while loading", () => {
    render(<RouteProgressBar />);

    act(() => {
      startRouteLoading();
    });

    const bar = screen.getByRole("progressbar");
    expect(bar.classList.contains("route-progress-bar--active")).toBe(true);
  });

  it("removes from DOM after loading completes", async () => {
    render(<RouteProgressBar />);

    act(() => {
      startRouteLoading();
    });

    expect(screen.getByRole("progressbar")).toBeTruthy();

    act(() => {
      stopRouteLoading();
    });

    await waitFor(
      () => {
        expect(screen.queryByRole("progressbar")).toBeNull();
      },
      { timeout: 500 },
    );
  });

  it("handles multiple concurrent loads correctly", async () => {
    render(<RouteProgressBar />);

    act(() => {
      startRouteLoading();
      startRouteLoading();
      startRouteLoading();
    });

    expect(screen.getByRole("progressbar")).toBeTruthy();

    act(() => {
      stopRouteLoading();
      stopRouteLoading();
    });

    // Still visible because one more load is active
    expect(screen.getByRole("progressbar")).toBeTruthy();

    act(() => {
      stopRouteLoading();
    });

    await waitFor(
      () => {
        expect(screen.queryByRole("progressbar")).toBeNull();
      },
      { timeout: 500 },
    );
  });
});
