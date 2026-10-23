// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Read the compiled index.css and verify that every .status-chip
 * variant carries the expected SVG pattern background.
 *
 * We parse the raw CSS on disk to avoid jsdom's inability to resolve
 * CSS url() data URIs in computed styles.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const INDEX_CSS_PATH = resolve(__dirname, '../index.css');
const css = readFileSync(INDEX_CSS_PATH, 'utf-8');

function extractBlock(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${escaped}\\s*\\{([^}]+)\\}`, 'i');
  const m = re.exec(css);
  return m ? m[1].trim() : '';
}

describe('status-chip color-blind patterns', () => {
  it('.status-chip.pending uses a dot pattern (circle SVG)', () => {
    const block = extractBlock('.status-chip.pending');
    expect(block).toContain('data:image/svg+xml');
    expect(block).toContain('%3Ccircle');  // URL-encoded <circle
    expect(block).not.toContain('stroke');
  });

  it('.status-chip.failed uses diagonal stripes (╲)', () => {
    const block = extractBlock('.status-chip.failed');
    expect(block).toContain('data:image/svg+xml');
    expect(block).toContain('%3Cline');  // URL-encoded <line
    // SVG uses single-quoted attributes; these are NOT url-encoded
    expect(block).toContain("x1='0' y1='0' x2='6' y2='6'");
  });

  it('.status-chip.approving uses opposite diagonal stripes (╱)', () => {
    const block = extractBlock('.status-chip.approving');
    expect(block).toContain('data:image/svg+xml');
    expect(block).toContain('%3Cline');
    expect(block).toContain("x1='0' y1='8' x2='8' y2='0'");
  });

  it('.status-chip.confirmed has no pattern (solid baseline)', () => {
    const block = extractBlock('.status-chip.confirmed');
    expect(block).not.toContain('data:image/svg+xml');
    expect(block).toContain('background:');
  });

  it('.status-chip.input has no pattern (neutral)', () => {
    const block = extractBlock('.status-chip.input');
    expect(block).not.toContain('data:image/svg+xml');
  });

  it('each patterned variant uses a distinct SVG data URI', () => {
    const pending = extractBlock('.status-chip.pending');
    const failed = extractBlock('.status-chip.failed');
    const approving = extractBlock('.status-chip.approving');

    const pendingUri = pending.match(/url\("([^"]+)"\)/)?.[1] ?? '';
    const failedUri = failed.match(/url\("([^"]+)"\)/)?.[1] ?? '';
    const approvingUri = approving.match(/url\("([^"]+)"\)/)?.[1] ?? '';

    const pendingDecoded = decodeURIComponent(pendingUri);
    const failedDecoded = decodeURIComponent(failedUri);
    const approvingDecoded = decodeURIComponent(approvingUri);

    expect(pendingDecoded).not.toBe(failedDecoded);
    expect(failedDecoded).not.toBe(approvingDecoded);
    expect(pendingDecoded).not.toBe(approvingDecoded);
  });
});
