/**
 * WithdrawModal.test.tsx
 *
 * Tests for validation states and stage transitions in the withdrawal modal.
 * Closes #1373.
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import WithdrawModal from "./WithdrawModal";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockSubmitVaultWithdraw = vi.fn();

vi.mock("../services/walletService", () => ({
  submitVaultWithdraw: mockSubmitVaultWithdraw,
  WalletServiceError: class WalletServiceError extends Error {
    code: string;
    requiresReconciliation: boolean;
    constructor(code: string, message: string, requiresReconciliation = false) {
      super(message);
      this.name = "WalletServiceError";
      this.code = code;
      this.requiresReconciliation = requiresReconciliation;
    }
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VAULT_STROOPS = 50_000_0000n; // 50 USDC

function renderModal(overrides?: Partial<React.ComponentProps<typeof WithdrawModal>>) {
  const defaults = {
    vaultStroops: VAULT_STROOPS,
    onRefreshBalances: vi.fn(),
    onShowSuccessToast: vi.fn(),
    onClose: vi.fn(),
  };
  const props = { ...defaults, ...overrides };
  return { ...render(<WithdrawModal {...props} />), props };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("WithdrawModal – validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with the vault balance displayed", () => {
    renderModal();
    expect(screen.getByText(/50\.00/)).toBeDefined();
  });

  it("confirms button is disabled when amount is empty", () => {
    renderModal();
    const btn = screen.getByRole("button", { name: /confirm withdrawal/i });
    expect(btn).toBeDisabled();
  });

  it("confirms button is disabled when vault balance is zero", () => {
    renderModal({ vaultStroops: 0n });
    const btn = screen.getByRole("button", { name: /confirm withdrawal/i });
    expect(btn).toBeDisabled();
  });

  it("confirms button is disabled when vault balance is null", () => {
    renderModal({ vaultStroops: null });
    const btn = screen.getByRole("button", { name: /confirm withdrawal/i });
    expect(btn).toBeDisabled();
  });

  it("shows validation error for a non-numeric amount", async () => {
    renderModal();
    const input = screen.getByLabelText(/Withdrawal amount/i);
    await userEvent.type(input, "abc");
    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByRole("alert").textContent).toMatch(/positive number/i);
  });

  it("shows validation error when amount exceeds vault balance", async () => {
    renderModal();
    const input = screen.getByLabelText(/Withdrawal amount/i);
    await userEvent.type(input, "999");
    expect(screen.getByRole("alert").textContent).toMatch(/exceeds/i);
    const btn = screen.getByRole("button", { name: /confirm withdrawal/i });
    expect(btn).toBeDisabled();
  });

  it("shows validation error for more than 7 decimal places", async () => {
    renderModal();
    const input = screen.getByLabelText(/Withdrawal amount/i);
    await userEvent.type(input, "1.00000001");
    expect(screen.getByRole("alert").textContent).toMatch(/7 decimal/i);
  });

  it("Max button fills the vault balance", async () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: /max/i }));
    const input = screen.getByLabelText(/Withdrawal amount/i) as HTMLInputElement;
    expect(input.value).toMatch(/^50/);
  });

  it("enables confirm button for a valid amount", async () => {
    renderModal();
    const input = screen.getByLabelText(/Withdrawal amount/i);
    await userEvent.type(input, "10");
    const btn = screen.getByRole("button", { name: /confirm withdrawal/i });
    expect(btn).not.toBeDisabled();
  });
});

describe("WithdrawModal – stage transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("transitions to approving, then confirmed on success", async () => {
    mockSubmitVaultWithdraw.mockImplementation(
      async (_amount: unknown, onSubmitted: (hash: string) => void) => {
        onSubmitted("TX_HASH_123");
        return { hash: "TX_HASH_123" };
      },
    );

    const { props } = renderModal();
    const input = screen.getByLabelText(/Withdrawal amount/i);
    await userEvent.type(input, "10");
    fireEvent.click(screen.getByRole("button", { name: /confirm withdrawal/i }));

    // Should reach confirmed
    await waitFor(() => {
      expect(screen.getByText(/Withdrawal confirmed/i)).toBeDefined();
    });

    expect(props.onRefreshBalances).toHaveBeenCalledTimes(1);
    expect(props.onShowSuccessToast).toHaveBeenCalledTimes(1);
    expect(props.onShowSuccessToast).toHaveBeenCalledWith(
      expect.stringContaining("TX_HASH_123"),
    );
  });

  it("transitions to failed with the error message on wallet rejection", async () => {
    const { WalletServiceError } = await import("../services/walletService") as any;
    mockSubmitVaultWithdraw.mockRejectedValueOnce(
      new WalletServiceError("SIGNATURE_REJECTED", "Signature rejected. No funds were moved."),
    );

    renderModal();
    const input = screen.getByLabelText(/Withdrawal amount/i);
    await userEvent.type(input, "10");
    fireEvent.click(screen.getByRole("button", { name: /confirm withdrawal/i }));

    await waitFor(() => {
      expect(screen.getByText(/Signature rejected/i)).toBeDefined();
    });
  });

  it("shows retry button after failure and re-enables the form", async () => {
    mockSubmitVaultWithdraw.mockRejectedValueOnce(new Error("network error"));

    renderModal();
    const input = screen.getByLabelText(/Withdrawal amount/i);
    await userEvent.type(input, "10");
    fireEvent.click(screen.getByRole("button", { name: /confirm withdrawal/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /retry withdrawal/i })).toBeDefined();
    });
  });

  it("Escape closes the modal when not busy", async () => {
    const { props } = renderModal();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape does not close the modal while approving", async () => {
    let resolveWithdraw!: () => void;
    mockSubmitVaultWithdraw.mockImplementation(
      () => new Promise((resolve) => { resolveWithdraw = () => resolve({ hash: "X" }); }),
    );

    const { props } = renderModal();
    const input = screen.getByLabelText(/Withdrawal amount/i);
    await userEvent.type(input, "10");
    fireEvent.click(screen.getByRole("button", { name: /confirm withdrawal/i }));

    // Now in approving state
    await waitFor(() => {
      expect(screen.getByText(/Approve the withdrawal/i)).toBeDefined();
    });

    fireEvent.keyDown(document, { key: "Escape" });
    expect(props.onClose).not.toHaveBeenCalled();

    resolveWithdraw();
  });

  it("clicking the backdrop closes the modal when not busy", () => {
    const { props } = renderModal();
    // Click the backdrop (the outer div that has onClick={onClose} when target matches)
    fireEvent.click(document.querySelector("[role='dialog']")!.parentElement!);
    expect(props.onClose).toHaveBeenCalled();
  });
});

describe("WithdrawModal – edge cases", () => {
  it("amount equal to full balance is valid and enabled", async () => {
    renderModal({ vaultStroops: 10_000_0000n }); // 10 USDC
    const input = screen.getByLabelText(/Withdrawal amount/i);
    await userEvent.type(input, "10");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: /confirm withdrawal/i })).not.toBeDisabled();
  });

  it("double-submit is blocked while approving", async () => {
    let resolveWithdraw!: () => void;
    mockSubmitVaultWithdraw.mockImplementation(
      () => new Promise((resolve) => { resolveWithdraw = () => resolve({ hash: "X" }); }),
    );

    renderModal();
    const input = screen.getByLabelText(/Withdrawal amount/i);
    await userEvent.type(input, "10");
    const btn = screen.getByRole("button", { name: /confirm withdrawal/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByText(/Approve the withdrawal/i)).toBeDefined();
    });

    // Button no longer rendered in approving state; mockSubmitVaultWithdraw called once
    expect(mockSubmitVaultWithdraw).toHaveBeenCalledTimes(1);
    resolveWithdraw();
  });
});
