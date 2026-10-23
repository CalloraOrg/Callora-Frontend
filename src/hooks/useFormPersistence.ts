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
