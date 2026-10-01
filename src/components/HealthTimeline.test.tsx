import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HealthTimeline from "./HealthTimeline.tsx";
import { HealthStatus } from "./HealthTimeline.tsx";
import { AccountProvider } from "../hooks/useAccountContext";
import { addAccount, switchAccount, _reset } from "../state/accountStore";

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

/** Short zone name (e.g. "EDT" / "EST") as Intl renders it right now. */
function zoneAbbreviation(timeZone: string): string {
  return (
    new Intl.DateTimeFormat(undefined, { timeZone, timeZoneName: "short" })
      .formatToParts(new Date())
      .find((part) => part.type === "timeZoneName")?.value ?? timeZone
  );
}

describe("HealthTimeline timezone labels", () => {
  beforeEach(() => {
    _reset();
    addAccount({ id: "timeline-ny", label: "New York", apiKey: "test-key", timezone: "America/New_York" });
    switchAccount("timeline-ny");
  });

  afterEach(() => {
    cleanup();
    _reset();
  });

  it("formats timeline hours and shows the account timezone abbreviation", async () => {
    render(<AccountProvider><HealthTimeline /></AccountProvider>);
    // EDT or EST depending on when the suite runs.
    expect(await screen.findByText(`Now (${zoneAbbreviation("America/New_York")})`)).toBeTruthy();
    const expectedCurrentHour = new Intl.DateTimeFormat(undefined, {
      hour: "2-digit", minute: "2-digit", timeZone: "America/New_York",
    }).format(new Date());
    const expectedPreviousHour = new Intl.DateTimeFormat(undefined, {
      hour: "2-digit", minute: "2-digit", timeZone: "America/New_York",
    }).format(new Date(Date.now() - 60 * 60 * 1000));
    expect(screen.getByRole("button", { name: `${expectedCurrentHour}: Operational` })).toBeTruthy();
    expect(screen.getByRole("button", { name: `${expectedPreviousHour}: Operational` })).toBeTruthy();
  });
});

describe("HealthTimeline pointer hover tooltips (issue #1137)", () => {
  const operationalData: HealthStatus[] = Array(24).fill("operational");
  const mixedData: HealthStatus[] = Array(24)
    .fill("operational")
    .map((_, i) => (i === 5 ? "degraded" : i === 10 ? "down" : "operational"));

  /**
   * Renders the timeline and returns the per-bar wrapper elements (which own
   * the mouse/blur handlers) alongside the inner buttons (which own focus).
   */
  function renderTimeline(data: HealthStatus[]) {
    render(<HealthTimeline data={data} />);
    const group = screen.getByRole("group");
    const bars = Array.from(group.children) as HTMLElement[];
    const buttons = screen.getAllByRole("button");
    return { bars, buttons };
  }

  it("shows the hour and status in a polite tooltip on mouseenter", () => {
    const { bars, buttons } = renderTimeline(operationalData);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.mouseEnter(bars[0]);

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveAttribute("aria-live", "polite");
    const [hour] = (buttons[0].getAttribute("aria-label") ?? "").split(": ");
    expect(tooltip).toHaveTextContent(hour);
    expect(tooltip).toHaveTextContent("Operational");
  });

  it("reports the degraded status for a degraded bar", () => {
    const { bars } = renderTimeline(mixedData);

    fireEvent.mouseEnter(bars[5]);

    expect(screen.getByRole("tooltip")).toHaveTextContent("Degraded");
  });

  it("reports the down status for a down bar", () => {
    const { bars } = renderTimeline(mixedData);

    fireEvent.mouseEnter(bars[10]);

    expect(screen.getByRole("tooltip")).toHaveTextContent("Down");
  });

  it("hides the tooltip on mouseleave", () => {
    const { bars } = renderTimeline(operationalData);
    fireEvent.mouseEnter(bars[0]);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.mouseLeave(bars[0]);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows only one tooltip when moving between bars", () => {
    const { bars } = renderTimeline(operationalData);

    fireEvent.mouseEnter(bars[0]);
    fireEvent.mouseLeave(bars[0]);
    fireEvent.mouseEnter(bars[1]);

    expect(screen.getAllByRole("tooltip")).toHaveLength(1);
  });

  it("hides the tooltip when the bar wrapper loses focus (blur)", () => {
    const { bars } = renderTimeline(operationalData);
    fireEvent.mouseEnter(bars[2]);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.blur(bars[2]);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("hides the hover tooltip when ArrowRight moves focus to the next bar", () => {
    const { bars, buttons } = renderTimeline(operationalData);
    buttons[0].focus();
    fireEvent.mouseEnter(bars[0]);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.keyDown(buttons[0], { key: "ArrowRight" });

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(buttons[1]).toHaveFocus();
  });

  it("hides the hover tooltip when ArrowLeft moves focus to the previous bar", () => {
    const { bars, buttons } = renderTimeline(operationalData);
    buttons[5].focus();
    fireEvent.mouseEnter(bars[5]);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.keyDown(buttons[5], { key: "ArrowLeft" });

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(buttons[4]).toHaveFocus();
  });
});
