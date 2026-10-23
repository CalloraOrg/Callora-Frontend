# Response Diff Highlighting

> Added in the GrantFox campaign — enables side-by-side response comparison
> inside the call history table.

---

## Overview

When displaying call history in `CallHistoryRow`, you can now pass an optional
`compareWith` prop pointing to a second `CallRecord`. The expanded "Response"
section automatically switches from a plain JSON dump to a line-by-line diff
view that highlights what changed between the two API calls.

The feature is entirely self-contained:

| File | Role |
|---|---|
| `src/utils/diff.ts` | Pure diff engine — no runtime dependencies |
| `src/components/CallHistoryRow.tsx` | UI: renders the diff table and mode toggle |
| `src/index.css` | Design tokens + CSS classes for the diff view |

---

## API

### `CallHistoryRow` props

| Prop | Type | Required | Description |
|---|---|---|---|
| `call` | `CallRecord` | ✅ | The primary call ("before"). |
| `expanded` | `boolean` | ✅ | Whether the details panel is open. |
| `onToggleExpand` | `(id: string) => void` | ✅ | Toggle callback. |
| `compareWith` | `CallRecord` | ❌ | When present, enables diff view of `response`. |

When `compareWith` is not provided the component behaves exactly as before —
no visible change.

### `diff.ts` public API

```ts
import { computeDiff, diffJson, hasDifferences } from '../utils/diff';
import type { DiffLine, DiffLineType } from '../utils/diff';
```

#### `computeDiff(before: string, after: string): DiffLine[]`

Line-level diff between two plain-text strings.  Line endings (`\r\n`, `\r`,
`\n`) are normalised before splitting.

```ts
const lines = computeDiff('{"a":1}', '{"a":2}');
// [
//   { type: 'removed', value: '{"a":1}', lineA: 1, lineB: null },
//   { type: 'added',   value: '{"a":2}', lineA: null, lineB: 1 },
// ]
```

#### `diffJson(a: unknown, b: unknown): DiffLine[]`

Convenience wrapper: serialises both values with `JSON.stringify(…, null, 2)`
then calls `computeDiff`.  Serialisation errors are surfaced as a single diff
line rather than thrown.

#### `hasDifferences(lines: DiffLine[]): boolean`

Returns `true` when the diff contains at least one `added` or `removed` line.

#### `DiffLine` shape

```ts
interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  value: string;    // Line text (no trailing newline)
  lineA: number | null;  // 1-based line number in "before"; null for added lines
  lineB: number | null;  // 1-based line number in "after";  null for removed lines
}
```

---

## Usage example

```tsx
<CallHistoryRow
  call={previousCall}
  compareWith={latestCall}
  expanded={expandedId === previousCall.id}
  onToggleExpand={setExpandedId}
/>
```

The current `call` is treated as "before" (A); `compareWith` is "after" (B).

---

## UI behaviour

1. **Diff mode** (default when `compareWith` is present) — renders a scrollable
   table with line numbers, a sign gutter (`+`/`−`/` `), and highlighted rows.
2. **Raw mode** — falls back to the plain `<pre>` JSON dump of `call.response`.
3. **No differences** — when both responses are identical a status message is
   shown instead of an empty table.
4. **Toggle** — a "Diff / Raw" button group in the Response section header lets
   the user switch between modes.

---

## Accessibility

All diff line rows carry an `aria-label` of `"Added: <content>"`,
`"Removed: <content>"`, or `"Unchanged: <content>"` so screen-reader users
receive the same status information as sighted users.

Color is never the only indicator of a change (WCAG 1.4.1):
- A sign column shows `+`, `−`, or a space.
- The `data-diff-type` attribute is available for custom CSS targeting.
- Column headers are present in the DOM (`.sr-only`).

---

## Design tokens

All colors are CSS custom properties so they adapt to both light and dark
themes automatically.  Override them in your own theme if needed:

```css
/* Example: disable background tinting for removed lines */
[data-theme="dark"] {
  --diff-removed-bg: transparent;
}
```

| Token | Purpose |
|---|---|
| `--diff-added-bg` | Row background for added lines |
| `--diff-added-fg` | Text color for added lines |
| `--diff-added-gutter-bg` | Line-number gutter background for added lines |
| `--diff-added-sign-fg` | `+` sign color |
| `--diff-removed-bg` | Row background for removed lines |
| `--diff-removed-fg` | Text color for removed lines |
| `--diff-removed-gutter-bg` | Line-number gutter background for removed lines |
| `--diff-removed-sign-fg` | `−` sign color |
| `--diff-unchanged-bg` | Row background for context lines (typically transparent) |
| `--diff-unchanged-fg` | Text color for context lines |
| `--diff-unchanged-gutter-bg` | Line-number gutter background for context lines |
| `--diff-unchanged-sign-fg` | Space placeholder color |

---

## Responsive behaviour

- Below `600 px` the "before" line-number column is hidden to save horizontal
  space.
- The diff table uses `white-space: pre-wrap` and `word-break: break-all` so
  long lines wrap instead of causing horizontal overflow.

---

## Testing

```bash
# Run only the diff-related tests
npm test -- --run src/utils/diff.test.ts src/components/CallHistoryRow.test.tsx
```

| Test file | Coverage |
|---|---|
| `src/utils/diff.test.ts` | `computeDiff`, `diffJson`, `hasDifferences` — 31 tests |
| `src/components/CallHistoryRow.test.tsx` | Component rendering, toggle, a11y, edge cases — 35 tests |
