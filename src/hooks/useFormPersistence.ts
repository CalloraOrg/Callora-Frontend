import { useEffect, useCallback, useRef, useState } from 'react';

/**
 * useFormPersistence — Automatically persists form state to localStorage.
 *
 * Designed to preserve unsaved form data across session expiry, page reloads,
 * and accidental navigations. Data is persisted on every state change and can
 * be restored on mount or cleared after successful submission.
 *
 * @param key     - localStorage key (e.g. "callora:publish-form:draft")
 * @param data    - The current form state to persist
 * @param setter  - React setState setter to restore data into
 * @param options - Optional configuration
 *
 * Features:
 * - SSR-safe: checks typeof window !== 'undefined'
 * - Gracefully handles localStorage errors (private mode, quota exceeded)
 * - Restores data on mount if available
 * - Provides `clearDraft` to remove persisted data after submission
 * - Tracks whether data has been modified since last save
 */
export interface UseFormPersistenceOptions {
  /** Whether to auto-restore from localStorage on mount. Default: true */
  restoreOnMount?: boolean;
  /** Debounce interval in ms for saves. Default: 300 */
  debounceMs?: number;
}

export interface UseFormPersistenceReturn<T> {
  /** Remove persisted draft from localStorage */
  clearDraft: () => void;
  /** Whether a draft was restored on mount */
  wasRestored: boolean;
  /** Whether there is persisted data available */
  hasDraft: boolean;
}

export function useFormPersistence<T extends Record<string, unknown>>(
  key: string,
  data: T,
  setter: React.Dispatch<React.SetStateAction<T>>,
  options: UseFormPersistenceOptions = {},
): UseFormPersistenceReturn<T> {
  const { restoreOnMount = true, debounceMs = 300 } = options;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoredRef = useRef(false);
  const [wasRestored, setWasRestored] = useState(false);

  // ── Restore on mount ───────────────────────────────────────────────────
  useEffect(() => {
    if (!restoreOnMount || restoredRef.current) return;
    restoredRef.current = true;

    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) {
        const parsed = JSON.parse(stored) as T;
        setter(parsed);
        setWasRestored(true);
      }
    } catch {
      // Silently fail — corrupted draft is not fatal
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // ── Auto-save on change (debounced) ────────────────────────────────────
  useEffect(() => {
    if (!restoredRef.current) return; // Don't save before first restore

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      if (typeof window === 'undefined') return;
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch {
        // Silently fail — localStorage may be unavailable
      }
    }, debounceMs);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [key, data, debounceMs]);

  // ── Clear draft ────────────────────────────────────────────────────────
  const clearDraft = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(key);
    } catch {
      // Silently fail
    }
  }, [key]);

  // ── Check if draft exists ──────────────────────────────────────────────
  const hasDraft = (() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(key) !== null;
    } catch {
      return false;
    }
  })();

  return {
    clearDraft,
    wasRestored,
    hasDraft,
  };
}
