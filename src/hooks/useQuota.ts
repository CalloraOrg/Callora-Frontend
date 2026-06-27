import { useCallback, useEffect, useState } from 'react';

const DISMISS_KEY = 'callora-plan-nudge-dismissed-at';
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface UseQuotaReturn {
  usagePercent: number;
  isDismissed: boolean;
  dismiss: () => void;
}

/**
 * Tracks plan quota usage percentage and manages a 24-hour dismissal
 * state persisted in localStorage.
 *
 * @param usagePercent - Current quota usage as a number from 0–100.
 */
export function useQuota(usagePercent: number): UseQuotaReturn {
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (!raw) return false;
      const dismissedAt = parseInt(raw, 10);
      return !isNaN(dismissedAt) && Date.now() - dismissedAt < DISMISS_TTL_MS;
    } catch {
      return false;
    }
  });

  // Re-evaluate the 24-hour window on mount in case the TTL expired between
  // page loads without a storage event.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (!raw) {
        setIsDismissed(false);
        return;
      }
      const dismissedAt = parseInt(raw, 10);
      const stillValid = !isNaN(dismissedAt) && Date.now() - dismissedAt < DISMISS_TTL_MS;
      setIsDismissed(stillValid);

      if (!stillValid) {
        localStorage.removeItem(DISMISS_KEY);
      }
    } catch {
      // localStorage unavailable – treat as not dismissed
    }
  }, []);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // localStorage unavailable – dismiss only for this session
    }
    setIsDismissed(true);
  }, []);

  return { usagePercent, isDismissed, dismiss };
}
