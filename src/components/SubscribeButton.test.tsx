// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SubscribeButton from "./SubscribeButton";

afterEach(cleanup);

describe("SubscribeButton", () => {
  it("renders an idle subscribe button with correct accessible label and help popover", () => {
    render(<SubscribeButton apiName="Weather API" />);

    const btn = screen.getByRole("button", { name: "Subscribe to Weather API" });
    expect(btn).toBeTruthy();
    expect(btn.textContent).toBe("Subscribe");

    // Help popover trigger should also be present
    expect(
      screen.getByRole("button", { name: /Help: What does subscribing to Weather API mean\?/i })
    ).toBeTruthy();
  });

  it("shows a confirmation dialog when the subscribe button is clicked", () => {
    render(<SubscribeButton apiName="Weather API" />);

    fireEvent.click(screen.getByRole("button", { name: "Subscribe to Weather API" }));

    // Confirmation dialog should be present
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(/Subscribe to/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel subscription" })).toBeTruthy();
  });

  it("calls onSubscribe and shows subscribed state after confirmation", async () => {
    const onSubscribe = vi.fn().mockResolvedValue(undefined);
    render(<SubscribeButton apiName="Weather API" onSubscribe={onSubscribe} />);

    fireEvent.click(screen.getByRole("button", { name: "Subscribe to Weather API" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(onSubscribe).toHaveBeenCalledOnce();
    });

    const status = screen.getByRole("status");
    expect(status).toBeTruthy();
    expect(screen.getByText("Subscribed!")).toBeTruthy();
  });

  it("returns to idle state when the user cancels", () => {
    render(<SubscribeButton apiName="Weather API" />);

    fireEvent.click(screen.getByRole("button", { name: "Subscribe to Weather API" }));
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cancel subscription" }));

    // Back to idle – the subscribe button should be visible again
    expect(screen.getByRole("button", { name: "Subscribe to Weather API" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("applies correct focus outline classes to interactive elements for focus-visible styles", () => {
    render(<SubscribeButton apiName="Weather API" />);

    // Idle state: Subscribe button should have 'subscribe-button' class
    const subscribeBtn = screen.getByRole("button", { name: "Subscribe to Weather API" });
    expect(subscribeBtn.className).toContain("subscribe-button");

    // Click to enter confirmation state
    fireEvent.click(subscribeBtn);

    // Confirmation state: Confirm button should have 'subscribe-button-confirm' class
    const confirmBtn = screen.getByRole("button", { name: "Confirm" });
    expect(confirmBtn.className).toContain("subscribe-button-confirm");

    // Confirmation state: Cancel button should have 'subscribe-button-cancel' class
    const cancelBtn = screen.getByRole("button", { name: "Cancel subscription" });
    expect(cancelBtn.className).toContain("subscribe-button-cancel");
  });

  it("renders the help popover with correct subscription explanation content", async () => {
    render(<SubscribeButton apiName="Weather API" />);

    // The help popover should be visible in idle state
    const helpBtn = screen.getByRole("button", { name: /Help: What does subscribing to Weather API mean\?/i });
    expect(helpBtn).toBeTruthy();

    // Hover the help button to reveal the tooltip
    fireEvent.mouseEnter(helpBtn);

    // Wait for the 300ms hover delay to elapse and the tooltip to appear
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toBeTruthy();

    // Verify the tooltip contains the explanation text
    expect(tooltip.textContent).toContain("What is");
    expect(tooltip.textContent).toContain("Subscribing");
    expect(tooltip.textContent).toContain("charged per successful API request");
  });

  // ── Scenarios from Test Plan (Issue Requirements) ──────────────────────────

  // Scenario 1: Active subscription exists on load -> button shows Subscribed with Unsubscribe
  it("Scenario 1: Active subscription exists on load: button shows Subscribed with Unsubscribe", () => {
    render(<SubscribeButton apiName="Weather API" isSubscribed={true} />);

    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText("Subscribed!")).toBeTruthy();
    const unsubBtn = screen.getByRole("button", { name: "Unsubscribe from Weather API" });
    expect(unsubBtn).toBeTruthy();
  });

  // Scenario 3: Subscribe 500 -> alert shown, confirmation stays open, no success toast
  it("Scenario 3: Subscribe 500: alert shown, confirmation stays open", async () => {
    const onSubscribe = vi.fn().mockRejectedValue(new Error("Internal Server Error (500)"));
    render(<SubscribeButton apiName="Weather API" onSubscribe={onSubscribe} />);

    fireEvent.click(screen.getByRole("button", { name: "Subscribe to Weather API" }));
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(onSubscribe).toHaveBeenCalledOnce();
    });

    // Confirmation dialog stays open
    expect(screen.getByRole("dialog")).toBeTruthy();
    // role="alert" rendered
    const alert = screen.getByRole("alert");
    expect(alert).toBeTruthy();
    expect(alert.textContent).toContain("Internal Server Error (500)");
    // Not marked as subscribed
    expect(screen.queryByRole("status")).toBeNull();
  });

  // Scenario 5: Double-click confirm -> exactly one POST/call made
  it("Scenario 5: Double-click confirm: exactly one call made due to in-flight guard", async () => {
    let resolveSubscribe: () => void = () => {};
    const onSubscribe = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSubscribe = resolve;
        }),
    );

    render(<SubscribeButton apiName="Weather API" onSubscribe={onSubscribe} />);

    fireEvent.click(screen.getByRole("button", { name: "Subscribe to Weather API" }));
    const confirmBtn = screen.getByRole("button", { name: "Confirm" });

    // Double-click
    fireEvent.click(confirmBtn);
    fireEvent.click(confirmBtn);

    expect(onSubscribe).toHaveBeenCalledTimes(1);

    resolveSubscribe();
    await waitFor(() => {
      expect(screen.getByText("Subscribed!")).toBeTruthy();
    });
  });

  // Scenario 6: Unsubscribe -> confirmation dialog, onUnsubscribe called, returns to idle/unsubscribed
  it("Scenario 6: Unsubscribe flow: prompts confirmation, calls onUnsubscribe, returns to idle", async () => {
    const onUnsubscribe = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <SubscribeButton
        apiName="Weather API"
        isSubscribed={true}
        onUnsubscribe={onUnsubscribe}
      />,
    );

    // Click Unsubscribe
    const unsubBtn = screen.getByRole("button", { name: "Unsubscribe from Weather API" });
    fireEvent.click(unsubBtn);

    // Unsubscribe confirmation dialog opens
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(screen.getByText(/Unsubscribe from/)).toBeTruthy();

    // Click Confirm on unsubscribe
    const confirmBtn = screen.getByRole("button", { name: "Confirm" });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(onUnsubscribe).toHaveBeenCalledOnce();
    });

    // Rerender as unsubscribed
    rerender(
      <SubscribeButton
        apiName="Weather API"
        isSubscribed={false}
        onUnsubscribe={onUnsubscribe}
      />,
    );

    // Back to idle
    expect(screen.getByRole("button", { name: "Subscribe to Weather API" })).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  // Scenario 6b: Unsubscribe failure keeps confirmation open and displays alert
  it("Unsubscribe failure: alert shown and confirmation dialog remains open", async () => {
    const onUnsubscribe = vi.fn().mockRejectedValue(new Error("Failed to cancel subscription"));
    render(
      <SubscribeButton
        apiName="Weather API"
        isSubscribed={true}
        onUnsubscribe={onUnsubscribe}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Unsubscribe from Weather API" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(onUnsubscribe).toHaveBeenCalledOnce();
    });

    // Dialog remains open with alert
    expect(screen.getByRole("dialog")).toBeTruthy();
    const alert = screen.getByRole("alert");
    expect(alert).toBeTruthy();
    expect(alert.textContent).toContain("Failed to cancel subscription");
  });

  // Scenario 8: Demo mode badge rendered
  it("Scenario 8: Demo mode renders 'Demo' label and idle subscribe button", () => {
    render(<SubscribeButton apiName="Weather API" badgeLabel="Demo" />);

    expect(screen.getByText("Demo")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Subscribe to Weather API" })).toBeTruthy();
  });
});
