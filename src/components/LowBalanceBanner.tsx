import { useState, useEffect } from 'react';
import { LOW_BALANCE_USD, PRESET_AMOUNTS } from '../config/constants';
import { WarningIcon } from './icons/WarningIcon';
import { formatUsdShortcut } from '../utils/format';

interface LowBalanceBannerProps {
  balance: number;
  openDeposit: (presetAmount?: number) => void;
}

const QUICK_TOPUP_AMOUNTS: readonly number[] = [25, 50, 100];

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
      <div className="low-balance-banner__actions">
        <div className="low-balance-banner__quick-presets" role="group" aria-label="Quick buffer top-up amounts">
          {QUICK_TOPUP_AMOUNTS.map((amount) => (
            <button
              key={amount}
              type="button"
              className="low-balance-banner__preset"
              onClick={() => handleQuickTopUp(amount)}
              aria-label={`Top up buffer with ${formatUsdShortcut(amount)}`}
            >
              +{formatUsdShortcut(amount)}
            </button>
          ))}
          <button
            type="button"
            className="low-balance-banner__preset low-balance-banner__preset--secondary"
            onClick={() => handleQuickTopUp(PRESET_AMOUNTS[PRESET_AMOUNTS.length - 1])}
            aria-label={`Top up buffer with ${formatUsdShortcut(PRESET_AMOUNTS[PRESET_AMOUNTS.length - 1])}`}
          >
            +{formatUsdShortcut(PRESET_AMOUNTS[PRESET_AMOUNTS.length - 1])}
          </button>
        </div>
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
