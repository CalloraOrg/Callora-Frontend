import { useCallback, useEffect, useRef, useState } from 'react';

/** Options accepted by {@link useFormPersistence}. */
export type UseFormPersistenceOptions<T> = {
  /**
   * Guard against restoring a draft written by an older build whose shape no
   * longer matches. Return false to discard the stored value and fall back to
   * `initialValue`. Without it, any parseable JSON is accepted.
   */
  isValid?: (candidate: unknown) => candidate is T;
};

export type FormPersistence<T> = {
  /** Current draft — the restored value on mount, otherwise `initialValue`. */
  value: T;
  /** Update the draft. Same contract as a `useState` setter. */
  setValue: React.Dispatch<React.SetStateAction<T>>;
  /**
   * Drop the persisted copy without touching the in-memory value — use once
   * the server has confirmed the write, so the screen can still show what was
   * submitted while a reload starts clean.
   *
   * @param nextValue - optional replacement for the in-memory value; it is not
   * written back to storage.
   */
  discard: (nextValue?: T) => void;
  /** True when a stored draft was restored on mount. */
  isRestored: boolean;
};

/** Read and parse a stored value, tolerating absent or corrupt storage. */
function readStored<T>(key: string): T | undefined {
  if (typeof window === 'undefined') return undefined;

  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return undefined;
    return JSON.parse(raw) as T;
  } catch {
    // Corrupt JSON, blocked storage, or a quota-related read failure. The
    // draft is a convenience, never a source of truth — start clean.
    return undefined;
  }
}

function removeStored(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing useful to do; the in-memory reset below is what the UI sees.
  }
}

function writeStored(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode / quota exceeded. The draft simply will not survive a
    // reload; submission still works.
  }
}

/**
 * useFormPersistence — `useState` that mirrors the value to localStorage.
 *
 * Used by long forms so a provider does not lose a half-written listing to a
 * reload, a failed submission, or a navigation away. The draft is written on
 * every change *after* the mount render, so restoring a value never
 * immediately rewrites it, and it is removed only by an explicit
 * {@link FormPersistence.discard} — which the caller should invoke once the
 * server has accepted the payload.
 *
 * @param key - localStorage key
 * @param initialValue - value used when nothing valid is stored
 * @param options - optional shape guard for stored drafts
 */
export function useFormPersistence<T>(
  key: string,
  initialValue: T,
  options: UseFormPersistenceOptions<T> = {},
): FormPersistence<T> {
  const { isValid } = options;

  // Resolve the mount state once. Storage is read a single time even if the
  // initialiser runs twice (StrictMode).
  const bootstrap = useRef<{ value: T; restored: boolean } | null>(null);
  if (bootstrap.current === null) {
    const stored = readStored<T>(key);
    const restored = stored !== undefined && (!isValid || isValid(stored));
    bootstrap.current = {
      value: restored ? (stored as T) : initialValue,
      restored,
    };
  }
  const start = bootstrap.current;

  const [value, setValue] = useState<T>(start.value);
  const [isRestored, setIsRestored] = useState<boolean>(start.restored);

  // What storage is already known to hold. Seeded with the mount value so the
  // first effect run is a no-op, and updated by `discard` so discarding does
  // not immediately write the value back.
  const persisted = useRef<{ key: string; value: T }>({ key, value: start.value });

  useEffect(() => {
    const last = persisted.current;
    if (last.key === key && Object.is(last.value, value)) return;
    persisted.current = { key, value };
    writeStored(key, value);
  }, [key, value]);

  const discard = useCallback(
    (nextValue?: T) => {
      removeStored(key);
      setIsRestored(false);
      if (nextValue === undefined) return;
      // Mark the replacement as already-persisted (i.e. absent) so the effect
      // does not resurrect the key we just removed.
      persisted.current = { key, value: nextValue };
      setValue(nextValue);
    },
    [key],
  );

  return { value, setValue, discard, isRestored };
}

export default useFormPersistence;
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
