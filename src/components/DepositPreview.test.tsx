// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DepositPreview, { clearNetworkFeeCache } from "./DepositPreview";

describe("DepositPreview", () => {
  afterEach(() => {
    cleanup();
    clearNetworkFeeCache();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));
  });

  it("renders before and projected after balances correctly", () => {
    render(
      <DepositPreview
        previewCurrentBalance={50}
        projectedBalance={150}
        networkFee="0.00001 XLM"
        amount={100}
        hasAmount={true}
        walletBalance={200}
      />
    );

    expect(screen.getByLabelText("Deposit transaction preview")).toBeTruthy();
    expect(screen.getAllByText(/50\.00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/150\.00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/100\.00/).length).toBeGreaterThan(0);
    expect(screen.getByText("0.00001 XLM")).toBeTruthy();
  });

  it("calculates post-deposit wallet balance accurately", () => {
    render(
      <DepositPreview
        previewCurrentBalance={20}
        projectedBalance={70}
        networkFee="0.00001 XLM"
        amount={50}
        hasAmount={true}
        walletBalance={100}
      />
    );

    // Wallet balance before: 100.00, wallet balance after: 50.00
    expect(screen.getAllByText(/100\.00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/50\.00/).length).toBeGreaterThan(0);
  });

  it("handles state when no valid deposit amount has been entered", () => {
    render(
      <DepositPreview
        previewCurrentBalance={15}
        projectedBalance={15}
        networkFee="0.00001 XLM"
        amount={0}
        hasAmount={false}
        walletBalance={100}
      />
    );

    expect(screen.getByText("0 USDC + 0.00001 XLM")).toBeTruthy();
  });

  it("uses custom ARIA label when provided", () => {
    render(
      <DepositPreview
        previewCurrentBalance={10}
        projectedBalance={20}
        networkFee="0.00001 XLM"
        amount={10}
        hasAmount={true}
        walletBalance={50}
        ariaLabel="Custom preview label"
      />
    );

    expect(screen.getByLabelText("Custom preview label")).toBeTruthy();
  });

  it("shows the recommended Horizon fee when the quote succeeds", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ fee_charged: { mode: "200" } }),
    } as Response);

    const view = render(
      <DepositPreview
        previewCurrentBalance={50}
        projectedBalance={150}
        networkFee="0.00001 XLM"
        amount={100}
        hasAmount={true}
        walletBalance={200}
      />
    );

    await waitFor(() => expect(screen.getByText("0.00002 XLM")).toBeTruthy());
    view.rerender(
      <DepositPreview
        previewCurrentBalance={50}
        projectedBalance={160}
        networkFee="0.00001 XLM"
        amount={110}
        hasAmount={true}
        walletBalance={200}
      />
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("(estimated)")).toBeNull();
  });

  it("falls back to the configured fee with an estimated label when Horizon fails", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network unavailable"));

    render(
      <DepositPreview
        previewCurrentBalance={50}
        projectedBalance={150}
        networkFee="0.00001 XLM"
        amount={100}
        hasAmount={true}
        walletBalance={200}
      />
    );

    await waitFor(() => expect(screen.getByText("(estimated)")).toBeTruthy());
    expect(screen.getByText("0.00001 XLM")).toBeTruthy();
  });
});
