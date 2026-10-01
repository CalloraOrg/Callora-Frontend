import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HealthTimeline from "./HealthTimeline.tsx";
import { HealthStatus } from "./HealthTimeline.tsx";

describe("HealthTimeline", () => {
  const FAKE_TIME = new Date("2026-09-30T12:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FAKE_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders exactly 24 buttons even for short input and missing slots are Operational", () => {
    const input: HealthStatus[] = ["down", "degraded", "operational"];
    render(<HealthTimeline data={input} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(24);

    // Using fake timers, at 12:00:00 (midday):
    // hour index 0 -> 23 hours ago -> 13:00 (previous day)
    // Actually, local time is used (`toLocaleTimeString` without timezone in the component).
    // Let's just check the status parts.
    expect(buttons[0]).toHaveAttribute("aria-label", expect.stringContaining("Down"));
    expect(buttons[1]).toHaveAttribute("aria-label", expect.stringContaining("Degraded"));
    expect(buttons[2]).toHaveAttribute("aria-label", expect.stringContaining("Operational"));
    
    // Check that remaining slots are Operational
    for (let i = 3; i < 24; i++) {
      expect(buttons[i]).toHaveAttribute("aria-label", expect.stringContaining("Operational"));
    }
  });

  it("ArrowRight on the last button keeps focus, ArrowLeft on first keeps focus", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<HealthTimeline data={[]} />);
    
    const buttons = screen.getAllByRole("button");
    
    // Focus the first button
    buttons[0].focus();
    expect(buttons[0]).toHaveFocus();

    // ArrowLeft on the first button shouldn't change focus
    fireEvent.keyDown(buttons[0], { key: "ArrowLeft" });
    expect(buttons[0]).toHaveFocus();

    // ArrowRight moves focus to the second button
    fireEvent.keyDown(buttons[0], { key: "ArrowRight" });
    expect(buttons[1]).toHaveFocus();

    // Focus the last button
    buttons[23].focus();
    expect(buttons[23]).toHaveFocus();

    // ArrowRight on the last button shouldn't change focus (stays on 23)
    fireEvent.keyDown(buttons[23], { key: "ArrowRight" });
    expect(buttons[23]).toHaveFocus();
  });

  it("Enter toggles a role=tooltip element", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<HealthTimeline data={[]} />);

    const buttons = screen.getAllByRole("button");
    
    // Ensure no tooltip initially
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    // Press Enter to show tooltip
    fireEvent.keyDown(buttons[5], { key: "Enter" });
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent("Operational"); // Check content

    // Press Enter again to hide tooltip
    fireEvent.keyDown(buttons[5], { key: "Enter" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("Space toggles tooltip similarly", () => {
    render(<HealthTimeline data={[]} />);
    const buttons = screen.getAllByRole("button");
    
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.keyDown(buttons[10], { key: " " });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.keyDown(buttons[10], { key: " " });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("Hour labels are deterministic under fake timers", () => {
    render(<HealthTimeline data={[]} />);
    const buttons = screen.getAllByRole("button");
    
    // At 12:00:00 (local), index 23 (Now) should be 12:00 PM or 12:00 based on locale, but let's test specific logic
    // Using string matching to ensure the fake timer is applied. 
    // The component uses getHourLabel which calls toLocaleTimeString with { hour: '2-digit', minute: '2-digit' }
    // which results in time formats like '01:00 PM' or '13:00'.
    
    const lastLabel = buttons[23].getAttribute("aria-label") || "";
    // Because toLocaleTimeString depends on environment locale, we just check if it contains expected minute: "00"
    // and that fake timers made it stable.
    expect(lastLabel).toMatch(/:00/);
    
    // Alternatively, we can check relative difference. 
    // index 23 is current time, index 22 is 1 hour ago.
    const oneHourAgo = new Date(FAKE_TIME);
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    const expectedOneHourAgoLabel = oneHourAgo.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    expect(buttons[22]).toHaveAttribute("aria-label", `${expectedOneHourAgoLabel}: Operational`);
  });
});
