/**
 * collectionsStore.test.tsx
 *
 * Unit tests for the collections reducer and CollectionsProvider.
 * Closes #1117.
 *
 * Coverage:
 *  - CREATE_COLLECTION: blank / whitespace names → "Untitled Collection"
 *  - CREATE_COLLECTION_WITH_ENDPOINT: same name fallback + endpoint seeded
 *  - RENAME_COLLECTION: normal rename, whitespace input keeps old name
 *  - DELETE_COLLECTION: removes correct item, ignores unknown id
 *  - ADD_ENDPOINT: adds once, deduplicates on second add
 *  - REMOVE_ENDPOINT: removes correct endpoint, ignores unknown
 *  - REORDER_COLLECTIONS: moves to correct index, clamps out-of-range indexes
 *  - REORDER_ENDPOINTS: moves endpoint within a collection
 *  - localStorage: corrupt JSON → empty state; valid JSON → loaded state
 *  - useCollections(): throws outside provider
 *  - Provider derived values: isEndpointSaved, collectionIdsForEndpoint, totalSavedCount
 */

import React from "react";
import { cleanup, render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  reducer,
  CollectionsProvider,
  useCollections,
  type Collection,
  type CollectionsState,
} from "./collectionsStore";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal Collection object for test fixtures. */
function makeCollection(
  overrides: Partial<Collection> & { id: string; name: string }
): Collection {
  return { endpointIds: [], ...overrides };
}

/** Minimal state factory. */
function makeState(collections: Collection[] = []): CollectionsState {
  return { collections };
}

// ─── Setup / teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

// ─────────────────────────────────────────────────────────────────────────────
// Reducer: CREATE_COLLECTION
// ─────────────────────────────────────────────────────────────────────────────

describe("reducer – CREATE_COLLECTION", () => {
  it("creates a collection with the provided name", () => {
    const state = makeState();
    const next = reducer(state, { type: "CREATE_COLLECTION", name: "My APIs" });
    expect(next.collections).toHaveLength(1);
    expect(next.collections[0].name).toBe("My APIs");
    expect(next.collections[0].endpointIds).toEqual([]);
    expect(next.collections[0].id).toMatch(/^col_/);
  });

  it("trims leading/trailing whitespace from the name", () => {
    const next = reducer(makeState(), {
      type: "CREATE_COLLECTION",
      name: "  Trimmed  ",
    });
    expect(next.collections[0].name).toBe("Trimmed");
  });

  it("falls back to 'Untitled Collection' when name is empty string", () => {
    const next = reducer(makeState(), { type: "CREATE_COLLECTION", name: "" });
    expect(next.collections[0].name).toBe("Untitled Collection");
  });

  it("falls back to 'Untitled Collection' when name is only whitespace", () => {
    const next = reducer(makeState(), {
      type: "CREATE_COLLECTION",
      name: "   ",
    });
    expect(next.collections[0].name).toBe("Untitled Collection");
  });

  it("appends to existing collections without mutating previous list", () => {
    const col = makeCollection({ id: "c1", name: "Existing" });
    const state = makeState([col]);
    const next = reducer(state, {
      type: "CREATE_COLLECTION",
      name: "Second",
    });
    expect(next.collections).toHaveLength(2);
    expect(next.collections[0]).toBe(col); // reference equality – no mutation
    expect(next.collections[1].name).toBe("Second");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Reducer: CREATE_COLLECTION_WITH_ENDPOINT
// ─────────────────────────────────────────────────────────────────────────────

describe("reducer – CREATE_COLLECTION_WITH_ENDPOINT", () => {
  it("creates a collection and seeds it with the given endpoint", () => {
    const next = reducer(makeState(), {
      type: "CREATE_COLLECTION_WITH_ENDPOINT",
      name: "Quick save",
      endpointId: "ep-001",
    });
    expect(next.collections).toHaveLength(1);
    expect(next.collections[0].name).toBe("Quick save");
    expect(next.collections[0].endpointIds).toEqual(["ep-001"]);
  });

  it("falls back to 'Untitled Collection' for blank name", () => {
    const next = reducer(makeState(), {
      type: "CREATE_COLLECTION_WITH_ENDPOINT",
      name: "",
      endpointId: "ep-002",
    });
    expect(next.collections[0].name).toBe("Untitled Collection");
  });

  it("falls back to 'Untitled Collection' for whitespace-only name", () => {
    const next = reducer(makeState(), {
      type: "CREATE_COLLECTION_WITH_ENDPOINT",
      name: "   \t  ",
      endpointId: "ep-003",
    });
    expect(next.collections[0].name).toBe("Untitled Collection");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Reducer: RENAME_COLLECTION
// ─────────────────────────────────────────────────────────────────────────────

describe("reducer – RENAME_COLLECTION", () => {
  it("renames a collection by id", () => {
    const col = makeCollection({ id: "c1", name: "Old name" });
    const next = reducer(makeState([col]), {
      type: "RENAME_COLLECTION",
      id: "c1",
      name: "New name",
    });
    expect(next.collections[0].name).toBe("New name");
  });

  it("trims the new name before applying it", () => {
    const col = makeCollection({ id: "c1", name: "Old" });
    const next = reducer(makeState([col]), {
      type: "RENAME_COLLECTION",
      id: "c1",
      name: "  Spaced  ",
    });
    expect(next.collections[0].name).toBe("Spaced");
  });

  it("keeps the old name when the new name is empty", () => {
    const col = makeCollection({ id: "c1", name: "Keep me" });
    const next = reducer(makeState([col]), {
      type: "RENAME_COLLECTION",
      id: "c1",
      name: "",
    });
    expect(next.collections[0].name).toBe("Keep me");
  });

  it("keeps the old name when the new name is only whitespace", () => {
    const col = makeCollection({ id: "c1", name: "Still here" });
    const next = reducer(makeState([col]), {
      type: "RENAME_COLLECTION",
      id: "c1",
      name: "   ",
    });
    expect(next.collections[0].name).toBe("Still here");
  });

  it("only renames the targeted collection, leaves others unchanged", () => {
    const c1 = makeCollection({ id: "c1", name: "Alpha" });
    const c2 = makeCollection({ id: "c2", name: "Beta" });
    const next = reducer(makeState([c1, c2]), {
      type: "RENAME_COLLECTION",
      id: "c1",
      name: "Renamed Alpha",
    });
    expect(next.collections[0].name).toBe("Renamed Alpha");
    expect(next.collections[1].name).toBe("Beta");
  });

  it("is a no-op for an unknown id", () => {
    const col = makeCollection({ id: "c1", name: "Alpha" });
    const state = makeState([col]);
    const next = reducer(state, {
      type: "RENAME_COLLECTION",
      id: "unknown",
      name: "Whatever",
    });
    // Collections list is unchanged (same items by value)
    expect(next.collections[0].name).toBe("Alpha");
    expect(next.collections).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Reducer: DELETE_COLLECTION
// ─────────────────────────────────────────────────────────────────────────────

describe("reducer – DELETE_COLLECTION", () => {
  it("removes the collection with the matching id", () => {
    const c1 = makeCollection({ id: "c1", name: "Remove me" });
    const c2 = makeCollection({ id: "c2", name: "Keep me" });
    const next = reducer(makeState([c1, c2]), {
      type: "DELETE_COLLECTION",
      id: "c1",
    });
    expect(next.collections).toHaveLength(1);
    expect(next.collections[0].id).toBe("c2");
  });

  it("is a no-op for an unknown id", () => {
    const col = makeCollection({ id: "c1", name: "Alpha" });
    const next = reducer(makeState([col]), {
      type: "DELETE_COLLECTION",
      id: "does-not-exist",
    });
    expect(next.collections).toHaveLength(1);
  });

  it("results in an empty list when the only collection is deleted", () => {
    const col = makeCollection({ id: "solo", name: "Solo" });
    const next = reducer(makeState([col]), {
      type: "DELETE_COLLECTION",
      id: "solo",
    });
    expect(next.collections).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Reducer: ADD_ENDPOINT
// ─────────────────────────────────────────────────────────────────────────────

describe("reducer – ADD_ENDPOINT", () => {
  it("adds an endpoint id to the specified collection", () => {
    const col = makeCollection({ id: "c1", name: "Alpha" });
    const next = reducer(makeState([col]), {
      type: "ADD_ENDPOINT",
      collectionId: "c1",
      endpointId: "ep-1",
    });
    expect(next.collections[0].endpointIds).toEqual(["ep-1"]);
  });

  it("does not add a duplicate endpoint (idempotent)", () => {
    const col = makeCollection({
      id: "c1",
      name: "Alpha",
      endpointIds: ["ep-1"],
    });
    const next = reducer(makeState([col]), {
      type: "ADD_ENDPOINT",
      collectionId: "c1",
      endpointId: "ep-1",
    });
    expect(next.collections[0].endpointIds).toEqual(["ep-1"]);
    expect(next.collections[0].endpointIds).toHaveLength(1);
  });

  it("adding a second distinct endpoint appends it", () => {
    const col = makeCollection({
      id: "c1",
      name: "Alpha",
      endpointIds: ["ep-1"],
    });
    const next = reducer(makeState([col]), {
      type: "ADD_ENDPOINT",
      collectionId: "c1",
      endpointId: "ep-2",
    });
    expect(next.collections[0].endpointIds).toEqual(["ep-1", "ep-2"]);
  });

  it("is a no-op for an unknown collection id", () => {
    const col = makeCollection({ id: "c1", name: "Alpha" });
    const next = reducer(makeState([col]), {
      type: "ADD_ENDPOINT",
      collectionId: "unknown",
      endpointId: "ep-1",
    });
    expect(next.collections[0].endpointIds).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Reducer: REMOVE_ENDPOINT
// ─────────────────────────────────────────────────────────────────────────────

describe("reducer – REMOVE_ENDPOINT", () => {
  it("removes the specified endpoint from the collection", () => {
    const col = makeCollection({
      id: "c1",
      name: "Alpha",
      endpointIds: ["ep-1", "ep-2"],
    });
    const next = reducer(makeState([col]), {
      type: "REMOVE_ENDPOINT",
      collectionId: "c1",
      endpointId: "ep-1",
    });
    expect(next.collections[0].endpointIds).toEqual(["ep-2"]);
  });

  it("is a no-op when the endpoint is not in the collection", () => {
    const col = makeCollection({
      id: "c1",
      name: "Alpha",
      endpointIds: ["ep-1"],
    });
    const next = reducer(makeState([col]), {
      type: "REMOVE_ENDPOINT",
      collectionId: "c1",
      endpointId: "ep-99",
    });
    expect(next.collections[0].endpointIds).toEqual(["ep-1"]);
  });

  it("is a no-op for an unknown collection id", () => {
    const col = makeCollection({
      id: "c1",
      name: "Alpha",
      endpointIds: ["ep-1"],
    });
    const next = reducer(makeState([col]), {
      type: "REMOVE_ENDPOINT",
      collectionId: "unknown",
      endpointId: "ep-1",
    });
    expect(next.collections[0].endpointIds).toEqual(["ep-1"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Reducer: REORDER_COLLECTIONS
// ─────────────────────────────────────────────────────────────────────────────

describe("reducer – REORDER_COLLECTIONS", () => {
  const alpha = makeCollection({ id: "c1", name: "Alpha" });
  const beta  = makeCollection({ id: "c2", name: "Beta" });
  const gamma = makeCollection({ id: "c3", name: "Gamma" });

  it("moves an item forward (index 0 → 2)", () => {
    const next = reducer(makeState([alpha, beta, gamma]), {
      type: "REORDER_COLLECTIONS",
      fromIndex: 0,
      toIndex: 2,
    });
    expect(next.collections.map((c) => c.name)).toEqual([
      "Beta",
      "Gamma",
      "Alpha",
    ]);
  });

  it("moves an item backward (index 2 → 0)", () => {
    const next = reducer(makeState([alpha, beta, gamma]), {
      type: "REORDER_COLLECTIONS",
      fromIndex: 2,
      toIndex: 0,
    });
    expect(next.collections.map((c) => c.name)).toEqual([
      "Gamma",
      "Alpha",
      "Beta",
    ]);
  });

  it("adjacent swap (index 0 → 1)", () => {
    const next = reducer(makeState([alpha, beta]), {
      type: "REORDER_COLLECTIONS",
      fromIndex: 0,
      toIndex: 1,
    });
    expect(next.collections.map((c) => c.name)).toEqual(["Beta", "Alpha"]);
  });

  it("same-index reorder returns equivalent state (no crash)", () => {
    const next = reducer(makeState([alpha, beta]), {
      type: "REORDER_COLLECTIONS",
      fromIndex: 1,
      toIndex: 1,
    });
    expect(next.collections.map((c) => c.name)).toEqual(["Alpha", "Beta"]);
  });

  it("out-of-range toIndex (> length) clamps via splice and does not throw", () => {
    // Array.splice with an index beyond the array length appends to the end —
    // the reducer delegates to the reorder() helper which uses splice, so this
    // should not throw even if the caller passes a bad index.
    expect(() =>
      reducer(makeState([alpha, beta, gamma]), {
        type: "REORDER_COLLECTIONS",
        fromIndex: 0,
        toIndex: 99,
      })
    ).not.toThrow();
  });

  it("out-of-range fromIndex (negative) does not throw", () => {
    expect(() =>
      reducer(makeState([alpha, beta]), {
        type: "REORDER_COLLECTIONS",
        fromIndex: -1,
        toIndex: 0,
      })
    ).not.toThrow();
  });

  it("does not mutate the original state object", () => {
    const state = makeState([alpha, beta]);
    const original = state.collections.slice();
    reducer(state, {
      type: "REORDER_COLLECTIONS",
      fromIndex: 0,
      toIndex: 1,
    });
    expect(state.collections).toEqual(original);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Reducer: REORDER_ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

describe("reducer – REORDER_ENDPOINTS", () => {
  it("moves an endpoint within a collection (0 → 2)", () => {
    const col = makeCollection({
      id: "c1",
      name: "Alpha",
      endpointIds: ["ep-a", "ep-b", "ep-c"],
    });
    const next = reducer(makeState([col]), {
      type: "REORDER_ENDPOINTS",
      collectionId: "c1",
      fromIndex: 0,
      toIndex: 2,
    });
    expect(next.collections[0].endpointIds).toEqual(["ep-b", "ep-c", "ep-a"]);
  });

  it("moves an endpoint backward (2 → 0)", () => {
    const col = makeCollection({
      id: "c1",
      name: "Alpha",
      endpointIds: ["ep-a", "ep-b", "ep-c"],
    });
    const next = reducer(makeState([col]), {
      type: "REORDER_ENDPOINTS",
      collectionId: "c1",
      fromIndex: 2,
      toIndex: 0,
    });
    expect(next.collections[0].endpointIds).toEqual(["ep-c", "ep-a", "ep-b"]);
  });

  it("is a no-op for an unknown collection id (other collections unchanged)", () => {
    const col = makeCollection({
      id: "c1",
      name: "Alpha",
      endpointIds: ["ep-a", "ep-b"],
    });
    const next = reducer(makeState([col]), {
      type: "REORDER_ENDPOINTS",
      collectionId: "unknown",
      fromIndex: 0,
      toIndex: 1,
    });
    expect(next.collections[0].endpointIds).toEqual(["ep-a", "ep-b"]);
  });

  it("only modifies the targeted collection when multiple exist", () => {
    const c1 = makeCollection({
      id: "c1",
      name: "Alpha",
      endpointIds: ["ep-a", "ep-b"],
    });
    const c2 = makeCollection({
      id: "c2",
      name: "Beta",
      endpointIds: ["ep-x", "ep-y"],
    });
    const next = reducer(makeState([c1, c2]), {
      type: "REORDER_ENDPOINTS",
      collectionId: "c1",
      fromIndex: 0,
      toIndex: 1,
    });
    expect(next.collections[0].endpointIds).toEqual(["ep-b", "ep-a"]);
    expect(next.collections[1].endpointIds).toEqual(["ep-x", "ep-y"]);
  });

  it("out-of-range reorder does not throw", () => {
    const col = makeCollection({
      id: "c1",
      name: "Alpha",
      endpointIds: ["ep-a", "ep-b"],
    });
    expect(() =>
      reducer(makeState([col]), {
        type: "REORDER_ENDPOINTS",
        collectionId: "c1",
        fromIndex: 0,
        toIndex: 99,
      })
    ).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CollectionsProvider – localStorage loading
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimal consumer component that exposes provider values via data attributes
 * so we can assert on them without relying on CollectionsMenu UI.
 */
function Inspector() {
  const ctx = useCollections();
  return (
    <div>
      <span data-testid="count">{ctx.collections.length}</span>
      <span data-testid="first-name">
        {ctx.collections[0]?.name ?? "—"}
      </span>
      <span data-testid="total-saved">{ctx.totalSavedCount}</span>
      <span data-testid="is-saved-ep1">
        {String(ctx.isEndpointSaved("ep-1"))}
      </span>
      <span data-testid="col-ids-ep1">
        {[...ctx.collectionIdsForEndpoint("ep-1")].join(",")}
      </span>
    </div>
  );
}

describe("CollectionsProvider – localStorage loading", () => {
  it("starts with empty collections when localStorage is empty", () => {
    render(
      <CollectionsProvider>
        <Inspector />
      </CollectionsProvider>
    );
    expect(screen.getByTestId("count").textContent).toBe("0");
  });

  it("loads valid collections from localStorage on mount", () => {
    localStorage.setItem(
      "callora_collections",
      JSON.stringify({
        collections: [
          { id: "pre-1", name: "Pre-loaded", endpointIds: ["ep-1"] },
        ],
      })
    );

    render(
      <CollectionsProvider>
        <Inspector />
      </CollectionsProvider>
    );

    expect(screen.getByTestId("count").textContent).toBe("1");
    expect(screen.getByTestId("first-name").textContent).toBe("Pre-loaded");
  });

  it("falls back to empty state when localStorage contains invalid JSON", () => {
    localStorage.setItem("callora_collections", "not valid json {{");

    render(
      <CollectionsProvider>
        <Inspector />
      </CollectionsProvider>
    );

    expect(screen.getByTestId("count").textContent).toBe("0");
  });

  it("falls back to empty state when stored object has no 'collections' array", () => {
    localStorage.setItem(
      "callora_collections",
      JSON.stringify({ something: "unexpected" })
    );

    render(
      <CollectionsProvider>
        <Inspector />
      </CollectionsProvider>
    );

    expect(screen.getByTestId("count").textContent).toBe("0");
  });

  it("falls back to empty state when 'collections' field is not an array", () => {
    localStorage.setItem(
      "callora_collections",
      JSON.stringify({ collections: null })
    );

    render(
      <CollectionsProvider>
        <Inspector />
      </CollectionsProvider>
    );

    expect(screen.getByTestId("count").textContent).toBe("0");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CollectionsProvider – persistence
// ─────────────────────────────────────────────────────────────────────────────

describe("CollectionsProvider – localStorage persistence", () => {
  it("persists a new collection to localStorage after create", () => {
    function Creator() {
      const { createCollection } = useCollections();
      return (
        <button onClick={() => createCollection("Saved")}>create</button>
      );
    }

    render(
      <CollectionsProvider>
        <Creator />
      </CollectionsProvider>
    );

    act(() => {
      screen.getByText("create").click();
    });

    const raw = localStorage.getItem("callora_collections");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.collections).toHaveLength(1);
    expect(parsed.collections[0].name).toBe("Saved");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CollectionsProvider – derived values
// ─────────────────────────────────────────────────────────────────────────────

describe("CollectionsProvider – derived values", () => {
  it("isEndpointSaved returns true only when the endpoint exists in a collection", () => {
    localStorage.setItem(
      "callora_collections",
      JSON.stringify({
        collections: [{ id: "c1", name: "A", endpointIds: ["ep-1"] }],
      })
    );

    render(
      <CollectionsProvider>
        <Inspector />
      </CollectionsProvider>
    );

    expect(screen.getByTestId("is-saved-ep1").textContent).toBe("true");
  });

  it("isEndpointSaved returns false when endpoint is absent", () => {
    render(
      <CollectionsProvider>
        <Inspector />
      </CollectionsProvider>
    );
    expect(screen.getByTestId("is-saved-ep1").textContent).toBe("false");
  });

  it("collectionIdsForEndpoint returns set of collection ids containing the endpoint", () => {
    localStorage.setItem(
      "callora_collections",
      JSON.stringify({
        collections: [
          { id: "c1", name: "A", endpointIds: ["ep-1"] },
          { id: "c2", name: "B", endpointIds: ["ep-1", "ep-2"] },
          { id: "c3", name: "C", endpointIds: ["ep-2"] },
        ],
      })
    );

    render(
      <CollectionsProvider>
        <Inspector />
      </CollectionsProvider>
    );

    // Both c1 and c2 contain ep-1; c3 does not
    const ids = screen.getByTestId("col-ids-ep1").textContent!.split(",");
    expect(ids.sort()).toEqual(["c1", "c2"]);
  });

  it("totalSavedCount counts distinct endpoint ids across all collections", () => {
    localStorage.setItem(
      "callora_collections",
      JSON.stringify({
        collections: [
          { id: "c1", name: "A", endpointIds: ["ep-1", "ep-2"] },
          { id: "c2", name: "B", endpointIds: ["ep-2", "ep-3"] }, // ep-2 shared
        ],
      })
    );

    render(
      <CollectionsProvider>
        <Inspector />
      </CollectionsProvider>
    );

    // Distinct: ep-1, ep-2, ep-3 → 3
    expect(screen.getByTestId("total-saved").textContent).toBe("3");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// useCollections – guard
// ─────────────────────────────────────────────────────────────────────────────

describe("useCollections – outside provider", () => {
  it("throws when called outside CollectionsProvider", () => {
    // Suppress React's console.error for the expected throw
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    function BadConsumer() {
      useCollections();
      return null;
    }

    expect(() => render(<BadConsumer />)).toThrow(
      /useCollections must be used within a CollectionsProvider/i
    );

    consoleSpy.mockRestore();
  });
});
