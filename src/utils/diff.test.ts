import { describe, it, expect } from 'vitest';
import { computeDiff, diffJson, hasDifferences } from './diff';
import type { DiffLine } from './diff';

// ──────────────────────────────────────────────────────────────────────────────
// computeDiff
// ──────────────────────────────────────────────────────────────────────────────

describe('computeDiff', () => {
  // ── Identical inputs ────────────────────────────────────────────────────────

  it('returns only unchanged lines when inputs are identical', () => {
    const lines = computeDiff('a\nb\nc', 'a\nb\nc');
    expect(lines.every((l) => l.type === 'unchanged')).toBe(true);
  });

  it('returns a single unchanged line for identical single-line inputs', () => {
    const lines = computeDiff('hello', 'hello');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toEqual({ type: 'unchanged', value: 'hello', lineA: 1, lineB: 1 });
  });

  // ── Empty inputs ────────────────────────────────────────────────────────────

  it('handles both inputs empty', () => {
    const lines = computeDiff('', '');
    // Single empty line is the product of splitting '' on '\n'
    expect(lines).toHaveLength(1);
    expect(lines[0].type).toBe('unchanged');
    expect(lines[0].value).toBe('');
  });

  it('treats non-empty → empty as a fully-removed diff', () => {
    const lines = computeDiff('line1\nline2', '');
    const types = lines.map((l) => l.type);
    // The empty string produces one line ('') — all original lines are removed
    // and one empty line is added (or one is unchanged depending on trailing)
    expect(types).toContain('removed');
  });

  it('treats empty → non-empty as a fully-added diff', () => {
    const lines = computeDiff('', 'line1\nline2');
    const types = lines.map((l) => l.type);
    expect(types).toContain('added');
  });

  // ── Single line change ──────────────────────────────────────────────────────

  it('marks the old line as removed and the new line as added for a one-line change', () => {
    const lines = computeDiff('{"a":1}', '{"a":2}');
    expect(lines.some((l) => l.type === 'removed' && l.value === '{"a":1}')).toBe(true);
    expect(lines.some((l) => l.type === 'added'   && l.value === '{"a":2}')).toBe(true);
  });

  // ── Multi-line diff ─────────────────────────────────────────────────────────

  it('keeps unchanged context lines and marks changes correctly', () => {
    const before = 'a\nb\nc';
    const after  = 'a\nX\nc';
    const lines = computeDiff(before, after);

    const unchanged = lines.filter((l) => l.type === 'unchanged').map((l) => l.value);
    const removed   = lines.filter((l) => l.type === 'removed').map((l) => l.value);
    const added     = lines.filter((l) => l.type === 'added').map((l) => l.value);

    expect(unchanged).toContain('a');
    expect(unchanged).toContain('c');
    expect(removed).toContain('b');
    expect(added).toContain('X');
  });

  // ── Line-number assignment ──────────────────────────────────────────────────

  it('assigns consecutive lineA numbers to unchanged and removed lines', () => {
    const lines = computeDiff('a\nb\nc', 'a\nc');
    const withLineA = lines.filter((l) => l.lineA !== null);
    const nums = withLineA.map((l) => l.lineA as number);
    // lineA numbers should be strictly increasing
    for (let i = 1; i < nums.length; i++) {
      expect(nums[i]).toBeGreaterThan(nums[i - 1]);
    }
  });

  it('assigns consecutive lineB numbers to unchanged and added lines', () => {
    const lines = computeDiff('a\nc', 'a\nb\nc');
    const withLineB = lines.filter((l) => l.lineB !== null);
    const nums = withLineB.map((l) => l.lineB as number);
    for (let i = 1; i < nums.length; i++) {
      expect(nums[i]).toBeGreaterThan(nums[i - 1]);
    }
  });

  it('sets lineA to null for added lines', () => {
    const lines = computeDiff('a', 'a\nnew');
    const added = lines.filter((l) => l.type === 'added');
    expect(added.every((l) => l.lineA === null)).toBe(true);
  });

  it('sets lineB to null for removed lines', () => {
    const lines = computeDiff('a\nold', 'a');
    const removed = lines.filter((l) => l.type === 'removed');
    expect(removed.every((l) => l.lineB === null)).toBe(true);
  });

  it('assigns lineA=1 and lineB=1 to the first unchanged line', () => {
    const lines = computeDiff('first\nsecond', 'first\nsecond');
    expect(lines[0].lineA).toBe(1);
    expect(lines[0].lineB).toBe(1);
  });

  // ── Line-ending normalisation ───────────────────────────────────────────────

  it('treats \\r\\n and \\n line endings as equivalent', () => {
    const unix    = computeDiff('a\nb\nc', 'a\nX\nc');
    const windows = computeDiff('a\r\nb\r\nc', 'a\r\nX\r\nc');

    // Both should produce the same diff shape
    expect(unix.map((l) => l.type)).toEqual(windows.map((l) => l.type));
    expect(unix.map((l) => l.value)).toEqual(windows.map((l) => l.value));
  });

  it('treats \\r and \\n line endings as equivalent', () => {
    const cr  = computeDiff('a\rb\rc', 'a\rX\rc');
    const lf  = computeDiff('a\nb\nc', 'a\nX\nc');
    expect(cr.map((l) => l.type)).toEqual(lf.map((l) => l.type));
  });

  // ── Result ordering ─────────────────────────────────────────────────────────

  it('returns lines in sequential document order', () => {
    const lines = computeDiff('1\n2\n3\n4', '1\n3\n4\n5');
    // Content should be in the order 1, 2/removed, 3, 4, 5/added
    const values = lines.map((l) => l.value);
    const idx1 = values.indexOf('1');
    const idx3 = values.indexOf('3');
    const idx4 = values.indexOf('4');
    expect(idx1).toBeLessThan(idx3);
    expect(idx3).toBeLessThan(idx4);
  });

  // ── Large / realistic JSON ──────────────────────────────────────────────────

  it('handles realistic multi-key JSON objects', () => {
    const a = JSON.stringify({ name: 'Alice', score: 10, active: true }, null, 2);
    const b = JSON.stringify({ name: 'Alice', score: 99, active: false }, null, 2);
    const lines = computeDiff(a, b);
    const removed = lines.filter((l) => l.type === 'removed').map((l) => l.value);
    const added   = lines.filter((l) => l.type === 'added').map((l) => l.value);
    expect(removed.some((v) => v.includes('10'))).toBe(true);
    expect(added.some((v) => v.includes('99'))).toBe(true);
    expect(removed.some((v) => v.includes('true'))).toBe(true);
    expect(added.some((v) => v.includes('false'))).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// diffJson
// ──────────────────────────────────────────────────────────────────────────────

describe('diffJson', () => {
  it('returns unchanged lines for identical objects', () => {
    const obj = { key: 'value', count: 3 };
    const lines = diffJson(obj, obj);
    expect(lines.every((l) => l.type === 'unchanged')).toBe(true);
  });

  it('detects a changed field value', () => {
    const lines = diffJson({ status: 'ok' }, { status: 'error' });
    expect(lines.some((l) => l.type === 'removed' && l.value.includes('ok'))).toBe(true);
    expect(lines.some((l) => l.type === 'added'   && l.value.includes('error'))).toBe(true);
  });

  it('detects an added field', () => {
    const lines = diffJson({ a: 1 }, { a: 1, b: 2 });
    expect(lines.some((l) => l.type === 'added' && l.value.includes('"b"'))).toBe(true);
  });

  it('detects a removed field', () => {
    const lines = diffJson({ a: 1, b: 2 }, { a: 1 });
    expect(lines.some((l) => l.type === 'removed' && l.value.includes('"b"'))).toBe(true);
  });

  it('handles null values', () => {
    expect(() => diffJson(null, null)).not.toThrow();
    const lines = diffJson(null, null);
    expect(lines.every((l) => l.type === 'unchanged')).toBe(true);
  });

  it('handles undefined values (serialised as null)', () => {
    // JSON.stringify(undefined) returns undefined — fallback to 'null' string
    expect(() => diffJson(undefined, undefined)).not.toThrow();
  });

  it('handles array inputs', () => {
    const lines = diffJson([1, 2, 3], [1, 2, 4]);
    expect(lines.some((l) => l.type === 'removed' && l.value.includes('3'))).toBe(true);
    expect(lines.some((l) => l.type === 'added'   && l.value.includes('4'))).toBe(true);
  });

  it('handles primitive string inputs', () => {
    expect(() => diffJson('hello', 'world')).not.toThrow();
  });

  it('returns DiffLine objects (correct shape)', () => {
    const lines = diffJson({ x: 1 }, { x: 2 });
    for (const line of lines) {
      expect(typeof line.type).toBe('string');
      expect(['added', 'removed', 'unchanged']).toContain(line.type);
      expect(typeof line.value).toBe('string');
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// hasDifferences
// ──────────────────────────────────────────────────────────────────────────────

describe('hasDifferences', () => {
  it('returns false for an all-unchanged diff', () => {
    const lines: DiffLine[] = [
      { type: 'unchanged', value: 'a', lineA: 1, lineB: 1 },
      { type: 'unchanged', value: 'b', lineA: 2, lineB: 2 },
    ];
    expect(hasDifferences(lines)).toBe(false);
  });

  it('returns true when at least one added line is present', () => {
    const lines: DiffLine[] = [
      { type: 'unchanged', value: 'a', lineA: 1, lineB: 1 },
      { type: 'added',     value: 'b', lineA: null, lineB: 2 },
    ];
    expect(hasDifferences(lines)).toBe(true);
  });

  it('returns true when at least one removed line is present', () => {
    const lines: DiffLine[] = [
      { type: 'removed',   value: 'a', lineA: 1, lineB: null },
      { type: 'unchanged', value: 'b', lineA: 2, lineB: 1 },
    ];
    expect(hasDifferences(lines)).toBe(true);
  });

  it('returns false for an empty array', () => {
    expect(hasDifferences([])).toBe(false);
  });

  it('returns true for identical JSON objects diffed via diffJson (no changes)', () => {
    const lines = diffJson({ a: 1 }, { a: 1 });
    expect(hasDifferences(lines)).toBe(false);
  });

  it('returns true when diffJson detects a change', () => {
    const lines = diffJson({ a: 1 }, { a: 2 });
    expect(hasDifferences(lines)).toBe(true);
  });
});
