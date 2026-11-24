// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EmbedApi, { parseEmbedTheme } from "./EmbedApi";
import type { APIItem } from "../data/mockApis";
import * as catalogApi from "../api/catalogApi";

const SAMPLE_API: APIItem = {
  id: "weather-api-123",
  name: "Global Weather API",
  provider: { name: "Acme Weather" },
  status: "operational",
  description: "Real-time forecasts.",
  pricePerRequest: 0.0025,
  rating: 4.8,
};

describe("parseEmbedTheme", () => {
  it("accepts light, dark, and system", () => {
    expect(parseEmbedTheme("?theme=light")).toBe("light");
    expect(parseEmbedTheme("?theme=dark")).toBe("dark");
    expect(parseEmbedTheme("?theme=system")).toBe("system");
  });

  it("falls back to system for missing or invalid values", () => {
    expect(parseEmbedTheme("")).toBe("system");
    expect(parseEmbedTheme("?theme=neon")).toBe("system");
    expect(parseEmbedTheme("?foo=bar")).toBe("system");
  });
});

describe("EmbedApi", () => {
  let postMessageSpy: ReturnType<typeof vi.spyOn>;
  const originalResizeObserver = globalThis.ResizeObserver;

  beforeEach(() => {
    postMessageSpy = vi
      .spyOn(window.parent, "postMessage")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    if (originalResizeObserver === undefined) {
      delete (globalThis as Record<string, unknown>).ResizeObserver;
    } else {
      globalThis.ResizeObserver = originalResizeObserver;
    }
  });

  it("renders loading state then the compact API card", async () => {
    vi.spyOn(catalogApi, "fetchApiDetail").mockResolvedValue({
      status: "ready",
      kind: "ready",
      api: SAMPLE_API,
    });

    render(<EmbedApi apiId="weather-api-123" />);

    expect(screen.getByRole("status", { name: "Loading API" })).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText("Global Weather API")).toBeTruthy();
    });

    expect(screen.getByText("Acme Weather")).toBeTruthy();
    expect(screen.getByText("Operational")).toBeTruthy();
    expect(screen.getByText("$0.0025 / req")).toBeTruthy();
    expect(screen.getByText("★ 4.8")).toBeTruthy();

    const link = screen.getByRole("link", { name: "View on Callora" });
    expect(link.getAttribute("href")).toBe("/details/weather-api-123");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("renders a not-found card for an unknown id", async () => {
    vi.spyOn(catalogApi, "fetchApiDetail").mockResolvedValue({
      status: "not-found",
      kind: "not-found",
    });

    render(<EmbedApi apiId="unknown-id" />);

    await waitFor(() => {
      expect(screen.getByText("API not found")).toBeTruthy();
    });
    expect(screen.getByText(/unknown-id/)).toBeTruthy();
  });

  it("renders a not-found card without fetching when id is missing", () => {
    const fetchSpy = vi.spyOn(catalogApi, "fetchApiDetail");

    render(<EmbedApi apiId="   " />);

    expect(screen.getByText("API not found")).toBeTruthy();
    expect(screen.getByText("No API identifier was provided.")).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("renders an error card on fetch failure and supports retry", async () => {
    const fetchSpy = vi
      .spyOn(catalogApi, "fetchApiDetail")
      .mockRejectedValueOnce(new Error("Network down"))
      .mockResolvedValueOnce({
        status: "ready",
        kind: "ready",
        api: SAMPLE_API,
      });

    render(<EmbedApi apiId="weather-api-123" />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });
    expect(screen.getByText("Unable to load API")).toBeTruthy();
    expect(screen.getByText("Network down")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(screen.getByText("Global Weather API")).toBeTruthy();
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("escapes special characters in id and never injects HTML", async () => {
    const xssId = '<img src=x onerror="alert(1)">';
    vi.spyOn(catalogApi, "fetchApiDetail").mockResolvedValue({
      status: "not-found",
      kind: "not-found",
    });

    const { container } = render(<EmbedApi apiId={xssId} />);

    await waitFor(() => {
      expect(screen.getByText("API not found")).toBeTruthy();
    });
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain(xssId);
  });

  it("posts content height with ResizeObserver and handles missing ResizeObserver", async () => {
    vi.spyOn(catalogApi, "fetchApiDetail").mockResolvedValue({
      status: "ready",
      kind: "ready",
      api: SAMPLE_API,
    });

    // 1. With ResizeObserver absent
    delete (globalThis as Record<string, unknown>).ResizeObserver;
    const { unmount } = render(<EmbedApi apiId="weather-api-123" />);

    await waitFor(() => {
      expect(screen.getByText("Global Weather API")).toBeTruthy();
    });
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "callora-embed-height", height: expect.any(Number) }),
      "*",
    );
    unmount();

    // 2. With ResizeObserver stubbed
    postMessageSpy.mockClear();
    let resizeCallback: ResizeObserverCallback | undefined;
    const observe = vi.fn();
    const disconnect = vi.fn();
    class MockResizeObserver {
      constructor(cb: ResizeObserverCallback) {
        resizeCallback = cb;
      }
      observe = observe;
      unobserve = vi.fn();
      disconnect = disconnect;
    }
    globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

    const { unmount: unmount2 } = render(<EmbedApi apiId="weather-api-123" />);

    await waitFor(() => {
      expect(screen.getByText("Global Weather API")).toBeTruthy();
    });
    expect(observe).toHaveBeenCalled();

    postMessageSpy.mockClear();
    resizeCallback?.([], {} as ResizeObserver);
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "callora-embed-height", height: expect.any(Number) }),
      "*",
    );

    unmount2();
    expect(disconnect).toHaveBeenCalled();
  });
});
