/**
 * collectionsStore.tsx
 *
 * Collections state management via React context + useReducer.
 * Persists to localStorage under the key "callora_collections".
 *
 * Usage:
 *   - Wrap your app (or the relevant subtree) with <CollectionsProvider>
 *   - Call useCollections() in any child component
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useReducer,
} from "react";

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
  | { type: "REORDER_COLLECTIONS"; fromIndex: number; toIndex: number }
  | {
      type: "REORDER_ENDPOINTS";
      collectionId: string;
      fromIndex: number;
      toIndex: number;
    };

// ─── Storage key ─────────────────────────────────────────────────────────────

const STORAGE_KEY = "callora_collections";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateId(): string {
  return `col_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function reorder<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function loadFromStorage(): CollectionsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CollectionsState;
      // Basic validation
      if (Array.isArray(parsed.collections)) {
        return parsed;
      }
    }
  } catch {
    // Ignore parse errors – start fresh
  }
  return { collections: [] };
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

function reducer(state: CollectionsState, action: Action): CollectionsState {
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

    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface CollectionsContextType extends CollectionsState {
  createCollection: (name: string) => void;
  renameCollection: (id: string, name: string) => void;
  deleteCollection: (id: string) => void;
  addEndpointToCollection: (collectionId: string, endpointId: string) => void;
  removeEndpointFromCollection: (
    collectionId: string,
    endpointId: string
  ) => void;
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
  const [state, dispatch] = useReducer(reducer, undefined, loadFromStorage);

  // Persist to localStorage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage quota exceeded – ignore silently
    }
  }, [state]);

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

  const removeEndpointFromCollection = (
    collectionId: string,
    endpointId: string
  ) => dispatch({ type: "REMOVE_ENDPOINT", collectionId, endpointId });

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
        renameCollection,
        deleteCollection,
        addEndpointToCollection,
        removeEndpointFromCollection,
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
