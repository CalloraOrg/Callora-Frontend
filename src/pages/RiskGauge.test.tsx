import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import RiskGaugePage, { setRiskAssessmentOverride } from "./RiskGauge";
import React from "react";

vi.mock("../hooks/useDocumentTitle", () => ({
  default: () => {},
}));

describe("RiskGaugePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const advanceAndFlush = async (ms: number) => {
    await act(async () => {
      vi.advanceTimersByTime(ms);
    });
  };

  it("renders the page header", () => {
    render(<RiskGaugePage />);
    expect(screen.getByText("Risk Assessment")).toBeTruthy();
    expect(screen.getByText("API Risk Profile")).toBeTruthy();
  });

  it("renders empty state when no assessment data is available", () => {
    render(<RiskGaugePage />);
    expect(screen.getByText("No risk data yet")).toBeTruthy();
    expect(screen.getByText("Run assessment")).toBeTruthy();
  });

  it("renders risk-gauge variant empty state with themed illustration", () => {
    const { container } = render(<RiskGaugePage />);
    const emptyState = container.querySelector('[data-testid="empty-state-risk-gauge"]');
    expect(emptyState).toBeTruthy();
    const svg = emptyState?.querySelector("svg");
    expect(svg).toBeTruthy();
  });

  it("shows loading state while assessment is in progress", async () => {
    render(<RiskGaugePage />);
    fireEvent.click(screen.getByText("Run assessment"));
    expect(screen.getByLabelText("Loading risk assessment")).toBeTruthy();
    expect(screen.getByText("Assessing API risk…")).toBeTruthy();
  });

  it("displays assessment results after clicking Run assessment", async () => {
    render(<RiskGaugePage />);
    const runBtn = screen.getByText("Run assessment");
    fireEvent.click(runBtn);
    await advanceAndFlush(1000);
    expect(screen.getByText("Breakdown")).toBeTruthy();
    expect(screen.getByText("Re-assess")).toBeTruthy();
    expect(screen.getByText("Clear results")).toBeTruthy();
  });

  it("shows metric rows after assessment runs", async () => {
    render(<RiskGaugePage />);
    fireEvent.click(screen.getByText("Run assessment"));
    await advanceAndFlush(1000);
    expect(screen.getByText("Reliability")).toBeTruthy();
    expect(screen.getByText("Security")).toBeTruthy();
    expect(screen.getByText("Compliance")).toBeTruthy();
    expect(screen.getByText("Latency")).toBeTruthy();
  });

  it("returns to empty state after clearing results", async () => {
    render(<RiskGaugePage />);
    fireEvent.click(screen.getByText("Run assessment"));
    await advanceAndFlush(1000);
    expect(screen.queryByText("No risk data yet")).toBeNull();
    fireEvent.click(screen.getByText("Clear results"));
    expect(screen.getByText("No risk data yet")).toBeTruthy();
    expect(screen.getByText("Run assessment")).toBeTruthy();
  });

  it("re-runs assessment when Re-assess is clicked", async () => {
    render(<RiskGaugePage />);
    fireEvent.click(screen.getByText("Run assessment"));
    await advanceAndFlush(1000);
    fireEvent.click(screen.getByText("Re-assess"));
    await advanceAndFlush(1000);
    expect(screen.getByText("Breakdown")).toBeTruthy();
  });

  it("renders accessible progress bars for metrics", async () => {
    render(<RiskGaugePage />);
    fireEvent.click(screen.getByText("Run assessment"));
    await advanceAndFlush(1000);
    const progressbars = document.querySelectorAll('[role="progressbar"]');
    expect(progressbars.length).toBe(4);
    progressbars.forEach((bar) => {
      expect(bar.getAttribute("aria-valuemin")).toBe("0");
      expect(bar.getAttribute("aria-valuemax")).toBe("100");
    });
  });

  it("renders gauge SVG with correct ARIA label", async () => {
    render(<RiskGaugePage />);
    fireEvent.click(screen.getByText("Run assessment"));
    await advanceAndFlush(1000);
    const gauge = document.querySelector('[role="img"]');
    expect(gauge).toBeTruthy();
    expect(gauge?.getAttribute("aria-label")).toContain("Risk score");
  });

  it("shows stale warning after evidence expires", async () => {
    render(<RiskGaugePage />);
    fireEvent.click(screen.getByText("Run assessment"));
    await advanceAndFlush(1000);
    expect(screen.getByText("Breakdown")).toBeTruthy();

    await advanceAndFlush(5 * 60 * 1000);

    expect(screen.getByText("Evidence expired — results are stale")).toBeTruthy();
    expect(screen.getByText("Re-assess now")).toBeTruthy();
  });

  it("reassessing clears stale state and loads fresh results", async () => {
    render(<RiskGaugePage />);
    fireEvent.click(screen.getByText("Run assessment"));
    await advanceAndFlush(1000);

    await advanceAndFlush(5 * 60 * 1000);

    expect(screen.getByText("Evidence expired — results are stale")).toBeTruthy();
    fireEvent.click(screen.getByText("Re-assess now"));
    await advanceAndFlush(1000);

    expect(screen.queryByText("Evidence expired — results are stale")).toBeNull();
    expect(screen.getByText("Breakdown")).toBeTruthy();
  });

  it("shows error state when assessment fails and allows retry", async () => {
    setRiskAssessmentOverride(() => Promise.reject(new Error("Assessment service unavailable. Please try again.")));

    render(<RiskGaugePage />);
    fireEvent.click(screen.getByText("Run assessment"));
    await advanceAndFlush(1000);

    expect(screen.getByText("Assessment failed")).toBeTruthy();
    expect(screen.getByText("Retry")).toBeTruthy();

    setRiskAssessmentOverride(null);

    fireEvent.click(screen.getByText("Retry"));
    await advanceAndFlush(1000);
    expect(screen.getByText("Breakdown")).toBeTruthy();
  });

  it("prevents stale responses from overwriting newer state on rapid clicks", async () => {
    render(<RiskGaugePage />);
    const runBtn = screen.getByText("Run assessment");

    fireEvent.click(runBtn);
    fireEvent.click(runBtn);
    fireEvent.click(runBtn);

    await advanceAndFlush(1000);

    const breakdowns = screen.queryAllByText("Breakdown");
    expect(breakdowns.length).toBe(1);
  });

  it("never reports unconfirmed mutations as successful during loading", async () => {
    render(<RiskGaugePage />);
    fireEvent.click(screen.getByText("Run assessment"));

    expect(screen.queryByText("Breakdown")).toBeNull();
    expect(screen.getByLabelText("Loading risk assessment")).toBeTruthy();
  });
});
