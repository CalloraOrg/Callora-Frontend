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
 * Set of sensitive parameter name tokens.  A parameter key is considered
 * sensitive when any of its word-level tokens — obtained by splitting
 * camelCase and delimiter-separated names — exactly matches one of these
 * entries (case-insensitive).
 *
 * This word-level matching catches compound forms like "apiKey" and
 * "api_key" while avoiding false positives on benign names like "keyword",
 * "passengers", or "monkey".
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
];

/**
 * Decomposes a parameter key into individual word tokens by:
 * 1. Splitting camelCase boundaries (e.g. "apiKey" → ["api", "Key"])
 * 2. Splitting on common delimiters: underscores, hyphens, dots, colons,
 *    and whitespace
 * 3. Lowercasing all tokens
 * 4. Filtering out empty strings
 *
 * This enables exact word-level matching so that "apiKey" is detected as
 * sensitive (contains the word "key") while "keyword" is not (it is a
 * single, indivisible word).
 */
export function tokenizeKey(key: string): string[] {
  return key
    // Insert a split point before an uppercase letter preceded by a lowercase
    // letter, e.g. "apiKey" → "api_Key", "clientSecret" → "client_Secret"
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    // Insert a split point between a run of uppercase letters and an uppercase
    // letter followed by lowercase, e.g. "XMLParser" → "XML_Parser"
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    // Split on underscores, hyphens, dots, colons, and whitespace
    .split(/[_\-.:\s]+/)
    .map((t) => t.toLowerCase())
    .filter((t) => t.length > 0);
}

/** Pre-computed Set for O(1) token lookups. */
const SENSITIVE_TOKEN_SET: ReadonlySet<string> = new Set(
  SENSITIVE_PARAM_PATTERNS.map((p) => p.toLowerCase()),
);

/**
 * Returns true when a parameter key should be treated as sensitive and must
 * not be embedded in a shareable URL.
 *
 * The key is first decomposed into word-level tokens (splitting camelCase
 * and delimiter-separated names), and each token is checked for an exact
 * match against {@link SENSITIVE_PARAM_PATTERNS}.  This catches compound
 * names like "apiKey" and "api_key" while avoiding false positives on
 * benign words like "keyword" or "passengers".
 */
export function isSensitiveKey(key: string): boolean {
  const tokens = tokenizeKey(key);
  return tokens.some((token) => SENSITIVE_TOKEN_SET.has(token));
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