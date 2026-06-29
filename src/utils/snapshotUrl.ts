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
 * Serializes endpoint state to a URL-safe query string format.
 * - params: JSON stringified and base64 encoded to handle complex objects
 * - Handles circular references gracefully by catching errors
 */
export function generateSnapshotUrl(
  basePath: string,
  snapshot: EndpointSnapshot,
): string {
  const params = new URLSearchParams();
  params.set('endpoint', snapshot.endpointId);

  if (snapshot.params) {
    try {
      const json = JSON.stringify(snapshot.params);
      // Use encodeURIComponent to handle Unicode, then btoa for binary-safe base64
      const encoded = btoa(unescape(encodeURIComponent(json)));
      params.set('params', encoded);
    } catch {
      // Silently fail if JSON serialization fails
    }
  }

  return `${basePath}?${params.toString()}`;
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