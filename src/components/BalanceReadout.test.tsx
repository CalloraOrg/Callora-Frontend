// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import BalanceReadout from "./BalanceReadout";

afterEach(cleanup);

describe("BalanceReadout", () => {
  describe("exact-text value rendering", () => {
    it("renders high-precision value verbatim with USDC suffix", () => {
      render(
        <BalanceReadout
          value="1234.5600000"
          status="ready"
          label="Vault balance"
        />
      );

      const readout = screen.getByTestId("balance-vault-balance");
      expect(readout.textContent).toBe("1234.5600000 USDC");
    });

    it('renders "0" as "0 USDC" rather than treating zero as missing', () => {
      render(
        <BalanceReadout value="0" status="ready" label="Vault balance" />
      );

      const readout = screen.getByTestId("balance-vault-balance");
      expect(readout.textContent).toBe("0 USDC");
    });

    it("renders empty-string value through the value branch (not placeholder)", () => {
      render(
        <BalanceReadout
          value=""
          status="ready"
          label="Vault balance"
          placeholder="No balance"
        />
      );

      const readout = screen.getByTestId("balance-vault-balance");
      expect(readout.textContent).toBe(" USDC");
    });

    it("renders pending refresh marker when pending is true", () => {
      render(
        <BalanceReadout
          value="42.50"
          status="ready"
          label="Vault balance"
          pending
        />
      );

      const readout = screen.getByTestId("balance-vault-balance");
      expect(readout.textContent).toContain("42.50 USDC");
      expect(readout.querySelector(".balance-readout__pending")?.textContent).toBe(
        "pending refresh"
      );
    });

    it("does not render pending marker when pending is false", () => {
      render(
        <BalanceReadout
          value="42.50"
          status="ready"
          label="Vault balance"
          pending={false}
        />
      );

      const readout = screen.getByTestId("balance-vault-balance");
      expect(readout.querySelector(".balance-readout__pending")).toBeNull();
    });
  });

  describe("loading and idle states", () => {
    it.each(["loading", "idle"] as const)(
      "renders aria-busy skeleton with sr-only text when status is %s",
      (status) => {
        render(
          <BalanceReadout
            value={null}
            status={status}
            label="Vault balance"
          />
        );

        const loadingEl = screen.getByTestId("balance-vault-balance-loading");
        expect(loadingEl.getAttribute("aria-busy")).toBe("true");
        const srOnly = loadingEl.querySelector(".sr-only");
        expect(srOnly?.textContent).toBe("Loading Vault balance");
      }
    );
  });

  describe("error state", () => {
    it("renders error message, invokes onRetry on click, and never renders 0", async () => {
      const user = userEvent.setup();
      const onRetry = vi.fn();

      render(
        <BalanceReadout
          value={null}
          status="error"
          error="RPC unavailable"
          onRetry={onRetry}
          label="Vault balance"
        />
      );

      const readout = screen.getByTestId("balance-vault-balance");
      expect(readout.textContent).toContain("RPC unavailable");
      expect(readout.textContent).not.toMatch(/\b0\b/);
      expect(readout.textContent).not.toContain("USDC");

      const retryButton = screen.getByRole("button", {
        name: /retry loading vault balance/i,
      });
      await user.click(retryButton);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it("omits Retry button when onRetry is not provided", () => {
      render(
        <BalanceReadout
          value={null}
          status="error"
          error="Network timeout"
          label="Vault balance"
        />
      );

      const readout = screen.getByTestId("balance-vault-balance");
      expect(readout.textContent).toContain("Network timeout");
      expect(screen.queryByRole("button")).toBeNull();
    });
  });

  describe("not-configured and placeholder states", () => {
    it('renders "Vault not configured" when configured is false', () => {
      render(
        <BalanceReadout
          value={null}
          status="idle"
          configured={false}
          label="Vault balance"
        />
      );

      const readout = screen.getByTestId("balance-vault-balance");
      expect(readout.textContent).toBe("Vault not configured");
    });

    it('renders default "—" placeholder when status is ready with null value and no error', () => {
      render(
        <BalanceReadout value={null} status="ready" label="Vault balance" />
      );

      const readout = screen.getByTestId("balance-vault-balance");
      expect(readout.textContent).toBe("—");
    });

    it("renders custom placeholder when provided", () => {
      render(
        <BalanceReadout
          value={null}
          status="ready"
          placeholder="Connect wallet"
          label="Wallet balance"
        />
      );

      const readout = screen.getByTestId("balance-wallet-balance");
      expect(readout.textContent).toBe("Connect wallet");
    });
  });

  describe("render precedence", () => {
    it("configured=false takes precedence over value, error, and loading", () => {
      render(
        <BalanceReadout
          value="100.00"
          status="loading"
          configured={false}
          error="Some error"
          onRetry={vi.fn()}
          placeholder="Connect wallet"
          label="Vault balance"
        />
      );

      const readout = screen.getByTestId("balance-vault-balance");
      expect(readout.textContent).toBe("Vault not configured");
      expect(screen.queryByRole("button")).toBeNull();
    });

    it("value takes precedence over error and loading status", () => {
      render(
        <BalanceReadout
          value="250.75"
          status="loading"
          error="Stale refresh failed"
          onRetry={vi.fn()}
          label="Vault balance"
        />
      );

      const readout = screen.getByTestId("balance-vault-balance");
      expect(readout.textContent).toBe("250.75 USDC");
      expect(screen.queryByRole("button")).toBeNull();
      expect(screen.queryByTestId("balance-vault-balance-loading")).toBeNull();
    });

    it("error takes precedence over loading and idle status", () => {
      render(
        <BalanceReadout
          value={null}
          status="loading"
          error="Failed to fetch"
          onRetry={vi.fn()}
          label="Vault balance"
        />
      );

      const readout = screen.getByTestId("balance-vault-balance");
      expect(readout.textContent).toContain("Failed to fetch");
      expect(screen.queryByTestId("balance-vault-balance-loading")).toBeNull();
    });

    it("loading takes precedence over placeholder", () => {
      render(
        <BalanceReadout
          value={null}
          status="loading"
          placeholder="Connect wallet"
          label="Vault balance"
        />
      );

      const loadingEl = screen.getByTestId("balance-vault-balance-loading");
      expect(loadingEl.getAttribute("aria-busy")).toBe("true");
      expect(screen.queryByText("Connect wallet")).toBeNull();
    });
  });

  describe("test-id slug and className", () => {
    it("normalizes spaces and punctuation in label for data-testid", () => {
      render(
        <BalanceReadout
          value="10.00"
          status="ready"
          label="  Wallet (USDC) — Mainnet!  "
        />
      );

      const readout = screen.getByTestId("balance-wallet-usdc-mainnet");
      expect(readout.textContent).toBe("10.00 USDC");
    });

    it("applies normalized slug to loading test-id", () => {
      render(
        <BalanceReadout
          value={null}
          status="loading"
          label="API / Billing: Balance"
        />
      );

      expect(
        screen.getByTestId("balance-api-billing-balance-loading")
      ).toBeTruthy();
    });

    it("forwards custom className", () => {
      render(
        <BalanceReadout
          value="5.00"
          status="ready"
          label="Vault balance"
          className="custom-balance"
        />
      );

      const readout = screen.getByTestId("balance-vault-balance");
      expect(readout.classList.contains("balance-readout")).toBe(true);
      expect(readout.classList.contains("custom-balance")).toBe(true);
    });
  });
});
