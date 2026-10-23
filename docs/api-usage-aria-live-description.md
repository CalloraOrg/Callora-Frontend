# Add aria-live status updates on ApiUsage

## Summary

This change adds a single screen-reader status region to `ApiUsage` so important UI state changes are announced consistently without adding visible noise to the page.

## Files changed

| File | Change |
|---|---|
| `src/ApiUsage.tsx` | Replaced the filter-only live message with a centralized `aria-live` status announcer for filter changes, filter reset, endpoint selection, API-key copy, code-copy, snapshot copy, and API-key regeneration |
| `src/ApiUsage.test.tsx` | Added focused tests covering screen-reader announcements for filter reset, filter changes, and copy actions |

## API/Visible Changes

- No backend or network API changes
- No visual layout changes
- Screen readers now announce these `ApiUsage` interactions:
  - status filter changes
  - filter reset
  - endpoint selection
  - API key copied
  - API key regenerated
  - code example copied
  - snapshot URL copied

## Accessibility

- Uses a single `role="status"` region with `aria-live="polite"` and `aria-atomic="true"`
- Keeps announcements centralized so state changes are easier to maintain and review
- Preserves existing visible button feedback such as `Copied!`
