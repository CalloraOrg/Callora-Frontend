// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SubscribeButton from "./SubscribeButton";

afterEach(cleanup);

describe("SubscribeButton", () => {
  it("renders an idle subscribe button with correct accessible label", () => {
    render(<SubscribeButton apiName="Weather API" />);

    const btn = screen.getByRole("button", { name: "Subscribe to Weather API" });
    expect(btn).toBeTruthy();
    expect(btn.textContent).toBe("Subscribe");
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
});
