import { useSyncExternalStore } from "react";
import { QuotaState, QuotaStore, quotaStore } from "../state/quotaStore";

/**
 * Subscribe to the quota store. Pass a specific store instance (e.g. in tests)
 * or omit to use the shared singleton.
 */
export function useQuotaStore(store: QuotaStore = quotaStore): QuotaState {
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
}
