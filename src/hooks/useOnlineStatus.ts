import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

export interface UseOnlineStatusResult {
  /** Whether the browser currently reports a network connection. */
  isOnline: boolean;
  /** Timestamp of the most recent offline -> online transition, or null. */
  lastReconnectedAt: number | null;
}

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('online', onStoreChange);
  window.addEventListener('offline', onStoreChange);
  return () => {
    window.removeEventListener('online', onStoreChange);
    window.removeEventListener('offline', onStoreChange);
  };
}

function getSnapshot(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

function getServerSnapshot(): boolean {
  return true;
}

/**
 * useOnlineStatus — track browser connectivity through the `online` and
 * `offline` window events.
 *
 * The current value is read with `useSyncExternalStore` so every consumer sees
 * the same snapshot. `lastReconnectedAt` only changes on an actual
 * offline -> online transition; mounting while online leaves it null, which
 * lets callers distinguish a reconnect from the initial load.
 */
export function useOnlineStatus(): UseOnlineStatusResult {
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [lastReconnectedAt, setLastReconnectedAt] = useState<number | null>(null);
  const wasOnlineRef = useRef(isOnline);

  useEffect(() => {
    const wasOnline = wasOnlineRef.current;
    wasOnlineRef.current = isOnline;
    if (!wasOnline && isOnline) {
      setLastReconnectedAt(Date.now());
    }
  }, [isOnline]);

  return { isOnline, lastReconnectedAt };
}

export default useOnlineStatus;
