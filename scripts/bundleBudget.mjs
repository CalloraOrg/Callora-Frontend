/**
 * Pure helpers for the bundle-size budget check.
 *
 * Kept separate from `check-bundle-size.mjs` so the classification and limit
 * comparison rules can be unit tested without touching the filesystem.
 */

export const KIB = 1024;

/**
 * Classifies an emitted asset as the entry chunk, a lazy chunk, or CSS.
 *
 * CSS always uses the `css` budget, even when `index.html` references it.
 * JavaScript referenced by `index.html` is the entry chunk; every other
 * JavaScript file is treated as a lazy chunk.
 *
 * @param {string} file Asset filename, e.g. `index-Ctqu-rL1.js`.
 * @param {Set<string>} entryFiles Filenames referenced by `dist/index.html`.
 * @returns {'entry' | 'chunk' | 'css'}
 */
export function classifyAsset(file, entryFiles) {
  if (file.toLowerCase().endsWith('.css')) return 'css';
  return entryFiles.has(file) ? 'entry' : 'chunk';
}

/**
 * Extracts local asset filenames referenced by `dist/index.html`.
 *
 * Handles hashed filenames, absolute paths, and query strings. External URLs
 * and non-asset links are ignored.
 *
 * @param {string} html Contents of `dist/index.html`.
 * @returns {Set<string>}
 */
export function extractEntryFiles(html) {
  const files = new Set();
  const attributePattern = /(?:src|href)\s*=\s*["']([^"']+)["']/gi;

  for (const match of html.matchAll(attributePattern)) {
    const url = match[1].split(/[?#]/, 1)[0];
    const assetMatch = url.match(/\/assets\/([^/]+)$/);
    if (assetMatch) files.add(decodeURIComponent(assetMatch[1]));
  }

  return files;
}

/**
 * Compares each asset's gzip size with the budget for its kind.
 *
 * A missing or non-numeric limit means "no limit" for that kind. Limits are
 * expressed in KiB (1024 bytes) to match the report.
 *
 * @param {Array<{file: string, kind: 'entry'|'chunk'|'css', rawBytes: number, gzipBytes: number}>} assets
 * @param {Record<string, number>} budget
 * @returns {{
 *   results: Array<Record<string, unknown>>,
 *   failures: Array<Record<string, unknown>>,
 *   passed: boolean,
 * }}
 */
export function evaluateBudget(assets, budget) {
  const results = [];
  const failures = [];

  for (const asset of assets) {
    const configuredLimit = budget?.[asset.kind];
    const hasLimit =
      typeof configuredLimit === 'number' &&
      Number.isFinite(configuredLimit) &&
      configuredLimit >= 0;
    const limitBytes = hasLimit ? Math.round(configuredLimit * KIB) : null;
    const exceeded = limitBytes !== null && asset.gzipBytes > limitBytes;
    const result = {
      ...asset,
      limitKb: hasLimit ? configuredLimit : null,
      limitBytes,
      exceeded,
    };

    results.push(result);
    if (exceeded) failures.push(result);
  }

  return { results, failures, passed: failures.length === 0 };
}

/**
 * Formats a byte count as KiB for the human-readable report.
 *
 * @param {number} bytes
 * @returns {string}
 */
export function formatKb(bytes) {
  return `${(bytes / KIB).toFixed(2)} kB`;
}
