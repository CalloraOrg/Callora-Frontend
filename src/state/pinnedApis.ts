/**
 * pinnedApis.ts
 *
 * External store for pinned API IDs.
 * Uses useSyncExternalStore (same pattern as compareStore).
 * Persists to localStorage under "callora_pinned_apis".
 *
 * Usage:
 *   const pinned = usePinnedApis();          // Set<string>
 *   pinnedApisStore.pin("weather-001");
 *   pinnedApisStore.unpin("weather-001");
 *   pinnedApisStore.toggle("weather-001");
 *   pinnedApisStore.isPinned("weather-001"); // boolean
 */

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "callora_pinned_apis";

// ─── Internal state ───────────────────────────────────────────────────────────

let state: Set<string> = new Set();

try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) state = new Set(parsed);
  }
} catch {
  // Corrupt storage – start fresh
}

const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...state]));
  } catch {
    // Storage quota exceeded – ignore
  }
}

function emitChange() {
  for (const listener of listeners) listener();
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const pinnedApisStore = {
  pin(apiId: string): void {
    if (state.has(apiId)) return;
    state = new Set([...state, apiId]);
    persist();
    emitChange();
  },

  unpin(apiId: string): void {
    if (!state.has(apiId)) return;
    state = new Set([...state].filter((id) => id !== apiId));
    persist();
    emitChange();
  },

  toggle(apiId: string): void {
    state.has(apiId)
      ? pinnedApisStore.unpin(apiId)
      : pinnedApisStore.pin(apiId);
  },

  isPinned(apiId: string): boolean {
    return state.has(apiId);
  },

  /** For testing: reset store to empty (does not touch localStorage). */
  _reset(): void {
    state = new Set();
    emitChange();
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    // Cross-tab sync
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            state = new Set(parsed);
            emitChange();
          }
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  },

  getSnapshot(): Set<string> {
    return state;
  },
};

// ─── Hook ────────────────────────────────────────────────────────────────────

/** Returns the current Set of pinned API IDs. Triggers re-render on change. */
export function usePinnedApis(): Set<string> {
  return useSyncExternalStore(
    pinnedApisStore.subscribe,
    pinnedApisStore.getSnapshot,
    pinnedApisStore.getSnapshot
  );
}
