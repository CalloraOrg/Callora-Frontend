import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import RiskGaugePage from "./RiskGauge";
import React from "react";

vi.mock("../hooks/useDocumentTitle", () => ({
  default: () => {},
}));

describe("RiskGaugePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it("displays assessment results after clicking Run assessment", () => {
    render(<RiskGaugePage />);
    const runBtn = screen.getByText("Run assessment");
    fireEvent.click(runBtn);
    expect(screen.getByText("Breakdown")).toBeTruthy();
    expect(screen.getByText("Re-assess")).toBeTruthy();
    expect(screen.getByText("Clear results")).toBeTruthy();
  });

  it("shows metric rows after assessment runs", () => {
    render(<RiskGaugePage />);
    fireEvent.click(screen.getByText("Run assessment"));
    expect(screen.getByText("Reliability")).toBeTruthy();
    expect(screen.getByText("Security")).toBeTruthy();
    expect(screen.getByText("Compliance")).toBeTruthy();
    expect(screen.getByText("Latency")).toBeTruthy();
  });

  it("returns to empty state after clearing results", () => {
    render(<RiskGaugePage />);
    fireEvent.click(screen.getByText("Run assessment"));
    expect(screen.queryByText("No risk data yet")).toBeNull();
    fireEvent.click(screen.getByText("Clear results"));
    expect(screen.getByText("No risk data yet")).toBeTruthy();
    expect(screen.getByText("Run assessment")).toBeTruthy();
  });

  it("re-runs assessment when Re-assess is clicked", () => {
    render(<RiskGaugePage />);
    fireEvent.click(screen.getByText("Run assessment"));
    fireEvent.click(screen.getByText("Re-assess"));
    // Should still show results after re-assessment
    expect(screen.getByText("Breakdown")).toBeTruthy();
  });

  it("renders accessible progress bars for metrics", () => {
    render(<RiskGaugePage />);
    fireEvent.click(screen.getByText("Run assessment"));
    const progressbars = document.querySelectorAll('[role="progressbar"]');
    expect(progressbars.length).toBe(4);
    progressbars.forEach((bar) => {
      expect(bar.getAttribute("aria-valuemin")).toBe("0");
      expect(bar.getAttribute("aria-valuemax")).toBe("100");
    });
  });

  it("renders gauge SVG with correct ARIA label", () => {
    render(<RiskGaugePage />);
    fireEvent.click(screen.getByText("Run assessment"));
    const gauge = document.querySelector('[role="img"]');
    expect(gauge).toBeTruthy();
    expect(gauge?.getAttribute("aria-label")).toContain("Risk score");
  });
});
