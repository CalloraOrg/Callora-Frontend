/**
 * ETag middleware with strong validators.
 *
 * Generates strong ETags (SHA-256 content hash) for HTTP responses
 * so that clients can use conditional requests (If-None-Match) to
 * avoid transferring unchanged data.
 *
 * Strong validators vs weak validators
 * ------------------------------------
 * A strong validator (no `W/` prefix) guarantees that the associated
 * representation is byte-for-byte identical.  Weak validators (`W/"..."`)
 * only guarantee semantic equivalence, not byte identity.
 * This module exclusively produces strong validators.
 *
 * Usage
 * -----
 * ```ts
 * import { etag } from '../middleware/etag';
 *
 * const body = JSON.stringify(data);
 * const requestEtag = req.headers['if-none-match'];
 * const status = etag(body, requestEtag);
 * // status === 304 → Not Modified (send no body)
 * // status === 200 → OK (send body with ETag header)
 * ```
 */

/**
 * Compute a strong ETag for the given content.
 *
 * The tag is `"<hex-sha256>"` — a double-quoted string whose inner
 * value is the lowercase hex SHA-256 digest of `content`.
 * This is a strong validator because it is sensitive to every byte.
 *
 * @param content - The response body whose hash becomes the ETag.
 * @returns A strong ETag string, e.g. `"a3f2b8c..."`.
 */
export async function computeETag(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `"${hashHex}"`;
}

/**
 * Evaluate the If-None-Match header against the current ETag.
 *
 * Returns the HTTP status code the server should respond with:
 *   304 → client's ETag matches; body is unchanged (Not Modified)
 *   200 → client's ETag differs or is absent; serve the new body
 *
 * A weak comparison (`W/"..."`) is NOT accepted — strong validators
 * require an exact string match (RFC 9110 §8.3.2).
 *
 * @param clientEtag  - Value of the `If-None-Match` request header (may be undefined).
 * @param serverEtag  - Current ETag generated from the response body.
 * @returns `304` if the client already has the latest representation; `200` otherwise.
 */
export function checkETag(
  clientEtag: string | undefined,
  serverEtag: string,
): number {
  if (!clientEtag) return 200;
  const trimmed = clientEtag.trim();
  // Weak comparison prefix is not accepted for strong validators.
  if (trimmed.startsWith("W/")) return 200;
  // Strip surrounding double-quotes for comparison.
  // Both "abc" and abc (unquoted) normalize to abc.
  const stripQuotes = (tag: string) => tag.replace(/^"(.*)"$/, "$1");
  const clientStripped = stripQuotes(trimmed);
  const serverStripped = stripQuotes(serverEtag);
  return clientStripped === serverStripped ? 304 : 200;
}

/**
 * Apply ETag headers to a response-like object and return the status code.
 *
 * This is the primary middleware entry point: it computes a strong ETag
 * for the body, checks the client's If-None-Match header, and sets the
 * appropriate response headers.
 *
 * @param body           - The serialized response body string.
 * @param requestEtag    - The value of `If-None-Match` from the client request.
 * @param headers        - A mutable headers record to set `ETag` and `Cache-Control` on.
 * @returns `304` if Not Modified; `200` otherwise.
 */
export async function applyETag(
  body: string,
  requestEtag: string | undefined,
  headers: Record<string, string>,
): Promise<number> {
  const eTag = await computeETag(body);
  headers["ETag"] = eTag;
  headers["Cache-Control"] = "no-cache";
  const status = checkETag(requestEtag, eTag);
  return status;
}

// ---------------------------------------------------------------------------
// Structured logger (correlation ID support)
// ---------------------------------------------------------------------------

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  level: LogLevel;
  message: string;
  correlationId: string;
  timestamp: string;
  [key: string]: unknown;
}

/**
 * Create a structured log entry with a correlation ID.
 *
 * The correlation ID is generated once per call and attached to the entry,
 * so every log line in a request lifecycle shares the same ID for tracing.
 *
 * @param level       - Log severity.
 * @param message     - Human-readable log message.
 * @param correlationId - Unique request identifier.
 * @param extra       - Optional additional fields attached to the log entry.
 * @returns A frozen log entry object suitable for JSON serialization.
 */
export function log(
  level: LogLevel,
  message: string,
  correlationId: string,
  extra?: Record<string, unknown>,
): Readonly<LogEntry> {
  const entry: LogEntry = {
    level,
    message,
    correlationId,
    timestamp: new Date().toISOString(),
    ...extra,
  };
  return Object.freeze(entry);
}

/**
 * Generate a random correlation ID for request tracing.
 *
 * Uses `crypto.getRandomValues` for cryptographic-quality randomness.
 * The output is a 16-character hex string suitable for log correlation.
 *
 * @returns A `16`-character hexadecimal correlation ID string.
 */
export function generateCorrelationId(): string {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
