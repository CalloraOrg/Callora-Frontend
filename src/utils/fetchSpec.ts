/**
 * fetchSpec.ts
 *
 * Fetches an OpenAPI specification document from a URL with:
 *   - https-only scheme enforcement (http://localhost is also permitted)
 *   - Credential rejection (URL must not carry a username or password)
 *   - Configurable timeout via AbortSignal
 *   - Size cap enforced both by Content-Length header and by streaming body
 *   - User-facing ParseError messages for every failure mode
 *
 * The returned { text, filename } can be fed directly into parseOpenApiSpec().
 */

import type { ParseError } from './openapi-parse';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type FetchSpecOptions = {
  /** An AbortSignal the caller can use to cancel the request. */
  signal?: AbortSignal;
  /** Request timeout in milliseconds (default: 10 000). */
  timeoutMs?: number;
  /** Maximum response body size in bytes (default: 2 MiB). */
  maxBytes?: number;
};

export type FetchSpecResult = {
  text: string;
  /** Derived filename for the parser (from the URL path or Content-Type). */
  filename: string;
};

export type FetchSpecError = {
  kind: 'fetchError';
  errors: ParseError[];
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024; // 2 MiB

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive a filename for parseOpenApiSpec() from a URL.
 *
 * Uses the last non-empty path segment when it carries a known extension
 * (.json / .yaml / .yml).  Falls back to the Content-Type header, then to
 * "spec.json" so the JSON path is always attempted.
 */
export function deriveFilename(url: URL, contentType: string | null): string {
  const segments = url.pathname.split('/').filter(Boolean);
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i].toLowerCase();
    if (seg.endsWith('.json') || seg.endsWith('.yaml') || seg.endsWith('.yml')) {
      return segments[i];
    }
  }

  // Fall back to Content-Type
  if (contentType) {
    const ct = contentType.toLowerCase();
    if (ct.includes('yaml')) return 'spec.yaml';
    if (ct.includes('json')) return 'spec.json';
  }

  return 'spec.json';
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Fetch an OpenAPI specification from a URL and return its text content and a
 * derived filename.
 *
 * All failure paths resolve (not reject) to a FetchSpecError so callers never
 * need a try/catch.
 */
export async function fetchSpecFromUrl(
  rawUrl: string,
  options: FetchSpecOptions = {},
): Promise<FetchSpecResult | FetchSpecError> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, maxBytes = DEFAULT_MAX_BYTES, signal } = options;

  // ── 1. Parse and validate the URL ───────────────────────────────────────

  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return {
      kind: 'fetchError',
      errors: [{ message: `"${rawUrl}" is not a valid URL.` }],
    };
  }

  // Scheme check: allow https:// and http://localhost only.
  const isHttps = url.protocol === 'https:';
  const isLocalhost =
    url.protocol === 'http:' &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1');

  if (!isHttps && !isLocalhost) {
    return {
      kind: 'fetchError',
      errors: [
        {
          message:
            `"${url.protocol}//" URLs are not supported. Use an https:// URL (or http://localhost for local development).`,
        },
      ],
    };
  }

  // Reject credentials embedded in the URL (username or password).
  if (url.username || url.password) {
    return {
      kind: 'fetchError',
      errors: [
        {
          message:
            'The URL must not contain a username or password. Remove credentials from the URL and retry.',
        },
      ],
    };
  }

  // ── 2. Build a composite AbortSignal (caller + timeout) ─────────────────

  const timeoutController = new AbortController();

  // Compose the caller's signal with our timeout signal.
  const signals: AbortSignal[] = [timeoutController.signal];
  if (signal) signals.push(signal);

  // AbortSignal.any() is not universally available yet; wire them manually.
  const composedController = new AbortController();
  const abortComposed = () => composedController.abort(timeoutController.signal.reason);
  signals.forEach((s) => {
    if (s.aborted) {
      composedController.abort(s.reason);
    } else {
      s.addEventListener('abort', () => composedController.abort(s.reason), { once: true });
    }
  });

  const timeoutHandle: ReturnType<typeof setTimeout> = setTimeout(() => {
    timeoutController.abort('timeout');
    abortComposed();
  }, timeoutMs);

  // ── 3. Make the request ──────────────────────────────────────────────────

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json, application/yaml, text/yaml, text/plain, */*' },
      signal: composedController.signal,
    });
  } catch (err) {
    clearTimeout(timeoutHandle);

    // Check if the caller's signal (not the timeout) aborted.
    if (signal?.aborted) {
      return { kind: 'fetchError', errors: [{ message: 'Request cancelled.' }] };
    }

    // Timeout
    if (timeoutController.signal.aborted) {
      return {
        kind: 'fetchError',
        errors: [
          {
            message: `The request timed out after ${timeoutMs / 1000} seconds. The server may be slow or unreachable.`,
          },
        ],
      };
    }

    // A TypeError here is almost always a CORS or network failure.
    if (err instanceof TypeError) {
      return {
        kind: 'fetchError',
        errors: [
          {
            message:
              'Could not fetch the URL. The server may not allow cross-origin requests; download the file and upload it instead.',
          },
        ],
      };
    }

    return {
      kind: 'fetchError',
      errors: [
        {
          message: `Network error: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
    };
  } finally {
    clearTimeout(timeoutHandle);
  }

  // ── 4. Check HTTP status ─────────────────────────────────────────────────

  if (!response.ok) {
    return {
      kind: 'fetchError',
      errors: [
        {
          message: `The server returned HTTP ${response.status} (${response.statusText || 'error'}). Check the URL and try again.`,
        },
      ],
    };
  }

  // ── 5. Check Content-Length before reading the body ──────────────────────

  const contentLength = response.headers.get('content-length');
  if (contentLength !== null) {
    const declared = parseInt(contentLength, 10);
    if (Number.isFinite(declared) && declared > maxBytes) {
      return {
        kind: 'fetchError',
        errors: [
          {
            message: `The response is too large (${Math.round(declared / 1024)} KB). The limit is ${Math.round(maxBytes / 1024)} KB.`,
          },
        ],
      };
    }
  }

  // ── 6. Stream the body, enforcing the size cap ───────────────────────────

  const contentType = response.headers.get('content-type');
  const filename = deriveFilename(url, contentType);

  if (!response.body) {
    // Fallback for environments without streaming (e.g. some test runners).
    const text = await response.text();
    if (text.length > maxBytes) {
      return {
        kind: 'fetchError',
        errors: [
          {
            message: `The response is too large (${Math.round(text.length / 1024)} KB). The limit is ${Math.round(maxBytes / 1024)} KB.`,
          },
        ],
      };
    }
    return { text, filename };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.length;
        if (totalBytes > maxBytes) {
          reader.cancel().catch(() => undefined);
          return {
            kind: 'fetchError',
            errors: [
              {
                message: `The response is too large (exceeded ${Math.round(maxBytes / 1024)} KB). The limit is ${Math.round(maxBytes / 1024)} KB.`,
              },
            ],
          };
        }
        chunks.push(value);
      }
    }
  } catch (err) {
    if (signal?.aborted) {
      return { kind: 'fetchError', errors: [{ message: 'Request cancelled.' }] };
    }
    if (timeoutController.signal.aborted) {
      return {
        kind: 'fetchError',
        errors: [
          {
            message: `The request timed out after ${timeoutMs / 1000} seconds. The server may be slow or unreachable.`,
          },
        ],
      };
    }
    return {
      kind: 'fetchError',
      errors: [
        {
          message: `Failed to read response body: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
    };
  }

  // Decode the concatenated chunks as UTF-8.
  const decoder = new TextDecoder('utf-8');
  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  const text = decoder.decode(combined);

  return { text, filename };
}
