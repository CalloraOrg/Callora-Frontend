/**
 * WithdrawModal.tsx
 *
 * Modal for withdrawing USDC from the Callora Soroban vault.
 * Mirrors the deposit flow structure but uses submitVaultWithdraw.
 *
 * Assumption: vault exposes `withdraw(to: Address, amount: i128)`.
 *
 * Keyboard accessible, focus-trapped, announces status changes.
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { buildExplorerLink } from "../app/deposit";
import { formatUsdcStroops } from "../utils/format";
import type { WalletServiceErrorCode } from "../services/walletService";

// ─── Types ───────────────────────────────────────────────────────────────────

export type WithdrawStage = "input" | "approving" | "pending" | "confirmed" | "failed";

type WalletServiceFailure = Error & {
  contractErrorCode?: number;
  code: WalletServiceErrorCode;
  requiresReconciliation: boolean;
};

function isWalletServiceError(error: unknown): error is WalletServiceFailure {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof (error as WalletServiceFailure).code === "string"
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STELLAR_USDC_DECIMALS = 7;

/** Convert a USDC decimal string to stroops bigint, or null on bad input. */
function usdcToStroops(amount: string): bigint | null {
  const trimmed = amount.trim();
  const pattern = new RegExp(`^\\d+(?:\\.\\d{0,${STELLAR_USDC_DECIMALS}})?$`);
  if (!pattern.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  const scale = 10n ** BigInt(STELLAR_USDC_DECIMALS);
  return BigInt(whole) * scale + BigInt(fraction.padEnd(STELLAR_USDC_DECIMALS, "0"));
}

function formatUsdc(amount: number): string {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 7 });
}

/** Truncate a decimal string to at most 7 decimal places. */
function truncateDecimals(value: string, decimals = STELLAR_USDC_DECIMALS): string {
  const [whole, fraction = ""] = value.split(".");
  if (!fraction) return whole;
  return `${whole}.${fraction.slice(0, decimals)}`;
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface WithdrawModalProps {
  /** Vault balance in stroops. */
  vaultStroops: bigint | null;
  /** Called after a confirmed withdrawal so the parent can refresh balances. */
  onRefreshBalances: () => void;
  /** Show a success toast with the explorer link. */
  onShowSuccessToast: (message: string) => void;
  /** Close the modal. */
  onClose: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function WithdrawModal({
  vaultStroops,
  onRefreshBalances,
  onShowSuccessToast,
  onClose,
}: WithdrawModalProps) {
  const [stage, setStage] = useState<WithdrawStage>("input");
  const [amountInput, setAmountInput] = useState("");
  const [txHash, setTxHash] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [liveAnnouncement, setLiveAnnouncement] = useState("");

  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

  const isBusy = stage === "approving" || stage === "pending";

  // ── Focus management ────────────────────────────────────────────────────────

  // Move focus into the dialog on mount.
  useEffect(() => {
    amountInputRef.current?.focus();
  }, []);

  // Focus trap + Escape to close.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isBusy) {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          "button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex='-1'])",
        ),
      );
      if (focusable.length === 0) { e.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isBusy, onClose]);

  // ── Validation ──────────────────────────────────────────────────────────────

  const vaultBalance = vaultStroops !== null ? Number(vaultStroops) / 1e7 : null;
  const amountStroops = usdcToStroops(amountInput);
  const parsedAmount = amountInput.trim() ? Number(amountInput) : NaN;

  let validationMessage = "";
  if (amountInput.trim().length === 0) {
    validationMessage = "Enter a withdrawal amount.";
  } else if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    validationMessage = "Amount must be a positive number.";
  } else if (usdcToStroops(amountInput) === null) {
    validationMessage = `USDC supports up to ${STELLAR_USDC_DECIMALS} decimal places.`;
  } else if (vaultStroops !== null && amountStroops !== null && amountStroops > vaultStroops) {
    validationMessage = "Amount exceeds available vault balance.";
  }

  const hasValidAmount = validationMessage.length === 0 && amountInput.trim().length > 0;

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleMax = useCallback(() => {
    if (vaultStroops === null) return;
    const maxAmount = truncateDecimals(formatUsdcStroops(vaultStroops));
    setAmountInput(maxAmount);
  }, [vaultStroops]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(",", ".");
    setAmountInput(val);
  };

  const handleWithdraw = useCallback(async () => {
    if (!hasValidAmount || isBusy) return;

    const withdrawAmount = parsedAmount;
    setTxHash("");
    setErrorMessage("");
    setStage("approving");
    setLiveAnnouncement("Approve this USDC withdrawal in your wallet.");

    let capturedHash = "";
    try {
      const walletService = await import("../services/walletService");

      const result = await walletService.submitVaultWithdraw(amountInput, (hash) => {
        capturedHash = hash;
        setTxHash(hash);
        setStage("pending");
        setLiveAnnouncement("Withdrawal submitted to Stellar. Waiting for ledger confirmation.");
      });

      const confirmedHash = result.hash || capturedHash;
      setTxHash(confirmedHash);
      setStage("confirmed");
      setLiveAnnouncement(`Withdrawal of ${formatUsdc(withdrawAmount)} USDC confirmed.`);
      onRefreshBalances();
      onShowSuccessToast(
        `Withdrawal confirmed — ${formatUsdc(withdrawAmount)} USDC sent to your wallet. ` +
        `View on explorer: ${buildExplorerLink(confirmedHash)}`,
      );
    } catch (error) {
      const walletError = isWalletServiceError(error) ? error : null;
      setStage("failed");
      setErrorMessage(
        walletError
          ? walletError.message
          : "Could not complete the withdrawal. Check your wallet and Stellar network, then try again.",
      );
      setLiveAnnouncement("Withdrawal failed.");
    }
  }, [hasValidAmount, isBusy, parsedAmount, amountInput, onRefreshBalances, onShowSuccessToast]);

  const handleRetry = () => {
    setStage("input");
    setTxHash("");
    setErrorMessage("");
    setLiveAnnouncement("");
  };

  const explorerHref = txHash ? buildExplorerLink(txHash) : null;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    /* Backdrop */
    <div
      ref={overlayRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === overlayRef.current && !isBusy) onClose();
      }}
      aria-hidden="false"
    >
      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="withdraw-modal-title"
        style={{
          width: "100%",
          maxWidth: 480,
          background: "var(--surface-strong, rgba(17,24,46,0.98))",
          border: "1px solid var(--line-strong, rgba(169,184,255,0.28))",
          borderRadius: 16,
          boxShadow: "var(--shadow)",
          padding: 32,
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Live region for screen readers */}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}
        >
          {liveAnnouncement}
        </div>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h2 id="withdraw-modal-title" style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>
            Withdraw USDC
          </h2>
          <button
            onClick={onClose}
            disabled={isBusy}
            aria-label="Close withdrawal modal"
            style={{
              background: "none", border: "none", cursor: isBusy ? "not-allowed" : "pointer",
              color: "var(--muted)", fontSize: 20, lineHeight: 1, padding: "2px 4px", borderRadius: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* Vault balance display */}
        <div style={{ marginBottom: 20, padding: 16, background: "var(--surface-soft)", borderRadius: 10 }}>
          <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: 4 }}>Available vault balance</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
            {vaultBalance !== null ? `${formatUsdc(vaultBalance)} USDC` : "—"}
          </div>
        </div>

        {/* Input stage */}
        {(stage === "input" || stage === "failed") && (
          <>
            <div style={{ marginBottom: 16 }}>
              <label
                htmlFor="withdraw-amount"
                style={{ display: "block", fontSize: "0.85rem", color: "var(--muted)", marginBottom: 8 }}
              >
                Withdrawal amount (USDC)
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  id="withdraw-amount"
                  ref={amountInputRef}
                  type="text"
                  inputMode="decimal"
                  value={amountInput}
                  onChange={handleAmountChange}
                  placeholder="0.00"
                  aria-describedby={validationMessage ? "withdraw-validation" : undefined}
                  aria-invalid={amountInput.trim().length > 0 && !hasValidAmount}
                  style={{
                    flex: 1,
                    background: "rgba(255,255,255,0.06)",
                    border: `1px solid ${amountInput.trim().length > 0 && !hasValidAmount ? "var(--danger)" : "var(--line)"}`,
                    borderRadius: 8,
                    color: "var(--text)",
                    padding: "10px 14px",
                    fontSize: "1rem",
                    fontVariantNumeric: "tabular-nums",
                  }}
                />
                <button
                  type="button"
                  onClick={handleMax}
                  disabled={vaultStroops === null || vaultStroops === 0n}
                  className="ghost-button"
                  style={{ minWidth: 56, justifyContent: "center" }}
                >
                  Max
                </button>
              </div>
              {amountInput.trim().length > 0 && !hasValidAmount && (
                <div
                  id="withdraw-validation"
                  role="alert"
                  style={{ marginTop: 6, fontSize: "0.82rem", color: "var(--danger)" }}
                >
                  {validationMessage}
                </div>
              )}
            </div>

            {stage === "failed" && errorMessage && (
              <div
                role="alert"
                style={{
                  marginBottom: 16,
                  padding: "12px 14px",
                  background: "rgba(255,80,80,0.08)",
                  border: "1px solid rgba(255,80,80,0.3)",
                  borderRadius: 8,
                  fontSize: "0.88rem",
                  color: "var(--danger)",
                }}
              >
                {errorMessage}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={handleWithdraw}
                disabled={!hasValidAmount || vaultStroops === null || vaultStroops === 0n}
                className="primary-button"
                style={{ flex: 1 }}
              >
                {stage === "failed" ? "Retry withdrawal" : "Confirm withdrawal"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="ghost-button"
                style={{ minWidth: 80 }}
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {/* Approving stage */}
        {stage === "approving" && (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: "2rem", marginBottom: 12 }} aria-hidden="true">⏳</div>
            <p style={{ color: "var(--muted)", margin: 0 }}>
              Approve the withdrawal in Freighter…
            </p>
          </div>
        )}

        {/* Pending stage */}
        {stage === "pending" && (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: "2rem", marginBottom: 12 }} aria-hidden="true">🔄</div>
            <p style={{ color: "var(--muted)", margin: 0 }}>
              Withdrawal submitted. Waiting for Stellar confirmation…
            </p>
            {txHash && (
              <p style={{ marginTop: 8, fontSize: "0.8rem", color: "var(--muted)", fontFamily: "monospace" }}>
                {txHash.slice(0, 10)}…{txHash.slice(-8)}
              </p>
            )}
          </div>
        )}

        {/* Confirmed stage */}
        {stage === "confirmed" && (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }} aria-hidden="true">✅</div>
            <p style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: 8 }}>
              Withdrawal confirmed
            </p>
            <p style={{ color: "var(--muted)", margin: "0 0 20px" }}>
              {parsedAmount > 0 && `${formatUsdc(parsedAmount)} USDC has been sent to your wallet.`}
            </p>
            {explorerHref && (
              <a
                href={explorerHref}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "block", marginBottom: 20, color: "var(--accent)", fontSize: "0.85rem" }}
              >
                View on Stellar Explorer ↗
              </a>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={handleRetry} className="ghost-button" style={{ flex: 1 }}>
                Withdraw again
              </button>
              <button type="button" onClick={onClose} className="primary-button" style={{ flex: 1 }}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
