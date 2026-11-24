// @vitest-environment jsdom
import { vi, afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, act, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LatencyChart, { useLatencyData } from "./LatencyChart";
import { FetchTrackerProvider } from "../hooks/useFetchTracker";
import * as latencyApi from "../api/latencyApi";
import type { LatencySeriesResponse } from "../api/latencyApi";

vi.mock("../api/latencyApi", async () => {
  const actual = await vi.importActual<typeof import("../api/latencyApi")>("../api/latencyApi");
  return {
    ...actual,
    fetchLatencySeries: vi.fn(),
    isLatencyDemoMode: vi.fn(),
  };
});

const SAMPLE_POINTS = [
  { label: "00:00", value: 88, timestamp: new Date("2026-09-01T00:00:00Z") },
  { label: "06:00", value: 150, timestamp: new Date("2026-09-01T06:00:00Z") },
  { label: "12:00", value: 200, timestamp: new Date("2026-09-01T12:00:00Z") },
  { label: "18:00", value: 210, timestamp: new Date("2026-09-01T18:00:00Z") },
];

function createWrapper(initialEntry = "/latency-chart?api=weather-api") {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <FetchTrackerProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          {children}
        </MemoryRouter>
      </FetchTrackerProvider>
    );
  };
}

beforeEach(() => {
  vi.mocked(latencyApi.isLatencyDemoMode).mockReturnValue(false);
  vi.mocked(latencyApi.fetchLatencySeries).mockResolvedValue({
    points: SAMPLE_POINTS,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function renderChartAndWait(initialEntry = "/latency-chart?api=weather-api") {
  const rendered = render(<LatencyChart />, { wrapper: createWrapper(initialEntry) });
  await waitFor(() => {
    expect(screen.queryByText(/Loading latency data/)).toBeNull();
  });
  return rendered;
}

describe("LatencyChart Component UI", () => {
  it("renders the page title, breadcrumb, and fetches using the ?api= query param", async () => {
    await renderChartAndWait("/latency-chart?api=weather-api");
    expect(screen.getByRole("heading", { name: "Latency" })).toBeTruthy();
    expect(screen.getByText("Dashboard")).toBeTruthy();
    expect(screen.getByText("Last 24 hours")).toBeTruthy();
    expect(latencyApi.fetchLatencySeries).toHaveBeenCalledWith(
      expect.objectContaining({ apiId: "weather-api", range: "24h" }),
    );
  });

  it("renders an empty state when no API id is selected and backend is configured", async () => {
    render(<LatencyChart />, { wrapper: createWrapper("/latency-chart") });
    expect(screen.getByText("No API Selected")).toBeTruthy();
    expect(latencyApi.fetchLatencySeries).not.toHaveBeenCalled();
  });

  it("renders clearly labelled sample data when API_BASE is empty (demo mode)", () => {
    vi.mocked(latencyApi.isLatencyDemoMode).mockReturnValue(true);
    render(<LatencyChart />, { wrapper: createWrapper("/latency-chart") });
    expect(screen.getByText("Sample data")).toBeTruthy();
    expect(screen.getByText("88 ms")).toBeTruthy();
    expect(latencyApi.fetchLatencySeries).not.toHaveBeenCalled();
  });

  it("renders the HelpPopover with an accessible label explaining P95 latency", async () => {
    await renderChartAndWait();
    const helpBtn = screen.getByRole("button", { name: "Help: What is P95 latency?" });
    expect(helpBtn).toBeTruthy();

    fireEvent.focus(helpBtn);

    await waitFor(() => {
      const tooltip = screen.getByRole("tooltip");
      expect(tooltip).toBeTruthy();
      expect(tooltip).toHaveTextContent("P95 Latency");
      expect(tooltip).toHaveTextContent("95th percentile response time");
    });
  });

  it("renders computed stat cards and prefers server-provided p95 when present", async () => {
    vi.mocked(latencyApi.fetchLatencySeries).mockResolvedValueOnce({
      points: SAMPLE_POINTS,
      p95: 195,
    });

    await renderChartAndWait();
    expect(screen.getByText("Min")).toBeTruthy();
    expect(screen.getByText("Avg")).toBeTruthy();
    expect(screen.getByText("P95")).toBeTruthy();
    expect(screen.getByText("Max")).toBeTruthy();

    expect(screen.getByText("88 ms")).toBeTruthy();
    expect(screen.getByText("162 ms")).toBeTruthy();
    expect(screen.getByText("195 ms")).toBeTruthy();
    expect(screen.getByText("210 ms")).toBeTruthy();
  });

  it("renders a single-point series cleanly", async () => {
    vi.mocked(latencyApi.fetchLatencySeries).mockResolvedValueOnce({
      points: [{ label: "Now", value: 120, timestamp: new Date("2026-09-01T12:00:00Z") }],
    });

    await renderChartAndWait();
    const bars = screen.getAllByRole("img", { name: /Now: 120 ms/ });
    expect(bars).toHaveLength(1);
  });

  it("renders the latency chart bars with accessible labels", async () => {
    await renderChartAndWait();
    const bars = screen.getAllByRole("img", { name: /ms/ });
    expect(bars.length).toBeGreaterThan(0);
  });

  it("renders the chart caption for screen reader context", async () => {
    await renderChartAndWait();
    expect(screen.getByText(/Bars represent sampled response times/)).toBeTruthy();
  });

  it("dismisses the HelpPopover tooltip on Escape", async () => {
    await renderChartAndWait();

    const helpBtn = screen.getByRole("button", { name: "Help: What is P95 latency?" });
    fireEvent.focus(helpBtn);

    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeTruthy();
    });

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).toBeNull();
    });
  });

  it("renders the loading state initially while fetch is pending", () => {
    vi.mocked(latencyApi.fetchLatencySeries).mockImplementation(
      () => new Promise(() => {}),
    );
    render(<LatencyChart />, { wrapper: createWrapper() });
    expect(screen.getByText(/Loading latency data/)).toBeTruthy();
  });

  it("renders the stale state visually when account/api changes", async () => {
    let resolveSecond!: (val: LatencySeriesResponse) => void;
    vi.mocked(latencyApi.fetchLatencySeries)
      .mockResolvedValueOnce({ points: SAMPLE_POINTS })
      .mockImplementationOnce(
        () =>
          new Promise<LatencySeriesResponse>((resolve) => {
            resolveSecond = resolve;
          }),
      );

    const { rerender } = render(<LatencyChart accountId="acc-1" />, {
      wrapper: createWrapper("/latency-chart"),
    });

    await waitFor(() => {
      expect(screen.queryByText(/Loading latency data/)).toBeNull();
    });

    rerender(<LatencyChart accountId="acc-2" />);
    expect(screen.getByText(/Updating chart data/)).toBeTruthy();

    await act(async () => {
      resolveSecond({ points: SAMPLE_POINTS });
    });

    await waitFor(() => {
      expect(screen.queryByText(/Updating chart data/)).toBeNull();
    });
  });
});

describe("useLatencyData hook state transitions", () => {
  it("handles empty series", async () => {
    vi.mocked(latencyApi.fetchLatencySeries).mockResolvedValueOnce({ points: [] });

    const { result } = renderHook(() => useLatencyData("empty-api"), {
      wrapper: createWrapper(),
    });
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.data).toHaveLength(0);
    expect(result.current.isError).toBe(false);
  });

  it("handles error state and retry", async () => {
    vi.mocked(latencyApi.fetchLatencySeries)
      .mockRejectedValueOnce(new latencyApi.LatencyFetchError("Server error", 500, "HTTP_ERROR"))
      .mockResolvedValueOnce({ points: SAMPLE_POINTS });

    const { result } = renderHook(() => useLatencyData("failing-api"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.isError).toBe(true);

    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isError).toBe(false);
    });
    expect(result.current.data).toHaveLength(SAMPLE_POINTS.length);
  });

  it("aborts in-flight request on unmount without updating state", async () => {
    let capturedSignal: AbortSignal | undefined;
    let resolveFetch!: (val: LatencySeriesResponse) => void;

    vi.mocked(latencyApi.fetchLatencySeries).mockImplementation(({ signal }) => {
      capturedSignal = signal;
      return new Promise<LatencySeriesResponse>((resolve) => {
        resolveFetch = resolve;
      });
    });

    const { unmount } = renderHook(() => useLatencyData("api-1"), {
      wrapper: createWrapper(),
    });

    expect(capturedSignal?.aborted).toBe(false);
    unmount();
    expect(capturedSignal?.aborted).toBe(true);

    // Resolving after unmount should not throw or warn
    await act(async () => {
      resolveFetch({ points: SAMPLE_POINTS });
    });
  });
});

describe("useLatencyData race condition guard", () => {
  it("ignores older out-of-order responses when apiId changes", async () => {
    let resolveFirst!: (val: LatencySeriesResponse) => void;
    let resolveSecond!: (val: LatencySeriesResponse) => void;

    vi.mocked(latencyApi.fetchLatencySeries)
      .mockImplementationOnce(
        () =>
          new Promise<LatencySeriesResponse>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<LatencySeriesResponse>((resolve) => {
            resolveSecond = resolve;
          }),
      );

    const { result, rerender } = renderHook(({ apiId }) => useLatencyData(apiId), {
      initialProps: { apiId: "api-1" },
      wrapper: createWrapper(),
    });

    rerender({ apiId: "api-2" });

    // Resolve newer request first
    await act(async () => {
      resolveSecond({
        points: [{ label: "New", value: 42, timestamp: new Date("2026-09-01T12:00:00Z") }],
      });
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.data[0]?.value).toBe(42);

    // Now resolve stale older request — must be ignored
    await act(async () => {
      resolveFirst({
        points: [{ label: "Old", value: 999, timestamp: new Date("2026-09-01T00:00:00Z") }],
      });
    });

    expect(result.current.data[0]?.value).toBe(42);
    expect(result.current.isError).toBe(false);
  });
});
