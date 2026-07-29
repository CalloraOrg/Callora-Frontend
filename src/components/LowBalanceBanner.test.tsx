// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LowBalanceBanner from "./LowBalanceBanner";
import { LOW_BALANCE_USD } from "../config/constants";

describe("LowBalanceBanner", () => {
  beforeEach(() => {
    sessionStorage.clear();
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

  it("hides banner and persists dismissal state in sessionStorage when dismissed", () => {
    const { container } = render(
      <LowBalanceBanner balance={5} openDeposit={() => {}} />
    );

    const dismissBtn = screen.getByRole("button", { name: /Dismiss warning/i });
    fireEvent.click(dismissBtn);

    expect(container.firstChild).toBeNull();
    expect(sessionStorage.getItem("lowBalanceBannerDismissed")).toBe("true");
  });

  it("remains hidden if previously dismissed in sessionStorage", () => {
    sessionStorage.setItem("lowBalanceBannerDismissed", "true");

    const { container } = render(
      <LowBalanceBanner balance={5} openDeposit={() => {}} />
    );

    expect(container.firstChild).toBeNull();
  });
});
