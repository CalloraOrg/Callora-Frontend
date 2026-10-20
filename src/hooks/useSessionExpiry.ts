import { useCallback, useSyncExternalStore } from 'react';
import {
  clearSessionExpiry,
  getSessionExpiry,
  subscribeSessionExpiry,
  type SessionExpiryEvent,
} from '../services/sessionExpiry';

export type UseSessionExpiry = {
  /** Current expiry event, or null while the session is valid. */
  event: SessionExpiryEvent | null;
  isExpired: boolean;
  reason: SessionExpiryEvent['reason'] | undefined;
  /** Clear the expired state and hide any banner. */
  dismiss: () => void;
};

/**
 * useSessionExpiry — subscribe to app-wide session expiry.
 *
 * Session state lives in a module-level store outside React, so it is read
 * through `useSyncExternalStore`; that keeps the value consistent across
 * concurrent renders and avoids a tearing read between banner and caller.
 *
 * @example
 * const { isExpired, dismiss } = useSessionExpiry();
 * return isExpired ? <SessionExpiryBanner onDismiss={dismiss} /> : null;
 */
export function useSessionExpiry(): UseSessionExpiry {
  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeSessionExpiry(onStoreChange),
    [],
  );
  const getSnapshot = useCallback(() => getSessionExpiry(), []);

  const event = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    event,
    isExpired: event !== null,
    reason: event?.reason,
    dismiss: clearSessionExpiry,
  };
}

export default useSessionExpiry;
