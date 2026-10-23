// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LowBalanceBanner from "./LowBalanceBanner";
import {
  LOW_BALANCE_USD,
  LOW_BALANCE_SNOOZE_KEY,
  LOW_BALANCE_SNOOZE_TTL_MS,
} from "../config/constants";

function readSnoozeRaw(): string | null {
  return localStorage.getItem(LOW_BALANCE_SNOOZE_KEY);
}

describe("LowBalanceBanner", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders warning banner when balance is below threshold", () => {
    render(<LowBalanceBanner balance={LOW_BALANCE_USD - 5} openDeposit={() => {}} />);

    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText(/Low balance warning/i)).toBeTruthy();
    expect(screen.getByText((content) => content.includes(`$${LOW_BALANCE_USD}`))).toBeTruthy();
  });

  it("does not render when balance is at or above threshold", () => {
    const { container } = render(
      <LowBalanceBanner balance={LOW_BALANCE_USD} openDeposit={() => {}} />
    );

    expect(container.firstChild).toBeNull();
  });

  it("has accessible attributes role='status' and aria-live='polite'", () => {
    render(<LowBalanceBanner balance={5} openDeposit={() => {}} />);

    const statusEl = screen.getByRole("status");
    expect(statusEl.getAttribute("aria-live")).toBe("polite");
  });

  it("calls openDeposit callback when Deposit USDC button is clicked", () => {
    const handleOpenDeposit = vi.fn();
    render(<LowBalanceBanner balance={5} openDeposit={handleOpenDeposit} />);

    const depositBtn = screen.getByRole("button", { name: /Deposit USDC/i });
    fireEvent.click(depositBtn);

    expect(handleOpenDeposit).toHaveBeenCalledTimes(1);
  });

  it("hides banner and persists dismissed balance + timestamp in localStorage", () => {
    const { container } = render(
      <LowBalanceBanner balance={5} openDeposit={() => {}} />
    );

    const dismissBtn = screen.getByRole("button", { name: /Dismiss warning/i });
    fireEvent.click(dismissBtn);

    expect(container.firstChild).toBeNull();

    const raw = readSnoozeRaw();
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    expect(parsed.balance).toBe(5);
    expect(typeof parsed.dismissedAt).toBe("number");
  });

  it("keeps banner hidden across remounts while balance is unchanged", () => {
    const { unmount } = render(
      <LowBalanceBanner balance={5} openDeposit={() => {}} />
    );
    fireEvent.click(screen.getByRole("button", { name: /Dismiss warning/i }));
    unmount();

    // Simulate a route change: fresh mount, same balance.
    const { container } = render(
      <LowBalanceBanner balance={5} openDeposit={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("reappears when the balance decreases after dismissal", () => {
    const { unmount } = render(
      <LowBalanceBanner balance={5} openDeposit={() => {}} />
    );
    fireEvent.click(screen.getByRole("button", { name: /Dismiss warning/i }));
    unmount();

    const { container } = render(
      <LowBalanceBanner balance={3} openDeposit={() => {}} />
    );
    expect(container.firstChild).not.toBeNull();
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("reappears when the balance changes at all after dismissal", () => {
    const { unmount } = render(
      <LowBalanceBanner balance={5} openDeposit={() => {}} />
    );
    fireEvent.click(screen.getByRole("button", { name: /Dismiss warning/i }));
    unmount();

    // Partial top-up still under the threshold: situation changed, warn again.
    const { container } = render(
      <LowBalanceBanner balance={8} openDeposit={() => {}} />
    );
    expect(container.firstChild).not.toBeNull();
  });

  it("reappears after the snooze window expires and clears the record", () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    render(<LowBalanceBanner balance={5} openDeposit={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Dismiss warning/i }));
    cleanup();

    // Advance past the 24 h TTL.
    vi.setSystemTime(now + LOW_BALANCE_SNOOZE_TTL_MS + 1);

    const { container } = render(
      <LowBalanceBanner balance={5} openDeposit={() => {}} />
    );
    expect(container.firstChild).not.toBeNull();
    expect(readSnoozeRaw()).toBeNull();
  });

  it("ignores malformed snooze records instead of crashing", () => {
    localStorage.setItem(LOW_BALANCE_SNOOZE_KEY, "not-json{{");

    const { container } = render(
      <LowBalanceBanner balance={5} openDeposit={() => {}} />
    );
    expect(container.firstChild).not.toBeNull();
  });

  it("does not crash when localStorage throws on read and write", () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const setSpy = vi
      .spyOn(window.localStorage, "setItem")
      .mockImplementation(() => {
        throw new Error("denied");
      });

    const { container } = render(
      <LowBalanceBanner balance={5} openDeposit={() => {}} />
    );
    expect(container.firstChild).not.toBeNull();

    // Dismiss still hides for this mount even though persistence failed.
    fireEvent.click(screen.getByRole("button", { name: /Dismiss warning/i }));
    expect(container.firstChild).toBeNull();
    expect(setSpy).toHaveBeenCalled();
  });
});
