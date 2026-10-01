import { useState, useEffect, useMemo } from 'react';
import {
  LOW_BALANCE_USD,
  LOW_BALANCE_SNOOZE_KEY,
  LOW_BALANCE_SNOOZE_TTL_MS,
} from '../config/constants';
import { WarningIcon } from './icons/WarningIcon';
import { BoltIcon } from './icons/BoltIcon';
import { formatUsdShortcut } from '../utils/format';

interface LowBalanceBannerProps {
  balance: number;
  openDeposit: (presetAmount?: number) => void;
}

/** Buffer top-up presets offered as quick chips inside the banner. */
const QUICK_TOP_UP_AMOUNTS = [25, 50, 100, 250, 500] as const;

/**
 * LowBalanceBanner warns users when their vault balance drops below the
 * configured safety threshold. It also exposes quick top-up buttons so users
 * can replenish the buffer without leaving the dashboard or navigating the
 * full deposit modal flow.
 *
 * Part of GrantFox FWC26 (Stellar Wave) buffer top-up polish.
 */
/** Persisted snooze record: the balance seen at dismissal time plus when. */
interface BalanceSnooze {
  balance: number;
  dismissedAt: number;
}

/**
 * Reads the snooze record from localStorage. Returns null when missing,
 * malformed, or expired (expired records are removed). Never throws —
 * storage exceptions degrade to "not snoozed" so the banner still renders.
 */
function readSnooze(): BalanceSnooze | null {
  try {
    const raw = localStorage.getItem(LOW_BALANCE_SNOOZE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as BalanceSnooze).balance !== 'number' ||
      !Number.isFinite((parsed as BalanceSnooze).balance) ||
      typeof (parsed as BalanceSnooze).dismissedAt !== 'number' ||
      !Number.isFinite((parsed as BalanceSnooze).dismissedAt)
    ) {
      return null;
    }
    const snooze = parsed as BalanceSnooze;
    if (Date.now() - snooze.dismissedAt >= LOW_BALANCE_SNOOZE_TTL_MS) {
      try {
        localStorage.removeItem(LOW_BALANCE_SNOOZE_KEY);
      } catch {
        // Ignore cleanup failures — expiry alone is enough to re-show.
      }
      return null;
    }
    return snooze;
  } catch {
    return null;
  }
}

export default function LowBalanceBanner({ balance, openDeposit }: LowBalanceBannerProps) {
  const [snoozed, setSnoozed] = useState<BalanceSnooze | null>(null);

  // Re-read the snooze on mount and whenever the balance moves so the
  // banner stays hidden across route changes but reappears as soon as
  // the balance changes or the TTL expires.
  useEffect(() => {
    setSnoozed(readSnooze());
  }, [balance]);

  const handleDismiss = () => {
    const entry: BalanceSnooze = { balance, dismissedAt: Date.now() };
    try {
      localStorage.setItem(LOW_BALANCE_SNOOZE_KEY, JSON.stringify(entry));
    } catch {
      // localStorage unavailable – snooze only in memory for this mount.
    }
    setSnoozed(entry);
  };

  const handleQuickTopUp = (amount: number) => {
    openDeposit(amount);
  };

  const recommendedAmount = useMemo(() => {
    const gap = LOW_BALANCE_USD - balance;
    if (gap <= 0) return QUICK_TOP_UP_AMOUNTS[0];
    const nextPreset = QUICK_TOP_UP_AMOUNTS.find((a) => a >= gap + 10) ?? QUICK_TOP_UP_AMOUNTS[0];
    return nextPreset;
  }, [balance]);

  // Hidden while snoozed at the exact dismissed balance. Any balance
  // movement (further drop or top-up) or TTL expiry re-shows the banner.
  const isSnoozed = snoozed !== null && balance === snoozed.balance;

  if (isSnoozed || balance >= LOW_BALANCE_USD) {
    return null;
  }

  return (
    <div className="low-balance-banner" role="status" aria-live="polite">
      <div className="low-balance-banner__content">
        <span className="low-balance-banner__icon" aria-hidden="true">
          <WarningIcon size={20} />
        </span>
        <div className="low-balance-banner__text">
          <strong>Low balance warning:</strong> Your vault balance is below {formatUsdShortcut(LOW_BALANCE_USD)}. Add funds to prevent API disruption.
        </div>
      </div>

      <div className="low-balance-banner__quick-row" aria-label="Quick top-up amounts">
        {QUICK_TOP_UP_AMOUNTS.map((amount) => (
          <button
            key={amount}
            type="button"
            className={`low-balance-banner__quick-chip${amount === recommendedAmount ? ' is-recommended' : ''}`}
            onClick={() => handleQuickTopUp(amount)}
            aria-label={`Quick top up with ${amount} USDC to raise your buffer balance`}
          >
            <BoltIcon size={14} aria-hidden="true" />
            +${amount}
          </button>
        ))}
      </div>

      <div className="low-balance-banner__actions">
        <button className="primary-button" onClick={() => openDeposit()}>
          Deposit USDC
        </button>
        <button className="ghost-button" onClick={handleDismiss} aria-label="Dismiss warning">
          Dismiss
        </button>
      </div>
    </div>
  );
}
