/**
 * collectionsStore.tsx
 *
 * Collections state management via React context + useReducer.
 * Persists to localStorage under the key "callora_collections:<accountId>"
 * (or "callora_collections:anonymous" when no account is active).
 *
 * On first load after the upgrade, any data stored under the legacy global key
 * "callora_collections" is migrated into the first account that opens the app.
 *
 * Usage:
 *   - Wrap your app (or the relevant subtree) with <CollectionsProvider>
 *     (must be a descendant of <AccountProvider> so account changes are visible)
 *   - Call useCollections() in any child component
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
} from "react";
import { useAccountId } from "../hooks/useAccount";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Collection {
  id: string;
  name: string;
  endpointIds: string[];
}

export interface CollectionsState {
  collections: Collection[];
}

// ─── Actions ─────────────────────────────────────────────────────────────────

type Action =
  | { type: "CREATE_COLLECTION"; name: string }
  | { type: "RENAME_COLLECTION"; id: string; name: string }
  | { type: "DELETE_COLLECTION"; id: string }
  | { type: "ADD_ENDPOINT"; collectionId: string; endpointId: string }
  | { type: "REMOVE_ENDPOINT"; collectionId: string; endpointId: string }
  | { type: "IMPORT_COLLECTIONS"; collections: Collection[] }
  | { type: "REORDER_COLLECTIONS"; fromIndex: number; toIndex: number }
  | {
      type: "REORDER_ENDPOINTS";
      collectionId: string;
      fromIndex: number;
      toIndex: number;
    }
  | { type: "CREATE_COLLECTION_WITH_ENDPOINT"; name: string; endpointId: string }
  /** Internal: wholesale replace state when the active account changes. */
  | { type: "LOAD_STATE"; state: CollectionsState };
// ─── Storage keys ─────────────────────────────────────────────────────────────

/** Legacy key written before per-account scoping was introduced. */
export const LEGACY_STORAGE_KEY = "callora_collections";

/** Returns the localStorage key for a given account id (or anonymous). */
export function storageKey(accountId: string | null): string {
  return `callora_collections:${accountId ?? "anonymous"}`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateId(): string {
  return `col_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function reorder<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

function loadFromStorage(accountId: string | null): CollectionsState {
  const key = storageKey(accountId);
  try {
    // Load from the per-account key first.
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as CollectionsState;
      if (Array.isArray(parsed.collections)) {
        return parsed;
      }
    }

    // One-time legacy migration: if the per-account key is absent but the
    // global legacy key has data, adopt it and remove the legacy key.
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw) as CollectionsState;
      if (Array.isArray(parsed.collections) && parsed.collections.length > 0) {
        // Write to the per-account key so subsequent loads are fast.
        try {
          localStorage.setItem(key, legacyRaw);
          localStorage.removeItem(LEGACY_STORAGE_KEY);
        } catch {
          // Storage quota – best effort.
        }
        return parsed;
      }
      // Legacy key is present but empty: clean it up and start fresh.
      try { localStorage.removeItem(LEGACY_STORAGE_KEY); } catch { /* ignore */ }
    }
  } catch {
    // Corrupt JSON – start fresh.
  }
  return { collections: [] };
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

/** Exported for unit testing. Prefer the context helpers in application code. */
export function reducer(state: CollectionsState, action: Action): CollectionsState {
  switch (action.type) {
    case "CREATE_COLLECTION": {
      const newCol: Collection = {
        id: generateId(),
        name: action.name.trim() || "Untitled Collection",
        endpointIds: [],
      };
      return { ...state, collections: [...state.collections, newCol] };
    }

    case "RENAME_COLLECTION":
      return {
        ...state,
        collections: state.collections.map((c) =>
          c.id === action.id
            ? { ...c, name: action.name.trim() || c.name }
            : c
        ),
      };

    case "DELETE_COLLECTION":
      return {
        ...state,
        collections: state.collections.filter((c) => c.id !== action.id),
      };

    case "ADD_ENDPOINT":
      return {
        ...state,
        collections: state.collections.map((c) =>
          c.id === action.collectionId && !c.endpointIds.includes(action.endpointId)
            ? { ...c, endpointIds: [...c.endpointIds, action.endpointId] }
            : c
        ),
      };

    case "REMOVE_ENDPOINT":
      return {
        ...state,
        collections: state.collections.map((c) =>
          c.id === action.collectionId
            ? {
                ...c,
                endpointIds: c.endpointIds.filter(
                  (id) => id !== action.endpointId
                ),
              }
            : c
        ),
      };

    case "IMPORT_COLLECTIONS": {
      const existingIds = new Set(state.collections.map((c) => c.id));
      const incoming = action.collections.filter(
        (c) => !existingIds.has(c.id)
      );
      if (incoming.length === 0) return state;
      return {
        ...state,
        collections: [...state.collections, ...incoming],
      };
    }

    case "REORDER_COLLECTIONS":
      return {
        ...state,
        collections: reorder(
          state.collections,
          action.fromIndex,
          action.toIndex
        ),
      };

    case "REORDER_ENDPOINTS":
      return {
        ...state,
        collections: state.collections.map((c) => {
          if (c.id !== action.collectionId) return c;
          return {
            ...c,
            endpointIds: reorder(
              c.endpointIds,
              action.fromIndex,
              action.toIndex
            ),
          };
        }),
      };

    case "CREATE_COLLECTION_WITH_ENDPOINT": {
      const newCol: Collection = {
        id: generateId(),
        name: action.name.trim() || "Untitled Collection",
        endpointIds: [action.endpointId],
      };
      return { ...state, collections: [...state.collections, newCol] };
    }

    case "LOAD_STATE":
      return action.state;

    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface CollectionsContextType extends CollectionsState {
  createCollection: (name: string) => void;
  createCollectionWithEndpoint: (name: string, endpointId: string) => void;
  renameCollection: (id: string, name: string) => void;
  deleteCollection: (id: string) => void;
  addEndpointToCollection: (collectionId: string, endpointId: string) => void;
  removeEndpointFromCollection: (
    collectionId: string,
    endpointId: string
  ) => void;
  importCollections: (collections: Collection[]) => void;
  reorderCollections: (fromIndex: number, toIndex: number) => void;
  reorderEndpointsInCollection: (
    collectionId: string,
    fromIndex: number,
    toIndex: number
  ) => void;
  /** True if the given endpointId is saved in at least one collection */
  isEndpointSaved: (endpointId: string) => boolean;
  /** Returns a Set of collectionIds that contain the given endpointId */
  collectionIdsForEndpoint: (endpointId: string) => Set<string>;
  /** Total count of distinct saved endpoint IDs across all collections */
  totalSavedCount: number;
}

const CollectionsContext = createContext<CollectionsContextType | undefined>(
  undefined
);

// ─── Provider ────────────────────────────────────────────────────────────────

export function CollectionsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const accountId = useAccountId();
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    loadFromStorage(accountId),
  );

  // Reload state when the active account changes.
  const prevAccountIdRef = useRef(accountId);
  useEffect(() => {
    if (prevAccountIdRef.current !== accountId) {
      prevAccountIdRef.current = accountId;
      dispatch({ type: "LOAD_STATE", state: loadFromStorage(accountId) });
    }
  }, [accountId]);

  // Persist to localStorage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey(accountId), JSON.stringify(state));
    } catch {
      // Storage quota exceeded – ignore silently
    }
  }, [state, accountId]);

  const createCollection = (name: string) =>
    dispatch({ type: "CREATE_COLLECTION", name });

  const renameCollection = (id: string, name: string) =>
    dispatch({ type: "RENAME_COLLECTION", id, name });

  const deleteCollection = (id: string) =>
    dispatch({ type: "DELETE_COLLECTION", id });

  const addEndpointToCollection = (
    collectionId: string,
    endpointId: string
  ) => dispatch({ type: "ADD_ENDPOINT", collectionId, endpointId });

  const createCollectionWithEndpoint = (
    name: string,
    endpointId: string
  ) => dispatch({
    type: "CREATE_COLLECTION_WITH_ENDPOINT",
    name,
    endpointId,
  });

  const removeEndpointFromCollection = (
    collectionId: string,
    endpointId: string
  ) => dispatch({ type: "REMOVE_ENDPOINT", collectionId, endpointId });

  const importCollections = (collections: Collection[]) =>
    dispatch({ type: "IMPORT_COLLECTIONS", collections });

  const reorderCollections = (fromIndex: number, toIndex: number) =>
    dispatch({ type: "REORDER_COLLECTIONS", fromIndex, toIndex });

  const reorderEndpointsInCollection = (
    collectionId: string,
    fromIndex: number,
    toIndex: number
  ) =>
    dispatch({
      type: "REORDER_ENDPOINTS",
      collectionId,
      fromIndex,
      toIndex,
    });

  const isEndpointSaved = (endpointId: string) =>
    state.collections.some((c) => c.endpointIds.includes(endpointId));

  const collectionIdsForEndpoint = (endpointId: string): Set<string> =>
    new Set(
      state.collections
        .filter((c) => c.endpointIds.includes(endpointId))
        .map((c) => c.id)
    );

  const allSaved = new Set(state.collections.flatMap((c) => c.endpointIds));
  const totalSavedCount = allSaved.size;

  return (
    <CollectionsContext.Provider
      value={{
        ...state,
        createCollection,
        createCollectionWithEndpoint,
        renameCollection,
        deleteCollection,
        addEndpointToCollection,
        removeEndpointFromCollection,
        importCollections,
        reorderCollections,
        reorderEndpointsInCollection,
        isEndpointSaved,
        collectionIdsForEndpoint,
        totalSavedCount,
      }}
    >
      {children}
    </CollectionsContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useCollections(): CollectionsContextType {
  const ctx = useContext(CollectionsContext);
  if (!ctx) {
    throw new Error("useCollections must be used within a CollectionsProvider");
  }
  return ctx;
}
