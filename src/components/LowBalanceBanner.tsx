import { useState, useEffect } from 'react';
import { LOW_BALANCE_USD } from '../config/constants';

interface LowBalanceBannerProps {
  balance: number;
  openDeposit: () => void;
}

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

  if (dismissed || balance >= LOW_BALANCE_USD) {
    return null;
  }

  return (
    <div className="low-balance-banner" role="status" aria-live="polite">
      <div className="low-balance-banner__content">
        <span className="low-balance-banner__icon" aria-hidden="true">⚠️</span>
        <div className="low-balance-banner__text">
          <strong>Low balance warning:</strong> Your vault balance is below <span className="tabular-nums">{LOW_BALANCE_USD} USDC</span>. Add funds to prevent API disruption.
        </div>
      </div>
      <div className="low-balance-banner__actions">
        <button className="primary-button" onClick={openDeposit}>
          Deposit USDC
        </button>
        <button className="ghost-button" onClick={handleDismiss} aria-label="Dismiss warning">
          Dismiss
        </button>
      </div>
    </div>
  );
}
