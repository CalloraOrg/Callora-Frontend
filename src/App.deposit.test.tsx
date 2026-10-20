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

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { AccountProvider } from "./hooks/useAccountContext";
import { ThemeProvider } from "./ThemeContext";
import { CollectionsProvider } from "./state/collectionsStore";
import { normalizeUsdcAmountInput, USDC_DECIMALS } from "./utils/format";

// Deposits are signed through Freighter via `src/services/walletService`
// (issue #1043). The wallet is mocked so these tests drive the modal's
// approving → pending → confirmed / failed transitions deterministically.
const walletMocks = vi.hoisted(() => ({
  isWalletAvailable: vi.fn(),
  submitVaultDeposit: vi.fn(),
  getWalletAddress: vi.fn(),
  fetch: vi.fn(),
  signTransaction: vi.fn(),
  network: "testnet",
}));

// Mock the vault balances hook to return predictable values matching the old
// hardcoded balances (284.62 vault / 1260.5 wallet) so existing tests pass.
// 284.62 USDC = 2,846,200,000 stroops (10^7 scale)
// 1260.5 USDC = 12,605,000,000 stroops
const vaultBalancesMock = vi.hoisted(() => ({
  vault: 2846200000n,       // 284.62 USDC in stroops
  wallet: 12605000000n,     // 1260.5 USDC in stroops
  status: "ready" as const,
  error: null,
  configured: true,
  refresh: vi.fn().mockResolvedValue(undefined),
  updatedAt: Date.now(),
  revision: 1,
}));

vi.mock("@stellar/freighter-api", () => ({
  isConnected: async () => ({ isConnected: true }),
  requestAccess: async () => ({ address: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF" }),
  getNetwork: async () => ({ networkPassphrase: "Test SDF Network ; September 2015" }),
  signTransaction: walletMocks.signTransaction,
}));

vi.mock("./config/constants", async (importOriginal) => ({
  ...await importOriginal<typeof import("./config/constants")>(),
  get STELLAR_NETWORK() { return walletMocks.network; },
}));

vi.mock("./services/walletService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./services/walletService")>();
  class WalletServiceError extends Error {
    readonly code: string;
    readonly requiresReconciliation: boolean;

    constructor(code: string, message: string, requiresReconciliation = false) {
      super(message);
      this.name = "WalletServiceError";
      this.code = code;
      this.requiresReconciliation = requiresReconciliation;
    }
  }

  return {
    ...actual,
    WalletServiceError,
    isWalletAvailable: walletMocks.isWalletAvailable,
    submitVaultDeposit: walletMocks.submitVaultDeposit,
    getWalletAddress: walletMocks.getWalletAddress,
  };
});

vi.mock("./hooks/useVaultBalances", () => ({
  useVaultBalances: () => vaultBalancesMock,
  BalanceReadStatus: "idle" | "loading" | "ready" | "error",
  VaultBalanceStatus: "idle" | "loading" | "ready" | "error",
}));

beforeEach(() => {
  // Node's TextEncoder returns a Node-realm Uint8Array. The SDK validates
  // these bytes with instanceof, so align jsdom's constructor for real XDR.
  vi.stubGlobal("Uint8Array", new TextEncoder().encode("").constructor);
  walletMocks.network = "testnet";
  walletMocks.getWalletAddress.mockReset().mockResolvedValue("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF");
  walletMocks.signTransaction.mockReset().mockImplementation(async (xdr: string) => ({ signedTxXdr: xdr, signerAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF" }));
  vi.stubGlobal("fetch", walletMocks.fetch);
  walletMocks.fetch.mockReset().mockResolvedValue({ ok: true, status: 200, json: async () => ({
    sequence: "123", balances: [{ asset_code: "USDC", asset_issuer: "GDXDZNSTNORCX4373EGGYS4Q3U3XVZMBSIMMRHG5S5GCCF7JHC7QZWAZ" }],
    fee_charged: { mode: "100" },
  }) });
  walletMocks.isWalletAvailable.mockReset().mockResolvedValue(true);
  walletMocks.submitVaultDeposit.mockReset();
});

afterEach(() => { vi.unstubAllGlobals(); });

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

  it("validates and previews the normalised value that would be submitted", async () => {
    renderDepositModal();
    const input = typeAmount("100.123456789");

    // 100.1234567 is above the minimum deposit and below the wallet balance.
    expect(input.getAttribute("aria-invalid")).toBe("false");
    // The approve button appears once the (mocked) Freighter check resolves.
    expect(await screen.findByRole("button", { name: /Approve deposit transaction/i })).toBeEnabled();

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
 * (the billing section suspends on a lazy InvoiceCard) and the wallet check has
 * resolved, then switch to fake timers and advance past the ~400ms
 * route-transition timers before asserting.
 */
async function renderModalReady() {
  renderDepositModal();
  const dialog = await screen.findByRole("dialog");
  // Wait (on real timers) for the Freighter availability check to resolve.
  await screen.findByRole("button", { name: "Approve deposit transaction" });
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
    // Max now uses the exact wallet balance from Soroban (no trailing zeros)
    expect(amountInput.value).toBe("1260.5");
  });

  it("drives approving to pending to confirmed and updates the vault balance", async () => {
    let reportSubmitted!: (hash: string) => void;
    let confirmDeposit!: (result: { hash: string }) => void;
    walletMocks.submitVaultDeposit.mockImplementation(
      (_amount: string, onSubmitted: (hash: string) => void) => {
        reportSubmitted = onSubmitted;
        return new Promise((resolve) => {
          confirmDeposit = resolve;
        });
      },
    );

    const { amountInput } = await renderModalReady();
    setAmount(amountInput, "50");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Approve deposit transaction" }));
    });
    expect(screen.getAllByText("Approve in wallet...").length).toBeGreaterThan(0);
    expect(walletMocks.submitVaultDeposit).toHaveBeenCalledWith("50", expect.any(Function));

    const hash = "A".repeat(64);
    act(() => {
      reportSubmitted(hash);
    });
    expect(screen.getAllByText("Transaction submitted...").length).toBeGreaterThan(0);

    await act(async () => {
      confirmDeposit({ hash });
    });
    expect(screen.getAllByText("Deposit successful").length).toBeGreaterThan(0);
    // 284.62 initial vault + 50 deposit = 334.62
    expect(screen.getAllByText(/334\.62/).length).toBeGreaterThan(0);
  });

  it("shows failure and retry restores the submitted amount", async () => {
    const { WalletServiceError } = await import("./services/walletService");
    walletMocks.submitVaultDeposit.mockRejectedValue(
      new WalletServiceError("SIGNATURE_REJECTED", "The deposit signature was rejected in Freighter."),
    );

    const { amountInput } = await renderModalReady();
    setAmount(amountInput, "80");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Approve deposit transaction" }));
    });

    expect(screen.getAllByText("Transaction failed").length).toBeGreaterThan(0);
    expect(screen.getByText("Signature rejected")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Retry deposit" }));
    const restored = screen.getByPlaceholderText("0.00") as HTMLInputElement;
    expect(restored.value).toBe("80");
    expect(screen.getByText("Review the transaction details and approve again.")).toBeTruthy();
  });

  it("blocks retry while a submitted deposit still needs reconciliation", async () => {
    const { WalletServiceError } = await import("./services/walletService");
    walletMocks.submitVaultDeposit.mockRejectedValue(
      new WalletServiceError("NETWORK_TIMEOUT", "Check your wallet activity before retrying.", true),
    );

    const { amountInput } = await renderModalReady();
    setAmount(amountInput, "80");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Approve deposit transaction" }));
    });

    expect(screen.getByText("Deposit failed")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Check transaction status before retrying" }),
    ).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Retry deposit" })).toBeNull();
  });
});

describe("App deposit modal without a wallet", () => {
  afterEach(() => {
    cleanup();
  });

  it("prompts to install Freighter instead of offering approval", async () => {
    walletMocks.isWalletAvailable.mockResolvedValue(false);
    renderDepositModal();

    expect(await screen.findByRole("link", { name: "Install Freighter" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Approve deposit transaction" })).toBeNull();
  });
});

describe("USDC trustline step (#1316)", () => {
  afterEach(() => { cleanup(); });

  function mockMissingTrustline() {
    walletMocks.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ sequence: "123", balances: [] }) });
  }

  it("replaces Approve with a keyboard reachable trustline action and announces the reserve", async () => {
    mockMissingTrustline();
    renderDepositModal();
    const button = await screen.findByRole("button", { name: "Add USDC trustline" });
    expect(screen.queryByRole("button", { name: "Approve deposit transaction" })).toBeNull();
    const status = document.getElementById("usdc-trustline-status");
    expect(status).toHaveAttribute("role", "status");
    expect(status).toHaveTextContent("0.5 XLM base reserve");
    expect(button).toHaveAttribute("aria-describedby", "usdc-trustline-status");
    const user = userEvent.setup();
    for (let tabs = 0; tabs < 40 && document.activeElement !== button; tabs++) await user.tab();
    expect(button).toHaveFocus();
    expect(walletMocks.submitVaultDeposit).not.toHaveBeenCalled();
  });

  it("allows Approve with a warning when the Horizon check fails", async () => {
    walletMocks.fetch.mockRejectedValue(new TypeError("Failed to fetch"));
    renderDepositModal();
    expect(await screen.findByRole("button", { name: "Approve deposit transaction" })).toBeEnabled();
    expect(screen.getByText(/Could not check your USDC trustline through Horizon/)).toBeVisible();
  });

  it.each(["testnet", "mainnet"])("shows Friendbot only on testnet (%s configuration)", async (network) => {
    walletMocks.network = network;
    walletMocks.fetch.mockResolvedValue({ ok: false, status: 404 });
    renderDepositModal();
    await screen.findByText(/This Stellar account is not funded/);
    const friendbot = screen.queryByRole("link", { name: /Fund testnet account with Friendbot/ });
    if (network === "testnet") expect(friendbot).toHaveAttribute("href", "https://friendbot.stellar.org/?addr=GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF");
    else expect(friendbot).toBeNull();
    expect(screen.queryByRole("button", { name: "Approve deposit transaction" })).toBeNull();
    mockMissingTrustline();
    fireEvent.click(screen.getByRole("button", { name: "Check USDC trustline again" }));
    expect(await screen.findByRole("button", { name: "Add USDC trustline" })).toBeEnabled();
  });

  it("adds a trustline, waits for confirmation, rechecks, then permits a deposit", async () => {
    let confirmed = false;
    walletMocks.fetch.mockImplementation(async (_url: string, options?: RequestInit) => {
      if (options?.method === "POST") {
        confirmed = true;
        return { ok: true, json: async () => ({ successful: true }) };
      }
      return { ok: true, json: async () => ({ sequence: "123", balances: confirmed ? [
        { asset_code: "USDC", asset_issuer: "GDXDZNSTNORCX4373EGGYS4Q3U3XVZMBSIMMRHG5S5GCCF7JHC7QZWAZ" },
      ] : [] }) };
    });
    renderDepositModal();
    const add = await screen.findByRole("button", { name: "Add USDC trustline" });
    const user = userEvent.setup();
    add.focus();
    await user.keyboard("{Enter}");
    const approve = await screen.findByRole("button", { name: "Approve deposit transaction" });
    expect(approve).toBeEnabled();
    expect(screen.getByText(/USDC trustline ready/)).toBeVisible();
    expect(walletMocks.signTransaction).toHaveBeenCalledOnce();
    walletMocks.submitVaultDeposit.mockResolvedValue({ hash: "A".repeat(64) });
    fireEvent.click(approve);
    await screen.findByText("Your updated vault balance is 334.62 USDC and ready for usage.");
  });

  it("returns to the trustline step without an error when a signature is rejected", async () => {
    mockMissingTrustline();
    walletMocks.signTransaction.mockResolvedValue({ error: { code: 4001, message: "User rejected signature" } });
    renderDepositModal();
    fireEvent.click(await screen.findByRole("button", { name: "Add USDC trustline" }));
    await screen.findByText(/Trustline signature cancelled/);
    expect(screen.getByRole("button", { name: "Add USDC trustline" })).toBeEnabled();
    expect(screen.queryByText("Transaction failed")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps the modal busy until Horizon responds and supports retry after a submission failure", async () => {
    mockMissingTrustline();
    let reject!: (error: Error) => void;
    const accountResponse = { ok: true, json: async () => ({ sequence: "123", balances: [] }) };
    walletMocks.fetch.mockImplementation(async (_url: string, options?: RequestInit) => options?.method === "POST"
      ? new Promise((_resolve, rejectPromise) => { reject = rejectPromise; }) : accountResponse);
    renderDepositModal();
    fireEvent.click(await screen.findByRole("button", { name: "Add USDC trustline" }));
    await waitFor(() => expect(reject).toBeDefined());
    expect(screen.getByRole("button", { name: "Adding USDC trustline..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    await act(async () => { reject(new Error("connection lost")); });
    expect(screen.getByRole("button", { name: "Add USDC trustline" })).toBeEnabled();
    expect(screen.getByText(/Could not confirm the USDC trustline/)).toBeVisible();
  });

  it("returns to the appropriate step if the wallet changes before deposit simulation", async () => {
    const { WalletServiceError } = await import("./services/walletService");
    walletMocks.submitVaultDeposit.mockRejectedValue(new WalletServiceError("TRUSTLINE_MISSING", "Add trustline"));
    renderDepositModal();
    const approve = await screen.findByRole("button", { name: "Approve deposit transaction" });
    mockMissingTrustline();
    fireEvent.click(approve);
    expect(await screen.findByRole("button", { name: "Add USDC trustline" })).toBeEnabled();
    expect(screen.queryByText("Transaction failed")).toBeNull();
  });

  it("offers reconnection without an error when wallet access is cancelled", async () => {
    walletMocks.getWalletAddress.mockRejectedValueOnce({ code: "SIGNATURE_REJECTED" });
    renderDepositModal();
    fireEvent.click(await screen.findByRole("button", { name: "Connect Freighter" }));
    expect(await screen.findByRole("button", { name: "Approve deposit transaction" })).toBeEnabled();
  });
});
