// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { AccountProvider } from "./hooks/useAccountContext";
import { ThemeProvider } from "./ThemeContext";
import { CollectionsProvider } from "./state/collectionsStore";

function renderDepositApp() {
  return render(
    <ThemeProvider>
      <CollectionsProvider>
        <AccountProvider>
          <MemoryRouter initialEntries={["/billing?deposit=true"]}>
            <App />
          </MemoryRouter>
        </AccountProvider>
      </CollectionsProvider>
    </ThemeProvider>,
  );
}

/**
 * Render at /billing?deposit=true with real timers until the modal is present
 * (the billing section suspends on a lazy InvoiceCard), then switch to fake
 * timers and advance past the ~400ms route-transition timers before asserting.
 */
async function renderModalReady() {
  renderDepositApp();
  const dialog = await screen.findByRole("dialog");
  vi.useFakeTimers();
  act(() => {
    vi.advanceTimersByTime(400);
  });
  const amountInput = screen.getByPlaceholderText("0.00") as HTMLInputElement;
  return { dialog, amountInput };
}

function setAmount(input: HTMLInputElement, value: string) {
  fireEvent.change(input, { target: { value } });
}

describe("App deposit modal timed transitions", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows empty validation message", async () => {
    const { amountInput } = await renderModalReady();
    setAmount(amountInput, "");
    expect(screen.getByText("Enter a deposit amount to continue.")).toBeTruthy();
  });

  it("shows NaN validation message", async () => {
    const { amountInput } = await renderModalReady();
    setAmount(amountInput, ".");
    expect(screen.getByText("Amount must be a valid number.")).toBeTruthy();
  });

  it("shows minimum deposit message for amounts under 10", async () => {
    const { amountInput } = await renderModalReady();
    setAmount(amountInput, "5");
    expect(screen.getByText("Minimum deposit is $10.")).toBeTruthy();
  });

  it("shows exceed message for amounts above the wallet balance", async () => {
    const { amountInput } = await renderModalReady();
    setAmount(amountInput, "5000");
    expect(screen.getByText("Amount exceeds available wallet balance.")).toBeTruthy();
  });

  it("selects presets and Max using the wallet balance", async () => {
    const { amountInput } = await renderModalReady();
    const preset100 = screen.getByRole("radio", { name: "$100" });
    fireEvent.click(preset100);
    expect(amountInput.value).toBe("100");
    expect(preset100.getAttribute("aria-checked")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: /Max/i }));
    expect(amountInput.value).toBe("1260.50");
  });

  it("drives approving to pending to confirmed and updates the vault balance", async () => {
    const { amountInput } = await renderModalReady();
    setAmount(amountInput, "50");

    fireEvent.click(screen.getByRole("button", { name: "Approve deposit transaction" }));
    expect(screen.getAllByText("Approve in wallet...").length).toBeGreaterThan(0);

    act(() => {
      vi.advanceTimersByTime(1400);
    });
    expect(screen.getAllByText("Transaction submitted...").length).toBeGreaterThan(0);

    act(() => {
      vi.advanceTimersByTime(2200);
    });
    expect(screen.getAllByText("Deposit successful").length).toBeGreaterThan(0);
    // 284.62 initial vault + 50 deposit = 334.62
    expect(screen.getAllByText(/334\.62/).length).toBeGreaterThan(0);
  });

  it("shows failure and retry restores the submitted amount", async () => {
    renderDepositApp();
    // The billing section suspends on a lazy InvoiceCard, so wait for the
    // demo-outcome toggle with real timers before starting the failure path.
    const failedToggle = await screen.findByRole("radio", { name: "Failed path" });
    fireEvent.click(failedToggle);
    vi.useFakeTimers();
    act(() => {
      vi.advanceTimersByTime(400);
    });
    const amountInput = screen.getByPlaceholderText("0.00") as HTMLInputElement;
    setAmount(amountInput, "80");

    fireEvent.click(screen.getByRole("button", { name: "Approve deposit transaction" }));

    act(() => {
      vi.advanceTimersByTime(1400);
    });
    expect(screen.getAllByText("Transaction submitted...").length).toBeGreaterThan(0);

    act(() => {
      vi.advanceTimersByTime(2200);
    });
    expect(screen.getAllByText("Transaction failed").length).toBeGreaterThan(0);
    expect(screen.getByText("Approval not confirmed")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Retry deposit" }));
    const restored = screen.getByPlaceholderText("0.00") as HTMLInputElement;
    expect(restored.value).toBe("80");
    expect(screen.getByText("Review the transaction details and approve again.")).toBeTruthy();
  });
});
