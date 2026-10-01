// @vitest-environment jsdom

import React, { act } from "react";
import ReactDOM from "react-dom/client";
import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { renderRoute, type RouteRenderTarget } from "./renderRoute";
import MarketplacePage from "./pages/MarketplacePage";
import MarketplacePageSkeleton from "./pages/MarketplacePage.skeleton";
import ApiDetailPage from "./pages/ApiDetailPage";
import ApiDetailPageSkeleton from "./pages/ApiDetailPage.skeleton";
import { startRouteLoading, stopRouteLoading } from "./hooks/useRouteLoading";
import { LOADING_DELAY_MS } from "./config/constants";

// The progress bar reacts to window events. Stub the dispatchers so the route
// branches can be observed without unrelated state updates, while still
// asserting that a branch never leaves the progress bar spinning.
vi.mock("./hooks/useRouteLoading", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./hooks/useRouteLoading")>();
  return {
    ...actual,
    startRouteLoading: vi.fn(),
    stopRouteLoading: vi.fn(),
  };
});

type MountedRoute = {
  /** Stands in for the React root `main.tsx` creates. */
  target: RouteRenderTarget;
  /** Every element renderRoute handed to the root, in order. */
  renders: React.ReactElement[];
  container: HTMLDivElement;
  unmount: () => void;
};

/**
 * Records what the entry router renders (so the skeleton -> page order is
 * observable) and mounts it (so assertions can check what reaches the DOM).
 */
function createRouteRoot(): MountedRoute {
  const container = document.createElement("div");
  document.body.appendChild(container);

  const reactRoot = ReactDOM.createRoot(container);
  const renders: React.ReactElement[] = [];

  return {
    container,
    renders,
    target: {
      render(children) {
        renders.push(children as React.ReactElement);
        act(() => reactRoot.render(children));
      },
    },
    unmount() {
      act(() => reactRoot.unmount());
      container.remove();
    },
  };
}

/** Depth-first search for a component in a recorded element tree. */
function findRenderedComponent(
  node: React.ReactNode,
  type: unknown,
): React.ReactElement | null {
  if (!React.isValidElement(node)) return null;
  if (node.type === type) return node;

  const children = (node.props as { children?: React.ReactNode }).children;
  for (const child of React.Children.toArray(children)) {
    const found = findRenderedComponent(child, type);
    if (found) return found;
  }
  return null;
}

describe("renderRoute entry branches", () => {
  const mounted: MountedRoute[] = [];

  function mountRoute(): MountedRoute {
    const route = createRouteRoot();
    mounted.push(route);
    return route;
  }

  function settleLoadingDelay() {
    act(() => {
      vi.advanceTimersByTime(LOADING_DELAY_MS);
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, "", "/");
  });

  afterEach(() => {
    while (mounted.length > 0) {
      mounted.pop()?.unmount();
    }
    vi.useRealTimers();
    window.history.pushState({}, "", "/");
  });

  it("renders the marketplace skeleton before the marketplace page", async () => {
    vi.useFakeTimers();
    window.history.pushState({}, "", "/marketplace");
    const { target, renders, container } = mountRoute();

    const pending = renderRoute(target, "/marketplace");

    expect(renders).toHaveLength(1);
    expect(
      findRenderedComponent(renders[0], MarketplacePageSkeleton),
    ).not.toBeNull();
    expect(findRenderedComponent(renders[0], MarketplacePage)).toBeNull();
    expect(
      container.querySelector('[aria-label="Marketplace loading shell"]'),
    ).not.toBeNull();
    // Still loading while the chunk is in flight.
    expect(stopRouteLoading).not.toHaveBeenCalled();

    await act(async () => {
      await pending;
    });

    expect(renders).toHaveLength(2);
    expect(findRenderedComponent(renders[1], MarketplacePage)).not.toBeNull();
    expect(stopRouteLoading).toHaveBeenCalledTimes(1);

    // The lazy chunk really delivered the page: once its own loading delay
    // elapses the shell is replaced by the interactive marketplace.
    settleLoadingDelay();
    expect(container.querySelector(".marketplace-search input")).not.toBeNull();
  });

  it("renders the api detail skeleton before ApiDetailPage", async () => {
    vi.useFakeTimers();
    window.history.pushState({}, "", "/details/weather-001");
    const { target, renders, container } = mountRoute();

    const pending = renderRoute(target, "/details/weather-001");

    expect(renders).toHaveLength(1);
    expect(
      findRenderedComponent(renders[0], ApiDetailPageSkeleton),
    ).not.toBeNull();
    expect(findRenderedComponent(renders[0], ApiDetailPage)).toBeNull();
    expect(
      container.querySelector('[aria-label="API detail loading shell"]'),
    ).not.toBeNull();
    expect(stopRouteLoading).not.toHaveBeenCalled();

    await act(async () => {
      await pending;
    });

    expect(renders).toHaveLength(2);
    const detailPage = findRenderedComponent(renders[1], ApiDetailPage);
    expect(detailPage).not.toBeNull();
    expect(typeof detailPage?.props.onBack).toBe("function");
    expect(stopRouteLoading).toHaveBeenCalledTimes(1);

    settleLoadingDelay();
    expect(
      screen.getByRole("heading", { name: "WeatherSim API" }),
    ).toBeInTheDocument();
  });

  it("routes back to the marketplace when the detail page navigates back", async () => {
    vi.useFakeTimers();
    window.history.pushState({}, "", "/details/weather-001");
    const { target, renders } = mountRoute();

    const pending = renderRoute(target, "/details/weather-001");
    await act(async () => {
      await pending;
    });
    settleLoadingDelay();

    await act(async () => {
      screen.getByRole("button", { name: "Back" }).click();
    });
    // The re-route imports the marketplace chunk asynchronously. Only the
    // render sequence is asserted: the entry router mutates history directly
    // instead of going through the router's own navigation.
    await act(async () => {});
    expect(renders).toHaveLength(4);

    expect(
      findRenderedComponent(renders[2], MarketplacePageSkeleton),
    ).not.toBeNull();
    expect(findRenderedComponent(renders[3], MarketplacePage)).not.toBeNull();
  });

  it("renders App for paths it does not own", async () => {
    window.history.pushState({}, "", "/definitely-not-a-route");
    const { target, renders } = mountRoute();

    await act(async () => {
      await renderRoute(target, "/definitely-not-a-route");
    });

    expect(renders).toHaveLength(1);
    expect(findRenderedComponent(renders[0], App)).not.toBeNull();
    expect(
      screen.getByRole("heading", { name: "Page Not Found" }),
    ).toBeInTheDocument();
  });

  // Declared last: resetting the module registry would hand any later dynamic
  // import in this file a second copy of the route modules.
  it("is importable without side effects", async () => {
    const mountPoint = document.createElement("div");
    mountPoint.id = "root";
    document.body.appendChild(mountPoint);
    window.history.pushState({}, "", "/marketplace");

    vi.resetModules();
    const { renderRoute: freshRenderRoute } = await import("./renderRoute");

    expect(typeof freshRenderRoute).toBe("function");
    expect(mountPoint.childElementCount).toBe(0);
    expect(document.querySelector(".marketplace-page")).toBeNull();

    mountPoint.remove();
  });
});
