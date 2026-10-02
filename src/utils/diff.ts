/**
 * diff.ts — Response diff computation for CallHistoryRow.
 *
 * Produces a line-level diff between two text blobs using the
 * Myers diff algorithm (patience variant via Longest-Common-Subsequence).
 * No runtime dependency — pure TypeScript.
 *
 * Public API
 * ----------
 * computeDiff(a, b)    — compare two arbitrary strings line by line
 * diffJson(a, b)       — convenience wrapper: serialises two unknown values
 *                        to pretty-printed JSON then diffs them
 *
 * Each returned DiffLine carries:
 *   type   — 'added' | 'removed' | 'unchanged'
 *   value  — the line text (without trailing newline)
 *   lineA  — 1-based line number in the "before" text (null for added lines)
 *   lineB  — 1-based line number in the "after"  text (null for removed lines)
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type DiffLineType = 'added' | 'removed' | 'unchanged';

export interface DiffLine {
  /** Whether the line was added, removed, or present in both versions. */
  type: DiffLineType;
  /** Line content (no trailing newline). */
  value: string;
  /** 1-based line number in the original "before" text. null for added lines. */
  lineA: number | null;
  /** 1-based line number in the revised "after"  text. null for removed lines. */
  lineB: number | null;
}

// ─── LCS / Myers diff (internal) ────────────────────────────────────────────

/**
 * Compute the Longest Common Subsequence table for two string arrays.
 * Returns a 2-D memoisation table where lcs[i][j] is the length of the LCS
 * of a[0..i-1] and b[0..j-1].
 *
 * The table is `(m + 1) × (n + 1)` numbers, i.e. ~9M cells for a 3 000-line
 * pair and ~25M for a 5 000-line pair. Those are the sizes this implementation
 * is expected to handle; callers with larger payloads should truncate first.
 */
function buildLcsTable(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  // Allocate (m+1) × (n+1) table initialised to 0
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp;
}

/**
 * Walk the LCS table backwards to produce the diff sequence.
 * Appends DiffLine objects (without line numbers) into `out`.
 *
 * The walk is iterative by design: a recursive version needs one stack frame
 * per input line, so two multi-thousand-line payloads (the sizes
 * `CallHistoryRow`'s compare view can receive) blow the call stack with
 * `RangeError: Maximum call stack size exceeded`. The visit order and the
 * tie-breaking rule (`j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])`) are
 * identical to the recursive form — the entries are collected backwards and
 * reversed once at the end.
 */
function walkLcs(
  dp: number[][],
  a: string[],
  b: string[],
  i: number,
  j: number,
  out: Omit<DiffLine, 'lineA' | 'lineB'>[],
): void {
  const reversed: Omit<DiffLine, 'lineA' | 'lineB'>[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      reversed.push({ type: 'unchanged', value: a[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      reversed.push({ type: 'added', value: b[j - 1] });
      j--;
    } else {
      reversed.push({ type: 'removed', value: a[i - 1] });
      i--;
    }
  }

  for (let k = reversed.length - 1; k >= 0; k--) {
    out.push(reversed[k]);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Compute a line-by-line diff between `before` and `after`.
 *
 * Both arguments are treated as raw text.  Line endings (\r\n or \n) are
 * normalised to \n before splitting so the diff is consistent across
 * platforms.
 *
 * Identical inputs short-circuit: every line is reported as `unchanged` and
 * the `O(n·m)` LCS table is never allocated, so the worst case for repeated
 * comparison of an unchanged large response is a single linear scan.
 *
 * @param before  Original (left / "A") text.
 * @param after   Revised  (right / "B") text.
 * @returns       Ordered array of DiffLine objects with 1-based line numbers.
 *
 * @example
 * const lines = computeDiff('{"a":1}', '{"a":2}');
 * // [
 * //   { type: 'removed', value: '{"a":1}', lineA: 1, lineB: null },
 * //   { type: 'added',   value: '{"a":2}', lineA: null, lineB: 1 },
 * // ]
 */
export function computeDiff(before: string, after: string): DiffLine[] {
  // Normalise line endings
  const normalise = (s: string) => s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const normalisedBefore = normalise(before);
  const normalisedAfter = normalise(after);

  const linesA = normalisedBefore.split('\n');
  const linesB = normalisedAfter.split('\n');

  // Identical payloads need no diff at all — skip the quadratic table.
  if (normalisedBefore === normalisedAfter) {
    return linesA.map((value, index) => ({
      type: 'unchanged' as const,
      value,
      lineA: index + 1,
      lineB: index + 1,
    }));
  }

  const raw: Omit<DiffLine, 'lineA' | 'lineB'>[] = [];

  const dp = buildLcsTable(linesA, linesB);
  walkLcs(dp, linesA, linesB, linesA.length, linesB.length, raw);

  // Assign 1-based line numbers
  let lineA = 0;
  let lineB = 0;
  return raw.map((entry) => {
    if (entry.type === 'unchanged') {
      lineA++;
      lineB++;
      return { ...entry, lineA, lineB };
    }
    if (entry.type === 'removed') {
      lineA++;
      return { ...entry, lineA, lineB: null };
    }
    // added
    lineB++;
    return { ...entry, lineA: null, lineB };
  });
}

/**
 * Convenience wrapper that serialises two arbitrary values to pretty-printed
 * JSON and calls computeDiff.
 *
 * Serialisation failures (e.g. circular references) surface the raw
 * JSON.stringify error message as a single-line diff so the component always
 * receives a usable result.
 *
 * @param a  First value  ("before")
 * @param b  Second value ("after")
 */
export function diffJson(a: unknown, b: unknown): DiffLine[] {
  let textA: string;
  let textB: string;

  try {
    textA = JSON.stringify(a, null, 2) ?? 'null';
  } catch (err) {
    textA = `[Serialisation error: ${String(err)}]`;
  }

  try {
    textB = JSON.stringify(b, null, 2) ?? 'null';
  } catch (err) {
    textB = `[Serialisation error: ${String(err)}]`;
  }

  return computeDiff(textA, textB);
}

/**
 * Returns true when the diff contains at least one added or removed line —
 * i.e., the two inputs are not identical.
 */
export function hasDifferences(lines: DiffLine[]): boolean {
  return lines.some((l) => l.type !== 'unchanged');
}
