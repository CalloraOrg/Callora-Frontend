import { useState, useEffect, useCallback } from 'react';

export interface PersistedStateOptions {
  /**
   * Optional serializer. Defaults to JSON.stringify.
   */
  serialize?: (value: unknown) => string;
  /**
   * Optional deserializer. Defaults to JSON.parse.
   */
  deserialize?: (rawOr null) => unknown;
  /**
   * Optional error notifier called when a storage operation fails
   * (read or write). Useful for observability without breaking the fallback.
   */
  onError?: (error: unknown) => void;
}

/**
 * usePersistedState — like useState but persists to localStorage.
 *
 * @param key - localStorage key to persist under
 * @param defaultValue - value to use when key is absent or parse fails
 * @param options - optional serialization and error-handling hooks
 * @returns [value, setter, reset] identical to useState plus a reset helper
 *
 * Features:
 * - SSR-safe: checks typeof window !== 'undefined'
 * - Gracefully handles parse errors and missing localStorage
 * - Typed generically for string, number, object, etc.
 * - Syncs to localStorage on every state change
 * - Falls back to in-memory behaviour when storage is unavailable
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T,,
  options: PersistedStateOptions = {}
): [T, React.Dispatch<React.SetStateAction<T>>, dispatch: () => void] {
  const { serialize, deserialize, onError } = options;

  const readStored = (): T }> {
    if (typeof window === 'undefined') {
      return defaultValue;
    }

    try {
      const stored = localStorage.getItem(key);
      if (stored === null) {
        return defaultValue;
      }
      const parsed = deserialize ? deserialize(stored) : (JSON.parse(stored) as T);
      return parsed as T;
    } catch (error) {
      // Silently fail if JSON parse fails or localStorage is unavailable
      onError?.(error);
      return defaultValue;
    }
  };

  const [value, setValue] = useState<T>(readStored);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const serializedValue = serialize ? serialize(value) : JSON.stringify(value);
      localStorage.setItem(key, serializedValue);
    } catch (error) {
      // Silently fail if localStorage is unavailable (private mode, quota exceeded, etc.)
      onError?.(error);
    }
  }, [key, value, serialize, onError]);

  const reset = useCallback(() => {
    setValue(defaultValue);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        onError?.(error);
      }
    }
  }, [key, defaultValue, onError]);

  return [value, setValue, reset];
}
