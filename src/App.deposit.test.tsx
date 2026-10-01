// @vitest-environment jsdom
/**
 * Deposit amount input tests (issue #1175).
 *
 * Covers the normalisation applied by `handleAmountChange` in `src/App.tsx`:
 *  - `'1.2.3'` no longer becomes `NaN` / "Amount must be a valid number"
 *  - fraction digits are capped at the 7 decimals USDC supports on Stellar
 *  - a truncation hint is announced through `role="status"` and wired to the
 *    input via `aria-describedby`
 *  - locale commas are interpreted deterministically (`'10,5'` → `'10.5'`)
 *  - the normalised value is what reaches validation, the preview and submit
 *
 * Run with: npm test -- --run src/App.deposit.test.tsx
 */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { AccountProvider } from "./hooks/useAccountContext";
import { ThemeProvider } from "./ThemeContext";
import { CollectionsProvider } from "./state/collectionsStore";
import { normalizeUsdcAmountInput, USDC_DECIMALS } from "./utils/format";

/** Renders the app deep-linked to the billing page with the deposit modal open. */
function renderDepositModal() {
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

function getAmountInput(): HTMLInputElement {
  return screen.getByLabelText("Amount") as HTMLInputElement;
}

/**
 * The inline hint element. Queried by id because the app renders other live
 * regions (e.g. the theme toggle label), so a bare `getByRole("status")` is
 * ambiguous.
 */
function getAmountHint(): HTMLElement | null {
  return document.getElementById("deposit-amount-hint");
}

/** Types `value` into the deposit amount field and returns the controlled input. */
function typeAmount(value: string): HTMLInputElement {
  const input = getAmountInput();
  fireEvent.change(input, { target: { value } });
  return getAmountInput();
}

// ── Pure normaliser ───────────────────────────────────────────────────────────

describe("normalizeUsdcAmountInput", () => {
  it("keeps a single decimal point and drops the rest of '1.2.3'", () => {
    const result = normalizeUsdcAmountInput("1.2.3");
    expect(result.value).toBe("1.23");
    expect(result.truncated).toBe(false);
    expect(result.corrected).toBe(true);
  });

  it("caps fraction digits at the 7 decimals USDC supports on Stellar", () => {
    expect(USDC_DECIMALS).toBe(7);
    const result = normalizeUsdcAmountInput("1.123456789");
    expect(result.value).toBe("1.1234567");
    expect(result.truncated).toBe(true);
  });

  it("truncates a trailing zero that overflows the precision", () => {
    const result = normalizeUsdcAmountInput("0.12345670");
    expect(result.value).toBe("0.1234567");
    expect(result.truncated).toBe(true);
  });

  it("treats a lone comma as the decimal separator", () => {
    expect(normalizeUsdcAmountInput("10,5").value).toBe("10.5");
    expect(normalizeUsdcAmountInput("0,0000001").value).toBe("0.0000001");
  });

  it("treats a comma thousands grouping as grouping, not decimals", () => {
    expect(normalizeUsdcAmountInput("1,234").value).toBe("1234");
    expect(normalizeUsdcAmountInput("1,234,567").value).toBe("1234567");
  });

  it("resolves mixed separators by position", () => {
    expect(normalizeUsdcAmountInput("1,234.56").value).toBe("1234.56");
    expect(normalizeUsdcAmountInput("1.234,56").value).toBe("1234.56");
  });

  it("strips characters that are not part of an amount", () => {
    expect(normalizeUsdcAmountInput("12abc34").value).toBe("1234");
    expect(normalizeUsdcAmountInput("USDC 25.5").value).toBe("25.5");
    expect(normalizeUsdcAmountInput(" 50 ").value).toBe("50");
  });

  it("leaves a clean amount untouched", () => {
    const result = normalizeUsdcAmountInput("50");
    expect(result.value).toBe("50");
    expect(result.corrected).toBe(false);
    expect(result.truncated).toBe(false);
  });

  it("preserves a trailing decimal point while the user is still typing", () => {
    expect(normalizeUsdcAmountInput("1.").value).toBe("1.");
  });

  it("adds the leading zero for '.5' and returns empty for non-numeric input", () => {
    expect(normalizeUsdcAmountInput(".5").value).toBe("0.5");
    expect(normalizeUsdcAmountInput("abc").value).toBe("");
    expect(normalizeUsdcAmountInput("").value).toBe("");
  });
});

// ── Deposit modal ─────────────────────────────────────────────────────────────

describe("deposit amount input", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("normalises '1.2.3' to '1.23' instead of rejecting it as an invalid number", () => {
    renderDepositModal();
    const input = typeAmount("1.2.3");

    expect(input.value).toBe("1.23");
    // The old behaviour produced NaN → "Amount must be a valid number."; now the
    // only feedback is the ordinary below-minimum message for the parsed 1.23.
    expect(screen.queryByText("Amount must be a valid number.")).toBeNull();
    // The only feedback is the ordinary below-minimum message for the parsed 1.23.
    expect(document.querySelector(".deposit-modal .error-text")?.textContent).toBe("Minimum deposit is $10.");
  });

  it("reads '10,5' as 10.5 consistently with the decimal separator", () => {
    renderDepositModal();
    expect(typeAmount("10,5").value).toBe("10.5");

    const deltaLabel = screen.getByText("Deposit amount").parentElement;
    expect(deltaLabel?.textContent).toContain("10.50 USDC");
  });

  it("truncates more than 7 decimals and announces an inline hint", () => {
    renderDepositModal();
    const input = typeAmount("100.123456789");

    expect(input.value).toBe("100.1234567");

    const hint = getAmountHint();
    expect(hint).not.toBeNull();
    expect(hint?.getAttribute("role")).toBe("status");
    expect(hint?.textContent).toMatch(/7 decimal places/i);
    expect(hint?.textContent).toContain("100.1234567");
    expect(input.getAttribute("aria-describedby")).toContain("deposit-amount-hint");
  });

  it("shows no hint while the amount is within 7 decimals", () => {
    renderDepositModal();
    typeAmount("100.1234567");

    expect(screen.queryByText(/7 decimal places/i)).toBeNull();
    expect(getAmountInput().getAttribute("aria-describedby")).toBe("deposit-help");
  });

  it("clears the truncation hint once the amount is corrected", () => {
    renderDepositModal();
    typeAmount("100.123456789");
    expect(getAmountHint()?.textContent).toMatch(/7 decimal places/i);

    typeAmount("100.12");
    expect(screen.queryByText(/7 decimal places/i)).toBeNull();
  });

  it("validates and previews the normalised value that would be submitted", () => {
    renderDepositModal();
    const input = typeAmount("100.123456789");

    // 100.1234567 is above the minimum deposit and below the wallet balance.
    expect(input.getAttribute("aria-invalid")).toBe("false");
    expect(screen.getByRole("button", { name: /Approve deposit transaction/i })).toBeEnabled();

    const deltaLabel = screen.getByText("Deposit amount").parentElement;
    expect(deltaLabel?.textContent).toContain("100.12 USDC");
  });

  it("still accepts preset amounts without showing a hint", () => {
    renderDepositModal();
    fireEvent.click(screen.getByRole("radio", { name: "$50" }));

    expect(getAmountInput().value).toBe("50");
    expect(screen.queryByText(/7 decimal places/i)).toBeNull();
  });
});

// ── Timed transitions ─────────────────────────────────────────────────────────

/**
 * Render at /billing?deposit=true with real timers until the modal is present
 * (the billing section suspends on a lazy InvoiceCard), then switch to fake
 * timers and advance past the ~400ms route-transition timers before asserting.
 */
async function renderModalReady() {
  renderDepositModal();
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

  it("normalises a lone '.' instead of showing the NaN validation message", async () => {
    const { amountInput } = await renderModalReady();
    setAmount(amountInput, ".");
    // handleAmountChange runs normalizeUsdcAmountInput, so "." becomes "0."
    // and is reported as below the minimum rather than as an invalid number.
    expect(screen.getByPlaceholderText<HTMLInputElement>("0.00").value).toBe("0.");
    expect(screen.queryByText("Amount must be a valid number.")).toBeNull();
    expect(screen.getByText("Minimum deposit is $10.")).toBeTruthy();
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
    renderDepositModal();
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
