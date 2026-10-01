/**
 * CollectionsMenu.test.tsx
 *
 * Tests for:
 *  - Create collection renders correctly
 *  - Rename collection works
 *  - Delete collection removes it
 *  - Adding endpoint to collection updates count
 *  - State persists to localStorage
 *  - Keyboard navigation works (Arrow keys to reorder, Enter/Delete on drag handle)
 *  - Export and import collections as JSON
 */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import CollectionsMenu from "./CollectionsMenu";
import { CollectionsProvider, useCollections } from "../state/collectionsStore";
import { collectionsReducer } from "../state/collectionsStore";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderWithProvider(ui: React.ReactElement) {
  return render(<CollectionsProvider>{ui}</CollectionsProvider>);
}

/** Utility component that adds a collection + endpoint for controlled tests. */
function Seeder({
  collectionName,
  endpointId,
}: {
  collectionName?: string;
  endpointId?: string;
}) {
  const { createCollection, addEndpointToCollection, collections } =
    useCollections();

  React.useEffect(() => {
    if (collectionName && collections.length === 0) {
      createCollection(collectionName);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (endpointId && collections.length > 0) {
      addEndpointToCollection(collections[0].id, endpointId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collections.length]);

  return null;
}

// ─── Setup / teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  // Mock confirm so we don't block on window.confirm in delete tests
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("CollectionsMenu – create collection", () => {
  it("renders the trigger button", () => {
    renderWithProvider(<CollectionsMenu />);
    expect(
      screen.getByRole("button", { name: /collections/i })
    ).toBeTruthy();
  });

  it("opens the panel when the trigger is clicked", () => {
    renderWithProvider(<CollectionsMenu />);
    fireEvent.click(screen.getByRole("button", { name: /collections/i }));
    expect(screen.getByRole("dialog", { name: /collections panel/i })).toBeTruthy();
  });

  it("shows empty-state text when there are no collections", () => {
    renderWithProvider(<CollectionsMenu />);
    fireEvent.click(screen.getByRole("button", { name: /collections/i }));
    expect(screen.getByText(/no collections yet/i)).toBeTruthy();
  });

  it("creates a new collection via the inline input", () => {
    renderWithProvider(<CollectionsMenu />);

    // Open panel
    fireEvent.click(screen.getByRole("button", { name: /collections/i }));

    // Click "New Collection"
    fireEvent.click(screen.getByRole("button", { name: /create new collection/i }));

    // Type name and confirm
    const input = screen.getByRole("textbox", { name: /new collection name/i });
    fireEvent.change(input, { target: { value: "My API set" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm create collection/i }));

    // Collection should now appear in the list
    expect(screen.getByText("My API set")).toBeTruthy();
  });

  it("creates a collection by pressing Enter in the input", () => {
    renderWithProvider(<CollectionsMenu />);

    fireEvent.click(screen.getByRole("button", { name: /collections/i }));
    fireEvent.click(screen.getByRole("button", { name: /create new collection/i }));

    const input = screen.getByRole("textbox", { name: /new collection name/i });
    fireEvent.change(input, { target: { value: "Keyboard collection" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByText("Keyboard collection")).toBeTruthy();
  });
});

describe("CollectionsMenu – rename collection", () => {
  it("renames a collection when clicking the rename button and confirming", () => {
    renderWithProvider(
      <>
        <Seeder collectionName="Original name" />
        <CollectionsMenu />
      </>
    );

    // Open panel
    fireEvent.click(screen.getByRole("button", { name: /collections/i }));

    // Click rename button (✏️)
    fireEvent.click(
      screen.getByRole("button", { name: /rename collection "Original name"/i })
    );

    // The name input should appear pre-filled
    const input = screen.getByRole("textbox", { name: /rename collection/i });
    expect((input as HTMLInputElement).value).toBe("Original name");

    // Change name and commit
    fireEvent.change(input, { target: { value: "Renamed collection" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByText("Renamed collection")).toBeTruthy();
    expect(screen.queryByText("Original name")).toBeNull();
  });

  it("cancels rename with Escape", () => {
    renderWithProvider(
      <>
        <Seeder collectionName="Keep this name" />
        <CollectionsMenu />
      </>
    );

    fireEvent.click(screen.getByRole("button", { name: /collections/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /rename collection "Keep this name"/i })
    );

    const input = screen.getByRole("textbox", { name: /rename collection/i });
    fireEvent.change(input, { target: { value: "Discard me" } });
    // Escape stops propagation so the panel stays open, rename is cancelled
    fireEvent.keyDown(input, { key: "Escape" });

    // Input is gone, original name is back (visible via the rename button)
    expect(screen.queryByRole("textbox", { name: /rename collection/i })).toBeNull();
    expect(screen.queryByDisplayValue("Discard me")).toBeNull();
    expect(screen.getByRole("button", { name: /rename collection "Keep this name"/i })).toBeTruthy();
  });
});

describe("CollectionsMenu – delete collection", () => {
  it("removes a collection when clicking the delete button", () => {
    renderWithProvider(
      <>
        <Seeder collectionName="To be deleted" />
        <CollectionsMenu />
      </>
    );

    fireEvent.click(screen.getByRole("button", { name: /collections/i }));

    // Collection should exist
    expect(screen.getByText("To be deleted")).toBeTruthy();

    // Click delete (🗑️)
    fireEvent.click(
      screen.getByRole("button", { name: /delete collection "To be deleted"/i })
    );

    // window.confirm is mocked to return true
    expect(screen.queryByText("To be deleted")).toBeNull();
  });

  it("does NOT remove the collection if user cancels confirm", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);

    renderWithProvider(
      <>
        <Seeder collectionName="Survive delete" />
        <CollectionsMenu />
      </>
    );

    fireEvent.click(screen.getByRole("button", { name: /collections/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /delete collection "Survive delete"/i })
    );

    expect(screen.getByText("Survive delete")).toBeTruthy();
  });
});

describe("CollectionsMenu – endpoint count", () => {
  it("shows updated endpoint count when an endpoint is added", () => {
    renderWithProvider(
      <>
        <Seeder collectionName="With endpoints" endpointId="weather-001" />
        <CollectionsMenu />
      </>
    );

    fireEvent.click(screen.getByRole("button", { name: /collections/i }));

    // The count badge inside the collection row should show "1"
    const panel = screen.getByRole("dialog", { name: /collections panel/i });
    // Find the count pill — it's a span with aria-label "1 endpoints"
    expect(within(panel).getByLabelText("1 endpoints")).toBeTruthy();
  });

  it("shows the global saved-count badge on the trigger button when endpoints are saved", () => {
    renderWithProvider(
      <>
        <Seeder collectionName="Badge test" endpointId="pay-qr" />
        <CollectionsMenu />
      </>
    );

    // The trigger button should have aria-label mentioning "1 saved endpoint"
    expect(
      screen.getByRole("button", {
        name: /1 saved endpoint/i,
      })
    ).toBeTruthy();
  });
});

describe("CollectionsMenu – localStorage persistence", () => {
  it("persists collections to localStorage", () => {
    renderWithProvider(<CollectionsMenu />);

    // Open and create a collection
    fireEvent.click(screen.getByRole("button", { name: /collections/i }));
    fireEvent.click(screen.getByRole("button", { name: /create new collection/i }));

    const input = screen.getByRole("textbox", { name: /new collection name/i });
    fireEvent.change(input, { target: { value: "Persisted collection" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm create collection/i }));

    // Check localStorage
    const raw = localStorage.getItem("callora_collections");
    expect(raw).toBeTruthy();
    const saved = JSON.parse(raw!);
    expect(saved.collections).toHaveLength(1);
    expect(saved.collections[0].name).toBe("Persisted collection");
  });

  it("loads collections from localStorage on mount", () => {
    // Pre-populate localStorage
    localStorage.setItem(
      "callora_collections",
      JSON.stringify({
        collections: [
          { id: "pre-col-1", name: "Pre-loaded", endpointIds: ["weather-001"] },
        ],
      })
    );

    renderWithProvider(<CollectionsMenu />);
    fireEvent.click(screen.getByRole("button", { name: /collections/i }));

    expect(screen.getByText("Pre-loaded")).toBeTruthy();
  });
});

describe("CollectionsMenu – keyboard navigation", () => {
  it("closes the panel with Escape", () => {
    renderWithProvider(<CollectionsMenu />);

    const trigger = screen.getByRole("button", { name: /collections/i });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("moves a collection up with ArrowUp on the drag handle", () => {
    // Seed two collections so we can move one
    function TwoCollections() {
      const { createCollection, collections } = useCollections();

      React.useEffect(() => {
        if (collections.length === 0) {
          createCollection("Alpha");
          createCollection("Beta");
        }
      // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      return <CollectionsMenu />;
    }

    renderWithProvider(<TwoCollections />);

    fireEvent.click(screen.getByRole("button", { name: /collections/i }));

    // Get both drag handles; the second one is "Beta"
    const handles = screen.getAllByRole("button", {
      name: /drag to reorder/i,
    });
    expect(handles.length).toBeGreaterThanOrEqual(2);

    // The second handle belongs to Beta (collections are Alpha then Beta)
    expect(handles[0].getAttribute("aria-label")).toMatch(/Alpha/);
    expect(handles[1].getAttribute("aria-label")).toMatch(/Beta/);

    // Press ArrowUp on the second handle (Beta) → should move Beta before Alpha
    fireEvent.keyDown(handles[1], { key: "ArrowUp" });

    // After reorder, the first drag handle should now be Beta
    const updatedHandles = screen.getAllByRole("button", {
      name: /drag to reorder/i,
    });
    expect(updatedHandles[0].getAttribute("aria-label")).toMatch(/Beta/);
    expect(updatedHandles[1].getAttribute("aria-label")).toMatch(/Alpha/);
  });

  it("triggers delete confirmation with Delete key on drag handle", () => {
    renderWithProvider(
      <>
        <Seeder collectionName="Keyboard delete" />
        <CollectionsMenu />
      </>
    );

    fireEvent.click(screen.getByRole("button", { name: /collections/i }));

    const handle = screen.getByRole("button", { name: /drag to reorder/i });
    fireEvent.keyDown(handle, { key: "Delete" });

    // window.confirm was called
    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining("Keyboard delete")
    );
    // And because confirm returns true, the collection was deleted
    expect(screen.queryByText("Keyboard delete")).toBeNull();
  });
});

// ─── Export / Import ─────────────────────────────────────────────────────────

describe("CollectionsMenu – export collections", () => {
  it("downloads a JSON file with a version field when Export is clicked", () => {
    renderWithProvider(
      <>
        <Seeder collectionName="Exportable" endpointId="weather-001" />
        <CollectionsMenu />
      </>
    );

    fireEvent.click(screen.getByRole("button", { name: /collections/i }));

    // Capture the blob passed to URL.createObjectURL
    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    // @ts-expect-error – jsdom does not implement these
    globalThis.URL.createObjectURL = createObjectURL;
    // @ts-expect-error – jsdom does not implement these
    globalThis.URL.revokeObjectURL = revokeObjectURL;

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    fireEvent.click(screen.getByRole("button", { name: /export collections/i }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob).toBeInstanceOf(Blob);
    expect(clickSpy).toHaveBeenCalled();
  });

  it("shows an error when there is nothing to export", () => {
    renderWithProvider(<CollectionsMenu />);

    fireEvent.click(screen.getByRole("button", { name: /collections/i }));
    fireEvent.click(screen.getByRole("button", { name: /export collections/i }));

    expect(screen.getByRole("alert")).toBeTruthy();
  });
});

describe("CollectionsMenu – import collections", () => {
  function importFile(contents: string) {
    const file = new File([contents], "collections.json", {
      type: "application/json",
    });
    const input = screen.getByLabelText(/import collections file/i) as HTMLInputElement;
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);
  }

  it("merges a valid file without duplicates", async () => {
    renderWithProvider(
      <>
        <Seeder collectionName="Existing" />
        <CollectionsMenu />
      </>
    );

    fireEvent.click(screen.getByRole("button", { name: /collections/i }));

    const payload = {
      version: 1,
      collections: [
        { id: "imported-1", name: "Imported", endpointIds: ["a"] },
      ],
    };
    importFile(JSON.stringify(payload));

    expect(await screen.findByText("Imported")).toBeTruthy();
    expect(screen.getByText("Existing")).toBeTruthy();
  });

  it("de-duplicates collections by id when importing", async () => {
    renderWithProvider(
      <>
        <Seeder collectionName="Existing" />
        <CollectionsMenu />
      </>
    );

    fireEvent.click(screen.getByRole("button", { name: /collections/i }));

    // Grab the existing collection's id from localStorage
    const raw = localStorage.getItem("callora_collections");
    const existingId = JSON.parse(raw!).collections[0].id;

    const payload = {
      version: 1,
      collections: [
        { id: existingId, name: "Duplicate", endpointIds: [] },
        { id: "fresh-1", name: "Fresh", endpointIds: [] },
      ],
    };
    importFile(JSON.stringify(payload));

    expect(await screen.findByText("Fresh")).toBeTruthy();
    // The duplicate id should not have overwritten the existing name
    expect(screen.getByText("Existing")).toBeTruthy();
    expect(screen.queryByText("Duplicate")).toBeNull();
  });

  it("shows an inline error and leaves state unchanged for malformed files", async () => {
    renderWithProvider(
      <>
        <Seeder collectionName="Untouched" />
        <CollectionsMenu />
      </>
    );

    fireEvent.click(screen.getByRole("button", { name: /collections/i }));

    importFile("{ not valid json");

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("Untouched")).toBeTruthy();
  });
});

describe("collectionsReducer – IMPORT_COLLECTIONS", () => {
  it("merges imported collections and skips duplicate ids", () => {
    const initial = {
      collections: [
        { id: "a", name: "Alpha", endpointIds: ["e1"] },
      ],
    };

    const next = collectionsReducer(initial, {
      type: "IMPORT_COLLECTIONS",
      payload: [
        { id: "a", name: "Alpha duplicate", endpointIds: [] },
        { id: "b", name: "Beta", endpointIds: ["e2"] },
      ],
    });

    expect(next.collections).toHaveLength(2);
    expect(next.collections[0].name).toBe("Alpha");
    expect(next.collections[1].id).toBe("b");
  });
});
