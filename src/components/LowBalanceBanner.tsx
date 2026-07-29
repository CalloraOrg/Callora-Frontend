import { useState, useEffect, useMemo } from 'react';
import { LOW_BALANCE_USD } from '../config/constants';
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
export default function LowBalanceBanner({ balance, openDeposit }: LowBalanceBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const isDismissed = sessionStorage.getItem('lowBalanceBannerDismissed') === 'true';
    if (isDismissed) {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem('lowBalanceBannerDismissed', 'true');
    setDismissed(true);
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

  if (dismissed || balance >= LOW_BALANCE_USD) {
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
