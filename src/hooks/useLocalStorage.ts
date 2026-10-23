import { useState, useEffect, useCallback } from "react";

export const LOCAL_STORAGE_SYNC_EVENT = "callora.local-storage-sync";

interface LocalStorageSyncDetail {
  key: string;
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void] {
  // Get from local storage then parse stored JSON
  const readValue = (): T => {
    if (typeof window === "undefined") {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  };

  const [storedValue, setStoredValue] = useState<T>(readValue);

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const valueToStore =
          value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
          // Notify other hook instances in the same tab.
          window.dispatchEvent(
            new CustomEvent<LocalStorageSyncDetail>(
              LOCAL_STORAGE_SYNC_EVENT,
              { detail: { key } }
            )
          );
        }
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, storedValue]
  );

  useEffect(() => {
    setStoredValue(readValue());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== key) {
        return;
      }

      if (event.newValue === null) {
        setStoredValue(initialValue);
        return;
      }

      try {
        setStoredValue(JSON.parse(event.newValue) as T);
      } catch (error) {
        console.warn(
          `Error parsing storage event for localStorage key "${key}":`,
          error
        );
      }
    };

    const handleSync = (event: Event) => {
      const customEvent = event as CustomEvent<LocalStorageSyncDetail>;
      if (customEvent.detail?.key !== key) {
        return;
      }

      try {
        const item = window.localStorage.getItem(key);
        setStoredValue(item ? (JSON.parse(item) as T) : initialValue);
      } catch (error) {
        console.warn(
          `Error syncing localStorage key "${key}":`,
          error
        );
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(LOCAL_STORAGE_SYNC_EVENT, handleSync);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(LOCAL_STORAGE_SYNC_EVENT, handleSync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return [storedValue, setValue];
}
