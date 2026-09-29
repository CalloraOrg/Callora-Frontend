// @vitest-environment jsdom
import { vi } from "vitest";
vi.mock("../config/constants", () => ({ LOADING_DELAY_MS: 100 }));

import { cleanup, fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import LatencyChart, { useLatencyData } from "./LatencyChart";
import { FetchTrackerProvider } from "../hooks/useFetchTracker";
import { renderHook } from "@testing-library/react";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <FetchTrackerProvider>
    <MemoryRouter>
      {children}
    </MemoryRouter>
  </FetchTrackerProvider>
);

async function renderChartAndWait() {
  const rendered = render(<LatencyChart />, { wrapper: Wrapper });
  await waitFor(() => {
    expect(screen.queryByText(/Loading latency data/)).toBeNull();
  });
  return rendered;
}

describe("LatencyChart Component UI (#997)", () => {
  // --- Original tests restored and adapted for async data load ---

  it("renders the page title and breadcrumb", async () => {
    await renderChartAndWait();
    expect(screen.getByRole("heading", { name: "Latency" })).toBeTruthy();
    expect(screen.getByText("Dashboard")).toBeTruthy();
    expect(screen.getByText("Last 24 hours")).toBeTruthy();
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

  it("renders stat cards for min, avg, P95, and max", async () => {
    await renderChartAndWait();
    expect(screen.getByText("Min")).toBeTruthy();
    expect(screen.getByText("Avg")).toBeTruthy();
    expect(screen.getByText("P95")).toBeTruthy();
    expect(screen.getByText("Max")).toBeTruthy();
  });

  it("renders the correct latency values in stat cards", async () => {
    await renderChartAndWait();
    const minValue = screen.getByText("88 ms");
    const maxValue = screen.getByText("210 ms");
    const avgValue = screen.getByText("152 ms");
    const p95Value = screen.getByText("200 ms");
    expect(minValue).toBeTruthy();
    expect(maxValue).toBeTruthy();
    expect(avgValue).toBeTruthy();
    expect(p95Value).toBeTruthy();
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

  // --- New state tests added for #997 ---

  it("renders the loading state initially", () => {
    render(<LatencyChart />, { wrapper: Wrapper });
    expect(screen.getByText(/Loading latency data/)).toBeTruthy();
  });

  it("renders the stale state visually when account changes", async () => {
    const { rerender } = await renderChartAndWait();
    rerender(
      
        <LatencyChart accountId="acc-2" />
      
    );
    expect(screen.getByText(/Updating chart data/)).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByText(/Updating chart data/)).toBeNull();
    });
  });
});

describe("useLatencyData hook state transitions (#997)", () => {
  it("handles empty state", async () => {
    const { result } = renderHook(() => useLatencyData("empty"), { wrapper: Wrapper });
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.data.length).toBe(0);
    expect(result.current.isError).toBe(false);
  });

  it("handles error state and retry", async () => {
    const { result } = renderHook(() => useLatencyData("error"), { wrapper: Wrapper });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.isError).toBe(true);

    act(() => {
      result.current.retry();
    });

    expect(result.current.isLoading).toBe(true);
  });
});

describe("useLatencyData race condition guard (#997)", () => {
  it("ignores older requests that resolve after newer ones due to generation counter", async () => {
    vi.useFakeTimers();

    const { result, rerender } = renderHook(({ accountId }) => useLatencyData(accountId), {
      initialProps: { accountId: "acc-1" },
      wrapper: Wrapper,
    });

    act(() => vi.advanceTimersByTime(10));
    rerender({ accountId: "error" });
    
    act(() => vi.advanceTimersByTime(10));
    rerender({ accountId: "acc-2" });
    
    act(() => vi.runAllTimers());
    
    vi.useRealTimers();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data.length).toBeGreaterThan(0);
    expect(result.current.isError).toBe(false);
  });
});
