// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import HealthTimeline, { type HealthStatus } from "./HealthTimeline";

vi.mock("../hooks/useAccountContext", () => ({
  useAccountContext: () => ({ timezone: "UTC" }),
}));

describe("HealthTimeline", () => {
  it("renders all-operational summary and segments", () => {
    const data: HealthStatus[] = Array(24).fill("operational");
    render(<HealthTimeline data={data} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(24);
    expect(
      screen.getByText("All systems operational in the last 24h"),
    ).toBeTruthy();
    expect(buttons[0].getAttribute("aria-label")).toContain("Operational");
  });

  it("renders mixed degraded and down segments with accessible names, patterns, and summary", () => {
    const data: HealthStatus[] = [
      ...Array(21).fill("operational"),
      "degraded",
      "degraded",
      "down",
    ];
    render(<HealthTimeline data={data} />);

    expect(
      screen.getByText("2 degraded periods, 1 outage in the last 24h"),
    ).toBeTruthy();

    const buttons = screen.getAllByRole("button");
    expect(buttons[21].getAttribute("aria-label")).toContain("Degraded");
    expect(buttons[21].getAttribute("data-status")).toBe("degraded");
    expect(buttons[21].style.backgroundImage).toContain("repeating-linear-gradient");

    expect(buttons[23].getAttribute("aria-label")).toContain("Down (outage)");
    expect(buttons[23].getAttribute("data-status")).toBe("down");
    expect(buttons[23].style.backgroundImage).toContain("repeating-linear-gradient");
  });

  it("renders empty state message when data is empty", () => {
    render(<HealthTimeline data={[]} />);

    expect(screen.getByText("No health data yet")).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("renders loading skeleton when loading is true", () => {
    render(<HealthTimeline loading />);

    const status = screen.getByRole("status", {
      name: "Loading health timeline",
    });
    expect(status.getAttribute("aria-busy")).toBe("true");
  });

  it("renders error state and invokes onRetry when Retry is clicked", () => {
    const onRetry = vi.fn();
    render(
      <HealthTimeline
        error="Failed to load health metrics"
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Failed to load health metrics")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("supports keyboard navigation with ArrowRight, ArrowLeft, Enter, and Space", () => {
    const data: HealthStatus[] = ["operational", "degraded", "down"];
    render(<HealthTimeline data={data} />);

    const buttons = screen.getAllByRole("button");
    buttons[0].focus();
    expect(document.activeElement).toBe(buttons[0]);

    fireEvent.keyDown(buttons[0], { key: "ArrowRight" });
    expect(document.activeElement).toBe(buttons[1]);

    fireEvent.keyDown(buttons[1], { key: "Enter" });
    expect(screen.getByRole("tooltip")).toBeTruthy();
    expect(screen.getByRole("tooltip").textContent).toContain("Degraded");

    fireEvent.keyDown(buttons[1], { key: " " });
    expect(screen.queryByRole("tooltip")).toBeNull();

    fireEvent.keyDown(buttons[1], { key: "ArrowLeft" });
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("handles single-point data cleanly", () => {
    render(<HealthTimeline data={["down"]} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(screen.getByText("1 outage in the last 1h")).toBeTruthy();
    expect(buttons[0].getAttribute("aria-label")).toContain("Down (outage)");
  });

  it("handles more points than typical container width (e.g. 90 buckets)", () => {
    const data: HealthStatus[] = Array(90).fill("operational");
    data[10] = "degraded";
    render(<HealthTimeline data={data} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(90);
    expect(
      screen.getByText("1 degraded period in the last 90h"),
    ).toBeTruthy();
  });
});
