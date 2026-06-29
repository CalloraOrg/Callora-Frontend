import { useSyncExternalStore } from "react";
import type { APIItem } from "../data/mockApis";

type CompareState = {
  apis: APIItem[];
  isOpen: boolean;
};

const STORAGE_KEY = "callora_compare_state";

let state: CompareState = {
  apis: [],
  isOpen: false,
};

try {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    state = JSON.parse(stored);
  }
} catch (e) {
  console.warn("Failed to read compare state from local storage", e);
}

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export const compareStore = {
  addApi(api: APIItem) {
    if (state.apis.length >= 3) return;
    if (state.apis.some((item) => item.id === api.id)) return;

    state = {
      ...state,
      apis: [...state.apis, api],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    emitChange();
  },
  removeApi(apiId: string) {
    state = {
      ...state,
      apis: state.apis.filter((item) => item.id !== apiId),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    emitChange();
  },
  setOpen(open: boolean) {
    state = {
      ...state,
      isOpen: open,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    emitChange();
  },
  clear() {
    state = {
      apis: [],
      isOpen: false,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    emitChange();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    // Listen to cross-tab changes
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        state = JSON.parse(e.newValue);
        emitChange();
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  },
  getSnapshot() {
    return state;
  },
};

export function useCompareStore() {
  return useSyncExternalStore(
    compareStore.subscribe,
    compareStore.getSnapshot,
    compareStore.getSnapshot
  );
}
