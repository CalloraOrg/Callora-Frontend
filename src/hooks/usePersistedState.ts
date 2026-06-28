import { useState, useEffect } from 'react';

/**
 * usePersistedState — like useState but persists to localStorage.
 * 
 * @param key - localStorage key to persist under
 * @param defaultValue - value to use when key is absent or parse fails
 * @returns [value, setter] identical to useState
 * 
 * Features:
 * - SSR-safe: checks typeof window !== 'undefined'
 * - Gracefully handles parse errors and missing localStorage
 * - Typed generically for string, number, object, etc.
 * - Syncs to localStorage on every state change
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return defaultValue;
    }

    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? (JSON.parse(stored) as T) : defaultValue;
    } catch {
      // Silently fail if JSON parse fails or localStorage is unavailable
      return defaultValue;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Silently fail if localStorage is unavailable (private mode, quota exceeded, etc.)
    }
  }, [key, value]);

  return [value, setValue];
}
