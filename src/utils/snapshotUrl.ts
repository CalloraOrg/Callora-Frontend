// src/utils/snapshotUrl.ts

/**
 * Generates a shareable URL snapshot capturing current endpoint and parameters.
 * Parameters are URL-encoded and added as query string for easy sharing.
 */

export interface EndpointSnapshot {
  endpointId: string;
  params: Record<string, unknown> | null;
}

/**
 * Case-insensitive set of parameter key patterns that may carry secret values.
 * Any param key matching one of these patterns is stripped before the snapshot
 * is encoded into the URL, so credentials never enter browser history,
 * server logs, or shared links.
 *
 * Matches are performed on the lowercased key; a key is redacted when it
 * *contains* any of these substrings.
 */
export const SENSITIVE_PARAM_PATTERNS: readonly string[] = [
  'key',
  'token',
  'secret',
  'password',
  'passwd',
  'pass',
  'auth',
  'authorization',
  'credential',
  'apikey',
  'api_key',
  'access',
  'private',
  'signing',
  'bearer',
  'session',
  'jwt',
  'x-api',
];

/**
 * Returns true when a parameter key should be treated as sensitive and must
 * not be embedded in a shareable URL.
 *
 * The check is intentionally broad: a key is flagged when its lowercased form
 * *contains* any of the patterns above.  This catches both camelCase
 * ("apiKey") and snake_case ("api_key") variants without requiring an exact
 * match.
 */
export function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_PARAM_PATTERNS.some((pattern) => lower.includes(pattern));
}

/**
 * Returns a shallow copy of `params` with all sensitive keys removed.
 * Non-sensitive keys are forwarded unchanged.
 *
 * This is the authoritative scrubbing step that must be applied before any
 * params are encoded into a URL or written to the clipboard.
 */
export function redactSensitiveParams(
  params: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (!isSensitiveKey(key)) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Serializes endpoint state to a URL-safe query string format.
 * - params: JSON stringified and base64 encoded to handle complex objects
 * - Handles circular references gracefully by catching errors
 *
 * SECURITY: sensitive parameter keys (auth tokens, API keys, passwords, etc.)
 * are stripped by `redactSensitiveParams` before encoding.  This prevents
 * secret values from entering browser history, server-side request logs, or
 * shared links.
 */
export function generateSnapshotUrl(
  basePath: string,
  snapshot: EndpointSnapshot,
): string {
  const urlParams = new URLSearchParams();
  urlParams.set('endpoint', snapshot.endpointId);

  if (snapshot.params) {
    try {
      // Strip sensitive keys before encoding — secrets must never enter the URL.
      const safeParams = redactSensitiveParams(snapshot.params);

      // Only include the params segment when there is at least one safe key.
      if (Object.keys(safeParams).length > 0) {
        const json = JSON.stringify(safeParams);
        // Use encodeURIComponent to handle Unicode, then btoa for binary-safe base64
        const encoded = btoa(unescape(encodeURIComponent(json)));
        urlParams.set('params', encoded);
      }
    } catch {
      // Silently fail if JSON serialization fails; no partial data leaks out.
    }
  }

  return `${basePath}?${urlParams.toString()}`;
}

/**
 * Parses a snapshot URL and extracts endpoint state.
 * Returns null if params are malformed or missing.
 */
export function parseSnapshotUrl(
  search: string,
): EndpointSnapshot | null {
  const params = new URLSearchParams(search);
  const endpointId = params.get('endpoint');

  if (!endpointId) {
    return null;
  }

  const paramsEncoded = params.get('params');
  let parsedParams: Record<string, unknown> | null = null;

  if (paramsEncoded) {
    try {
      // Decode: atob -> escape -> decodeURIComponent to get original JSON
      const json = decodeURIComponent(escape(atob(paramsEncoded)));
      parsedParams = JSON.parse(json);
    } catch {
      // Malformed params, silently ignore
    }
  }

  return {
    endpointId,
    params: parsedParams,
  };
}

/**
 * Copies a snapshot URL to clipboard for sharing.
 * Returns true if successful, false otherwise.
 */
export async function copySnapshotUrl(
  basePath: string,
  snapshot: EndpointSnapshot,
): Promise<boolean> {
  const url = generateSnapshotUrl(basePath, snapshot);
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}