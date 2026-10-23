import { redactSensitiveData } from "../services/SecureErrorHandler";

export const STORAGE_KEY = "callora_test_call_history";
export const MAX_ENTRIES = 50;

/**
 * Entries older than this are purged from storage on load (issue #1185).
 * Test-call responses can contain tokens or PII, so nothing is kept forever.
 */
export const HISTORY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Stored request/response bodies are truncated beyond this many characters.
 * 50 entries x (4KB params + 4KB body) stays well within localStorage quota.
 */
export const MAX_BODY_CHARS = 4096;

export const TRUNCATION_MARKER = "[TRUNCATED]";

export interface HistoryEntry {
  id: string;
  timestamp: string;
  endpointId: string;
  endpointName: string;
  endpointPath: string;
  method: string;
  requestParams: string;
  response: unknown;
  status: "success" | "error";
  responseTime: number;
  cost: number;
}

/**
 * Serializes any value to a string without throwing. Circular or otherwise
 * unserializable values degrade to their String() representation.
 */
function safeStringify(value: unknown): string {
  try {
    const json = JSON.stringify(value);
    return json === undefined ? String(value) : json;
  } catch {
    try {
      return String(value);
    } catch {
      return "";
    }
  }
}

/**
 * Stringifies a value, redacts sensitive data from it, and caps its length.
 *
 * String inputs are redacted as-is rather than JSON-encoded first, so storing
 * is idempotent: a value that already went through this function is not
 * wrapped in another layer of quoting on each save/load cycle.
 */
function redactAndCap(value: unknown): string {
  const text = typeof value === "string" ? value : safeStringify(value);
  let redacted = text.length > 0 ? redactSensitiveData(text) : text;
  if (redacted.length > MAX_BODY_CHARS) {
    redacted = `${redacted.slice(0, MAX_BODY_CHARS)}${TRUNCATION_MARKER}`;
  }
  return redacted;
}

/**
 * Redacts and caps a stored response body. Object/array responses are parsed
 * back after redaction so consumers (e.g. the ApiUsage response preview) keep
 * receiving JSON structures; strings, and bodies whose redacted text is no
 * longer valid JSON (e.g. truncated), are stored as plain strings.
 */
function sanitizeBody(value: unknown): unknown {
  if (typeof value === "string") {
    return redactAndCap(value);
  }
  const text = redactAndCap(value);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function sanitizeEntry(entry: HistoryEntry): HistoryEntry {
  return {
    ...entry,
    requestParams: redactAndCap(entry.requestParams),
    response: sanitizeBody(entry.response),
  };
}

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    const cutoff = Date.now() - HISTORY_RETENTION_MS;
    const fresh = parsed.filter((entry): entry is HistoryEntry => {
      if (!entry || typeof entry !== "object") return false;
      const ts = Date.parse(
        String((entry as { timestamp?: unknown }).timestamp ?? ""),
      );
      // Entries without a parseable timestamp cannot be shown to fall inside
      // the retention window, so they are dropped (fail closed).
      return Number.isFinite(ts) && ts >= cutoff;
    });

    // Re-sanitize on load as defense in depth: entries written by older
    // versions of this module may contain unredacted secrets. Sanitization is
    // idempotent, so this never re-encodes already-clean entries.
    const sanitized = fresh.map(sanitizeEntry);

    // Write back when anything was purged, redacted, or dropped so stale or
    // secret-bearing data does not linger in storage.
    const serialized = JSON.stringify(sanitized);
    if (serialized !== raw) {
      try {
        localStorage.setItem(STORAGE_KEY, serialized);
      } catch {
        /* ignore write failures during load */
      }
    }
    return sanitized;
  } catch {
    // Unreadable payload: drop it rather than keep corrupt data around.
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return [];
  }
}

export function saveEntry(entry: HistoryEntry): void {
  if (typeof window === "undefined") return;
  if (!entry || typeof entry !== "object") return;
  try {
    const history = loadHistory();
    const normalized: HistoryEntry = {
      ...entry,
      timestamp:
        typeof entry.timestamp === "string" &&
        Number.isFinite(Date.parse(entry.timestamp))
          ? entry.timestamp
          : new Date().toISOString(),
    };
    history.unshift(sanitizeEntry(normalized));
    if (history.length > MAX_ENTRIES) {
      history.length = MAX_ENTRIES;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    /* storage full or blocked — silently ignore */
  }
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
