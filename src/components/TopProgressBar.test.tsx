// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import TopProgressBar from "./TopProgressBar";
import {
  FetchTrackerProvider,
  useFetchTracker,
} from "../hooks/useFetchTracker";
import type { ReactNode } from "react";

let trackFetch: <T>(p: Promise<T>) => Promise<T>;

function TestHarness({ children }: { children: ReactNode }) {
  const hook = useFetchTracker();
  trackFetch = hook.trackFetch;
  return <>{children}</>;
}

function renderWithProvider() {
  return render(
    <FetchTrackerProvider>
      <TestHarness>
        <TopProgressBar />
      </TestHarness>
    </FetchTrackerProvider>,
  );
}

describe("TopProgressBar", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders nothing by default", () => {
    const { container } = renderWithProvider();
    expect(container.querySelector(".top-progress-bar")).toBeNull();
  });

  it("appears when a fetch starts", async () => {
    renderWithProvider();

    let resolvePromise!: () => void;
    await act(async () => {
      trackFetch(new Promise<void>((resolve) => {
        resolvePromise = resolve;
      }));
    });

    const bar = screen.getByRole("progressbar");
    expect(bar).toBeTruthy();
    expect(bar.getAttribute("aria-busy")).toBe("true");

    await act(async () => {
      resolvePromise();
    });
  });

  it("has the active class while fetching", async () => {
    renderWithProvider();

    let resolvePromise!: () => void;
    await act(async () => {
      trackFetch(new Promise<void>((resolve) => {
        resolvePromise = resolve;
      }));
    });

    const bar = screen.getByRole("progressbar");
    expect(bar.classList.contains("top-progress-bar--active")).toBe(true);

    await act(async () => {
      resolvePromise();
    });
  });

  it("removes from DOM after fetch completes", async () => {
    renderWithProvider();

    let resolvePromise!: () => void;
    await act(async () => {
      trackFetch(new Promise<void>((resolve) => {
        resolvePromise = resolve;
      }));
    });

    expect(screen.getByRole("progressbar")).toBeTruthy();

    await act(async () => {
      resolvePromise();
    });

    await waitFor(
      () => {
        expect(screen.queryByRole("progressbar")).toBeNull();
      },
      { timeout: 500 },
    );
  });

  it("handles multiple concurrent fetches correctly", async () => {
    renderWithProvider();

    let resolve1!: () => void;
    let resolve2!: () => void;
    let resolve3!: () => void;

    await act(async () => {
      trackFetch(new Promise<void>((resolve) => { resolve1 = resolve; }));
      trackFetch(new Promise<void>((resolve) => { resolve2 = resolve; }));
      trackFetch(new Promise<void>((resolve) => { resolve3 = resolve; }));
    });

    expect(screen.getByRole("progressbar")).toBeTruthy();

    await act(async () => {
      resolve1();
      resolve2();
    });

    await waitFor(() => {
      expect(screen.getByRole("progressbar")).toBeTruthy();
    });

    await act(async () => {
      resolve3();
    });

    await waitFor(
      () => {
        expect(screen.queryByRole("progressbar")).toBeNull();
      },
      { timeout: 500 },
    );
  });
});
