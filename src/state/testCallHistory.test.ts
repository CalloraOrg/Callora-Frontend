/**
 * testCallHistory.test.ts
 *
 * Focused tests for the testCallHistory state module.
 *
 * Covers every acceptance criterion from issue #1123:
 *   1. Saving 51 entries keeps exactly 50 (MAX_ENTRIES cap).
 *   2. The newest entry is always first (prepend / newest-first invariant).
 *   3. Non-array JSON stored in localStorage loads as [].
 *   4. A throwing setItem does not propagate to the caller.
 *   5. clearHistory removes all entries.
 *
 * Additional adversarial cases:
 *   - Corrupt (non-JSON) string loads as [].
 *   - Null / absent key loads as [].
 *   - saveEntry is idempotent on a fresh store (size 1).
 *   - Entries beyond position 50 are the *oldest*, not the newest.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearHistory,
  loadHistory,
  saveEntry,
  type HistoryEntry,
} from "./testCallHistory";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = "callora_test_call_history";

/** Build a minimal valid HistoryEntry. `id` doubles as a unique marker. */
function makeEntry(id: string, overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id,
    timestamp: new Date().toISOString(),
    endpointId: "ep-1",
    endpointName: "Test endpoint",
    endpointPath: "/test",
    method: "GET",
    requestParams: "{}",
    response: { ok: true },
    status: "success",
    responseTime: 42,
    cost: 0,
    ...overrides,
  };
}

/** Save `count` entries sequentially, labelled "entry-1" … "entry-{count}". */
function saveN(count: number): void {
  for (let i = 1; i <= count; i++) {
    saveEntry(makeEntry(`entry-${i}`));
  }
}

// ─── Setup / teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

// ─── loadHistory ─────────────────────────────────────────────────────────────

describe("loadHistory", () => {
  it("returns [] when localStorage is empty", () => {
    expect(loadHistory()).toEqual([]);
  });

  it("returns [] when the stored value is null", () => {
    // localStorage.getItem returns null for absent keys — already the default,
    // but make the intent explicit.
    localStorage.removeItem(STORAGE_KEY);
    expect(loadHistory()).toEqual([]);
  });

  it("returns [] for corrupt (non-JSON) stored value", () => {
    localStorage.setItem(STORAGE_KEY, "{not valid json!!!");
    expect(loadHistory()).toEqual([]);
  });

  it("returns [] when stored value is a valid JSON object (non-array)", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ entry: "bad shape" }));
    expect(loadHistory()).toEqual([]);
  });

  it("returns [] when stored value is a JSON number", () => {
    localStorage.setItem(STORAGE_KEY, "42");
    expect(loadHistory()).toEqual([]);
  });

  it("returns [] when stored value is a JSON null", () => {
    localStorage.setItem(STORAGE_KEY, "null");
    expect(loadHistory()).toEqual([]);
  });

  it("returns [] when stored value is a JSON boolean", () => {
    localStorage.setItem(STORAGE_KEY, "true");
    expect(loadHistory()).toEqual([]);
  });

  it("returns [] when stored value is a JSON string (not array)", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify("a string"));
    expect(loadHistory()).toEqual([]);
  });

  it("returns the stored entries when the value is a valid array", () => {
    const entries = [makeEntry("e-1"), makeEntry("e-2")];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    expect(loadHistory()).toHaveLength(2);
    expect(loadHistory()[0].id).toBe("e-1");
  });
});

// ─── saveEntry — basic ───────────────────────────────────────────────────────

describe("saveEntry — basic", () => {
  it("saves a single entry so loadHistory returns length 1", () => {
    saveEntry(makeEntry("solo"));
    expect(loadHistory()).toHaveLength(1);
  });

  it("the saved entry is first after a single save", () => {
    const e = makeEntry("first");
    saveEntry(e);
    expect(loadHistory()[0].id).toBe("first");
  });

  it("each subsequent save prepends — newest entry is always index 0", () => {
    saveEntry(makeEntry("older"));
    saveEntry(makeEntry("newer"));
    const history = loadHistory();
    expect(history[0].id).toBe("newer");
    expect(history[1].id).toBe("older");
  });
});

// ─── saveEntry — 50-entry cap ────────────────────────────────────────────────

describe("saveEntry — MAX_ENTRIES = 50 cap", () => {
  it("saving exactly 50 entries keeps all 50", () => {
    saveN(50);
    expect(loadHistory()).toHaveLength(50);
  });

  it("saving 51 entries keeps exactly 50", () => {
    saveN(51);
    expect(loadHistory()).toHaveLength(50);
  });

  it("saving 100 entries keeps exactly 50", () => {
    saveN(100);
    expect(loadHistory()).toHaveLength(50);
  });

  it("after saving 51 entries, the newest entry (entry-51) is at index 0", () => {
    saveN(51);
    expect(loadHistory()[0].id).toBe("entry-51");
  });

  it("after saving 51 entries, the oldest entry retained is entry-2 (entry-1 is dropped)", () => {
    // entries are saved 1→51; after cap, indices 0–49 hold entries 51→2
    saveN(51);
    const history = loadHistory();
    // Oldest retained entry should be entry-2, not entry-1
    expect(history[49].id).toBe("entry-2");
    // entry-1 (the very first saved) must have been evicted
    expect(history.some((e) => e.id === "entry-1")).toBe(false);
  });

  it("entries are newest-first across the full capped list", () => {
    saveN(51);
    const history = loadHistory();
    // IDs should count down from 51 to 2
    for (let i = 0; i < 50; i++) {
      expect(history[i].id).toBe(`entry-${51 - i}`);
    }
  });

  it("saving a 52nd entry still keeps exactly 50 and shifts correctly", () => {
    saveN(51);
    saveEntry(makeEntry("entry-52"));
    const history = loadHistory();
    expect(history).toHaveLength(50);
    expect(history[0].id).toBe("entry-52");
    expect(history[49].id).toBe("entry-3");
  });
});

// ─── saveEntry — setItem throwing ────────────────────────────────────────────

describe("saveEntry — setItem failure is swallowed", () => {
  it("does not throw when localStorage.setItem throws (storage full simulation)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    expect(() => saveEntry(makeEntry("quota-fail"))).not.toThrow();
  });

  it("does not throw when setItem throws a generic Error", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => saveEntry(makeEntry("blocked-fail"))).not.toThrow();
  });

  it("pre-existing entries are unaffected when a subsequent setItem throws", () => {
    // Save one entry successfully first
    saveEntry(makeEntry("safe-entry"));
    // Now break setItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    // This save will fail silently
    saveEntry(makeEntry("failed-entry"));
    // The first entry should still be in storage (set before the mock)
    vi.restoreAllMocks();
    const history = loadHistory();
    expect(history.some((e) => e.id === "safe-entry")).toBe(true);
  });
});

// ─── clearHistory ─────────────────────────────────────────────────────────────

describe("clearHistory", () => {
  it("after clearHistory, loadHistory returns []", () => {
    saveN(5);
    expect(loadHistory()).toHaveLength(5);
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });

  it("clearHistory on an empty store does not throw", () => {
    expect(() => clearHistory()).not.toThrow();
  });

  it("entries saved after clearHistory start fresh", () => {
    saveN(10);
    clearHistory();
    saveEntry(makeEntry("after-clear"));
    const history = loadHistory();
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe("after-clear");
  });

  it("clearHistory removes the key from localStorage", () => {
    saveEntry(makeEntry("x"));
    clearHistory();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("clearHistory does not throw when localStorage.removeItem throws", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => clearHistory()).not.toThrow();
  });
});

// ─── Round-trip integrity ─────────────────────────────────────────────────────

describe("round-trip integrity", () => {
  it("all HistoryEntry fields survive a save/load round-trip", () => {
    const entry: HistoryEntry = {
      id: "rt-1",
      timestamp: "2025-01-15T12:00:00.000Z",
      endpointId: "ep-rt",
      endpointName: "Round-trip endpoint",
      endpointPath: "/round-trip",
      method: "POST",
      requestParams: '{"foo":"bar"}',
      response: { data: [1, 2, 3] },
      status: "error",
      responseTime: 9999,
      cost: 7,
    };
    saveEntry(entry);
    const loaded = loadHistory()[0];
    expect(loaded).toEqual(entry);
  });
});
