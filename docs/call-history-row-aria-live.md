# CallHistoryRow — aria-live Status Announcements

## Summary

Adds a polite `aria-live` region to `CallHistoryRow` so screen readers announce
status changes without interrupting the user's current focus.

## Files Changed

| File | Change |
|---|---|
| `src/pages/CallHistoryRow.tsx` | Added `announcement` state + `useEffect` to detect status changes; renders a visually-hidden `role="status"` live region |
| `src/pages/CallHistoryRow.test.tsx` | Focused Vitest test verifying the live region starts empty, populates on status change, and carries the correct ARIA attributes |

## API / Visible Changes

- **No visual changes** — the live region is hidden via `.sr-only`
- **No backend or network changes**
- Screen readers now announce when a call row's status changes, e.g.:
  > "Call status updated to error."

## Implementation Details

```tsx
// Tracks previous status to detect changes
const previousStatusRef = useRef(call.status);

useEffect(() => {
  if (previousStatusRef.current !== call.status) {
    setAnnouncement(`Call status updated to ${call.status}.`);
    previousStatusRef.current = call.status;
  }
}, [call.status]);

// Visually hidden live region — speaks on status change
<span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
  {announcement}
</span>
```

## Accessibility

- `aria-live="polite"` — waits for the user to finish their current interaction before announcing
- `aria-atomic="true"` — reads the full message, not just the changed portion
- `role="status"` — semantic landmark for assistive technologies
- `.sr-only` — WCAG 2.1 AA visually-hidden utility already defined in `src/index.css`

## Testing

```bash
npm test -- src/pages/CallHistoryRow.test.tsx
```

The test:
1. Renders the row with `status: 'success'` — live region is empty
2. Rerenders with `status: 'error'` — live region contains the announcement string
3. Asserts `aria-live="polite"` and `aria-atomic="true"` are present
