// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_BODY_CHARS,
  TRUNCATION_MARKER,
  clearHistory,
  loadHistory,
  saveEntry,
  type HistoryEntry,
} from "./testCallHistory";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

function makeEntry(overrides: Partial<Parameters<typeof saveEntry>[0]> = {}) {
  return {
    id: "entry-1",
    timestamp: new Date().toISOString(),
    endpointId: "ep-1",
    endpointName: "Test Endpoint",
    endpointPath: "/v1/test",
    method: "POST",
    requestParams: "{}",
    response: { ok: true },
    status: "success" as const,
    responseTime: 42,
    cost: 0.001,
    ...overrides,
  };
}

/** Returns the raw stored JSON for asserting exactly what hits localStorage. */
function stored(): string {
  return localStorage.getItem("callora_test_call_history") ?? "";
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("testCallHistory - redaction on save", () => {
  it("redacts API keys in requestParams before storing", () => {
    saveEntry(
      makeEntry({
        requestParams: '{"api_key": "sk_live_abcdefgh123456789012"}',
      }),
    );

    const raw = stored();
    expect(raw).not.toContain("sk_live_abcdefgh123456789012");
    // JSON-shaped credentials keep their key but lose their value.
    expect(raw).toContain("[REDACTED]");
  });

  it("redacts emails in requestParams and response bodies", () => {
    saveEntry(
      makeEntry({
        requestParams: '{"email": "user@example.com"}',
        response: { email: "john@example.com", name: "John Doe" },
      }),
    );

    const raw = stored();
    expect(raw).not.toContain("user@example.com");
    expect(raw).not.toContain("john@example.com");
    expect(raw).toContain("[REDACTED_EMAIL]");
  });

  it("redacts bearer tokens in responses", () => {
    saveEntry(
      makeEntry({
        response: { token: "Bearer abc123def456" },
      }),
    );

    const raw = stored();
    expect(raw).not.toContain("Bearer abc123def456");
    expect(raw).toContain("[REDACTED]");
  });

  it("redacts passwords in responses", () => {
    saveEntry(
      makeEntry({
        response: { password: "hunter2secret" },
      }),
    );

    const raw = stored();
    expect(raw).not.toContain("hunter2secret");
    expect(raw).toContain("[REDACTED]");
  });

  it("redacts JSON-shaped api_key fields while keeping the JSON valid", () => {
    saveEntry(
      makeEntry({
        response: { api_key: "sk_live_abcdefgh123456789012", ok: true },
      }),
    );

    const [entry] = loadHistory();
    expect(entry.response).toEqual({ api_key: "[REDACTED]", ok: true });
  });

  it("never stores the plaintext secret anywhere in the raw payload", () => {
    saveEntry(
      makeEntry({
        requestParams: "sk_live_abcdefgh123456789012",
        response: "email: someone@corp.io token: Bearer xyz789",
      }),
    );

    const raw = stored();
    expect(raw).not.toContain("sk_live_abcdefgh123456789012");
    expect(raw).not.toContain("someone@corp.io");
    expect(raw).not.toContain("Bearer xyz789");
  });
});

describe("testCallHistory - response body structure", () => {
  it("keeps response objects as objects so the preview can render JSON", () => {
    saveEntry(
      makeEntry({
        response: { email: "john@example.com", balance: 1250.5 },
      }),
    );

    const [entry] = loadHistory();
    expect(entry.response).toEqual({
      email: "[REDACTED_EMAIL]",
      balance: 1250.5,
    });
  });

  it("keeps non-object responses as redacted strings", () => {
    saveEntry(makeEntry({ response: "user@example.com" }));

    const [entry] = loadHistory();
    expect(entry.response).toBe("[REDACTED_EMAIL]");
  });
});

describe("testCallHistory - body size cap", () => {
  it("truncates response bodies above the cap", () => {
    saveEntry(
      makeEntry({
        response: { blob: "x".repeat(MAX_BODY_CHARS + 1000) },
      }),
    );

    const [entry] = loadHistory();
    const text = JSON.stringify(entry.response);
    expect(text).toContain(TRUNCATION_MARKER);
    expect(text.length).toBeLessThan(MAX_BODY_CHARS + 1000);
  });

  it("truncates requestParams above the cap", () => {
    saveEntry(
      makeEntry({
        requestParams: `{"blob": "${"y".repeat(MAX_BODY_CHARS + 100)}"}`,
      }),
    );

    const [entry] = loadHistory();
    expect(entry.requestParams).toContain(TRUNCATION_MARKER);
    expect(entry.requestParams.length).toBeLessThanOrEqual(
      MAX_BODY_CHARS + TRUNCATION_MARKER.length,
    );
  });

  it("does not truncate bodies under the cap", () => {
    const response = { blob: "x".repeat(100) };
    saveEntry(makeEntry({ response }));

    const [entry] = loadHistory();
    expect(JSON.stringify(entry.response)).not.toContain(TRUNCATION_MARKER);
  });

  it("keeps total stored size bounded with many large entries", () => {
    for (let i = 0; i < 50; i++) {
      saveEntry(
        makeEntry({
          id: `entry-${i}`,
          requestParams: `{"blob": "${"a".repeat(MAX_BODY_CHARS + 50)}"}`,
          response: { blob: "b".repeat(MAX_BODY_CHARS + 50) },
        }),
      );
    }

    // 50 entries * (4KB params + ~4KB body + overhead) ≈ 420KB, far below the
    // ~5MB localStorage quota. Guards against unbounded growth on repeated
    // save/load cycles.
    expect(stored().length).toBeLessThan(600_000);
  });

  it("does not re-encode strings on repeated save/load cycles", () => {
    for (let i = 0; i < 5; i++) {
      saveEntry(makeEntry({ id: `cycle-${i}`, requestParams: "{}" }));
      loadHistory();
    }

    const [entry] = loadHistory();
    expect(entry.requestParams).toBe("{}");
    expect(stored()).not.toContain("\\\"{}");
  });
});

describe("testCallHistory - age-based purge on load", () => {
  it("purges entries older than the 7-day retention window", () => {
    localStorage.setItem(
      "callora_test_call_history",
      JSON.stringify([
        makeEntry({ id: "old", timestamp: daysAgo(8) }),
        makeEntry({ id: "fresh", timestamp: daysAgo(2) }),
      ]),
    );

    const history = loadHistory();
    expect(history.map((e) => e.id)).toEqual(["fresh"]);
    expect(stored()).not.toContain('"old"');
  });

  it("keeps entries exactly at the 7-day boundary", () => {
    localStorage.setItem(
      "callora_test_call_history",
      JSON.stringify([makeEntry({ id: "boundary", timestamp: daysAgo(7) })]),
    );

    const history = loadHistory();
    expect(history.map((e) => e.id)).toEqual(["boundary"]);
  });

  it("drops entries with missing or unparseable timestamps (fail closed)", () => {
    localStorage.setItem(
      "callora_test_call_history",
      JSON.stringify([
        makeEntry({ id: "no-ts", timestamp: undefined as unknown as string }),
        makeEntry({ id: "bad-ts", timestamp: "not-a-date" }),
      ]),
    );

    expect(loadHistory()).toEqual([]);
    expect(stored()).not.toContain("no-ts");
    expect(stored()).not.toContain("bad-ts");
  });

  it("returns an empty list for malformed stored payloads", () => {
    localStorage.setItem("callora_test_call_history", "{not json");
    expect(loadHistory()).toEqual([]);
  });

  it("returns an empty list when the stored payload is not an array", () => {
    localStorage.setItem("callora_test_call_history", JSON.stringify({ id: "x" }));
    expect(loadHistory()).toEqual([]);
  });

  it("does not write back when storage already matches the sanitized state", () => {
    const fresh = makeEntry({ id: "fresh", timestamp: daysAgo(1) });
    const raw = JSON.stringify([fresh]);
    localStorage.setItem("callora_test_call_history", raw);

    loadHistory();

    expect(localStorage.getItem("callora_test_call_history")).toBe(raw);
  });
});

describe("testCallHistory - redaction on load (legacy pre-redaction data)", () => {
  it("redacts legacy plaintext entries when they are loaded", () => {
    localStorage.setItem(
      "callora_test_call_history",
      JSON.stringify([
        makeEntry({
          id: "legacy",
          timestamp: daysAgo(1),
          requestParams: '{"api_key": "sk_live_legacykey1234567890"}',
          response: { email: "legacy@example.com" },
        }),
      ]),
    );

    const [entry] = loadHistory();
    expect(entry.requestParams).toContain("[REDACTED]");
    expect(entry.response).toEqual({ email: "[REDACTED_EMAIL]" });

    const raw = stored();
    expect(raw).not.toContain("sk_live_legacykey1234567890");
    expect(raw).not.toContain("legacy@example.com");
  });
});

describe("testCallHistory - saveEntry edge cases", () => {
  it("normalizes entries with an invalid timestamp to now", () => {
    saveEntry(makeEntry({ timestamp: "not-a-date" }));

    const [entry] = loadHistory();
    const age = Date.now() - Date.parse(entry.timestamp);
    expect(age).toBeGreaterThanOrEqual(0);
    expect(age).toBeLessThan(60_000);
  });

  it("ignores null or non-object entries", () => {
    saveEntry(null as unknown as Parameters<typeof saveEntry>[0]);
    saveEntry(undefined as unknown as Parameters<typeof saveEntry>[0]);
    saveEntry(42 as unknown as Parameters<typeof saveEntry>[0]);

    expect(loadHistory()).toEqual([]);
    expect(stored()).toBe("");
  });

  it("enforces the 50-entry cap, keeping the newest entries", () => {
    for (let i = 0; i < 55; i++) {
      saveEntry(makeEntry({ id: `entry-${i}` }));
    }

    const history = loadHistory();
    expect(history).toHaveLength(50);
    expect(history[0].id).toBe("entry-54");
    expect(history[49].id).toBe("entry-5");
  });

  it("survives localStorage throwing on write (quota exceeded)", () => {
    const setItem = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    try {
      expect(() => saveEntry(makeEntry())).not.toThrow();
    } finally {
      localStorage.setItem = setItem;
    }
  });

  it("survives circular references in requestParams and response", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    saveEntry(
      makeEntry({
        requestParams: circular as unknown as string,
        response: circular,
      }),
    );

    const [entry] = loadHistory();
    expect(String(entry.requestParams)).toContain("[object Object]");
    expect(String(entry.response)).toContain("[object Object]");
  });
});

describe("testCallHistory - clearHistory", () => {
  it("removes all stored entries", () => {
    saveEntry(makeEntry());
    clearHistory();

    expect(loadHistory()).toEqual([]);
    expect(stored()).toBe("");
  });
});

// ─── Focused cap and storage-resilience tests (issue #1123) ──────────────────
//
//   1. Saving 51 entries keeps exactly 50 (MAX_ENTRIES cap).
//   2. The newest entry is always first (prepend / newest-first invariant).
//   3. Non-array JSON stored in localStorage loads as [].
//   4. A throwing setItem does not propagate to the caller.
//   5. clearHistory removes all entries.

// ─── Helpers ─────────────────────────────────────────────────────────────────

const HISTORY_KEY = "callora_test_call_history";

/** Build a minimal valid HistoryEntry. `id` doubles as a unique marker. */
function makeIdEntry(id: string, overrides: Partial<HistoryEntry> = {}): HistoryEntry {
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
    saveEntry(makeIdEntry(`entry-${i}`));
  }
}

// ─── loadHistory ─────────────────────────────────────────────────────────────

describe("testCallHistory - loadHistory resilience (#1123)", () => {
  it("returns [] when localStorage is empty", () => {
    expect(loadHistory()).toEqual([]);
  });

  it("returns [] when the stored value is null", () => {
    // localStorage.getItem returns null for absent keys — already the default,
    // but make the intent explicit.
    localStorage.removeItem(HISTORY_KEY);
    expect(loadHistory()).toEqual([]);
  });

  it("returns [] for corrupt (non-JSON) stored value", () => {
    localStorage.setItem(HISTORY_KEY, "{not valid json!!!");
    expect(loadHistory()).toEqual([]);
  });

  it("returns [] when stored value is a valid JSON object (non-array)", () => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify({ entry: "bad shape" }));
    expect(loadHistory()).toEqual([]);
  });

  it("returns [] when stored value is a JSON number", () => {
    localStorage.setItem(HISTORY_KEY, "42");
    expect(loadHistory()).toEqual([]);
  });

  it("returns [] when stored value is a JSON null", () => {
    localStorage.setItem(HISTORY_KEY, "null");
    expect(loadHistory()).toEqual([]);
  });

  it("returns [] when stored value is a JSON boolean", () => {
    localStorage.setItem(HISTORY_KEY, "true");
    expect(loadHistory()).toEqual([]);
  });

  it("returns [] when stored value is a JSON string (not array)", () => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify("a string"));
    expect(loadHistory()).toEqual([]);
  });

  it("returns the stored entries when the value is a valid array", () => {
    const entries = [makeIdEntry("e-1"), makeIdEntry("e-2")];
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
    expect(loadHistory()).toHaveLength(2);
    expect(loadHistory()[0].id).toBe("e-1");
  });
});

// ─── saveEntry — basic ───────────────────────────────────────────────────────

describe("testCallHistory - saveEntry ordering (#1123)", () => {
  it("saves a single entry so loadHistory returns length 1", () => {
    saveEntry(makeIdEntry("solo"));
    expect(loadHistory()).toHaveLength(1);
  });

  it("the saved entry is first after a single save", () => {
    const e = makeIdEntry("first");
    saveEntry(e);
    expect(loadHistory()[0].id).toBe("first");
  });

  it("each subsequent save prepends — newest entry is always index 0", () => {
    saveEntry(makeIdEntry("older"));
    saveEntry(makeIdEntry("newer"));
    const history = loadHistory();
    expect(history[0].id).toBe("newer");
    expect(history[1].id).toBe("older");
  });
});

// ─── saveEntry — 50-entry cap ────────────────────────────────────────────────

describe("testCallHistory - MAX_ENTRIES = 50 cap (#1123)", () => {
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
    saveEntry(makeIdEntry("entry-52"));
    const history = loadHistory();
    expect(history).toHaveLength(50);
    expect(history[0].id).toBe("entry-52");
    expect(history[49].id).toBe("entry-3");
  });
});

// ─── saveEntry — setItem throwing ────────────────────────────────────────────

describe("testCallHistory - setItem failure is swallowed (#1123)", () => {
  it("does not throw when localStorage.setItem throws (storage full simulation)", () => {
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    expect(() => saveEntry(makeIdEntry("quota-fail"))).not.toThrow();
  });

  it("does not throw when setItem throws a generic Error", () => {
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => saveEntry(makeIdEntry("blocked-fail"))).not.toThrow();
  });

  it("pre-existing entries are unaffected when a subsequent setItem throws", () => {
    // Save one entry successfully first
    saveEntry(makeIdEntry("safe-entry"));
    // Now break setItem
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    // This save will fail silently
    saveEntry(makeIdEntry("failed-entry"));
    // The first entry should still be in storage (set before the mock)
    vi.restoreAllMocks();
    const history = loadHistory();
    expect(history.some((e) => e.id === "safe-entry")).toBe(true);
  });
});

// ─── clearHistory ─────────────────────────────────────────────────────────────

describe("testCallHistory - clearHistory (#1123)", () => {
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
    saveEntry(makeIdEntry("after-clear"));
    const history = loadHistory();
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe("after-clear");
  });

  it("clearHistory removes the key from localStorage", () => {
    saveEntry(makeIdEntry("x"));
    clearHistory();
    expect(localStorage.getItem(HISTORY_KEY)).toBeNull();
  });

  it("clearHistory does not throw when localStorage.removeItem throws", () => {
    vi.spyOn(localStorage, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => clearHistory()).not.toThrow();
  });
});

// ─── Round-trip integrity ─────────────────────────────────────────────────────

describe("testCallHistory - round-trip integrity (#1123)", () => {
  it("all HistoryEntry fields survive a save/load round-trip", () => {
    const entry: HistoryEntry = {
      id: "rt-1",
      // Must fall inside the 7-day retention window (#1185) to survive load.
      timestamp: new Date().toISOString(),
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
