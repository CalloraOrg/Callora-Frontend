export const MAX_COMPARE_IDS = 3;
export const MAX_COMPARE_ID_LENGTH = 128;

function sanitizeIds(rawIds: readonly string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const raw of rawIds) {
    const id = raw.trim();
    if (!id || id.length > MAX_COMPARE_ID_LENGTH || seen.has(id)) {
      continue;
    }
    seen.add(id);
    result.push(id);
    if (result.length >= MAX_COMPARE_IDS) {
      break;
    }
  }

  return result;
}

/**
 * Parse the `?ids=` query parameter into a deduplicated, bounded list of API IDs.
 * Drops empty, whitespace-only, and oversized IDs, and caps the result at 3.
 */
export function parseCompareIds(search: string): string[] {
  if (!search) return [];
  const params = new URLSearchParams(search);
  const raw = params.get("ids");
  if (!raw) return [];
  return sanitizeIds(raw.split(","));
}

/**
 * Build a shareable `/marketplace?ids=...` URL for the given API IDs.
 * Deduplicates, drops empty/oversized IDs, and caps at 3.
 */
export function buildCompareShareUrl(
  ids: readonly string[],
  origin?: string,
): string {
  const resolvedOrigin =
    origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  const baseOrigin = resolvedOrigin.replace(/\/+$/, "");
  const sanitized = sanitizeIds(ids);

  if (sanitized.length === 0) {
    return `${baseOrigin}/marketplace`;
  }

  const encoded = sanitized.map((id) => encodeURIComponent(id)).join(",");
  return `${baseOrigin}/marketplace?ids=${encoded}`;
}
