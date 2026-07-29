// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import LatencyChart from "./LatencyChart";

afterEach(cleanup);

function renderChart() {
  return render(
    <MemoryRouter>
      <LatencyChart />
    </MemoryRouter>
  );
}

describe("LatencyChart Page (#714)", () => {
  it("renders the page title and breadcrumb", () => {
    renderChart();

    expect(screen.getByRole("heading", { name: "Latency" })).toBeTruthy();
    expect(screen.getByText("Dashboard")).toBeTruthy();
    expect(screen.getByText("Last 24 hours")).toBeTruthy();
  });

  it("renders the HelpPopover with an accessible label explaining P95 latency", async () => {
    renderChart();

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

  it("renders stat cards for min, avg, P95, and max", () => {
    renderChart();

    expect(screen.getByText("Min")).toBeTruthy();
    expect(screen.getByText("Avg")).toBeTruthy();
    expect(screen.getByText("P95")).toBeTruthy();
    expect(screen.getByText("Max")).toBeTruthy();
  });

  it("renders the correct latency values in stat cards", () => {
    renderChart();

    const minValue = screen.getByText("88 ms");
    const maxValue = screen.getByText("210 ms");
    const avgValue = screen.getByText("152 ms");
    const p95Value = screen.getByText("200 ms");
    expect(minValue).toBeTruthy();
    expect(maxValue).toBeTruthy();
    expect(avgValue).toBeTruthy();
    expect(p95Value).toBeTruthy();
  });

  it("renders the latency chart bars with accessible labels", () => {
    renderChart();

    const bars = screen.getAllByRole("img", { name: /ms/ });
    expect(bars.length).toBeGreaterThan(0);
  });

  it("renders the chart caption for screen reader context", () => {
    renderChart();

    expect(screen.getByText(/Bars represent sampled response times/)).toBeTruthy();
  });

  it("dismisses the HelpPopover tooltip on Escape", async () => {
    renderChart();

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
});
