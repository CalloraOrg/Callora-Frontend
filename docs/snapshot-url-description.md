# Add 'Snapshot endpoint' export to share UI state

## Summary

This PR implements a shareable URL feature that captures the current endpoint selection and parameters. Users can generate a URL snapshot of their configured endpoint with parameters and share it with others, who will see the same endpoint and parameters pre-loaded.

## Changes

### `src/utils/snapshotUrl.ts` (new)
- `generateSnapshotUrl(basePath, snapshot)` - Creates a URL with endpoint ID and base64-encoded params
- `parseSnapshotUrl(search)` - Parses URL to extract endpoint and params, returns null if invalid
- `copySnapshotUrl(basePath, snapshot)` - Copies snapshot URL to clipboard for sharing

### `src/ApiUsage.tsx`
- Added `snapshotted` state to track copy feedback
- Added `handleShareSnapshot()` function to generate and copy snapshot URL
- Added `useEffect` to restore endpoint params from snapshot URL on mount
- Added "Share Snapshot" button next to "Make Test Call" button
- Imported `LinkIcon` for the share button

### `src/components/icons/LinkIcon.tsx` (new)
- New link/chain icon component for sharing functionality
- Follows existing icon patterns (size variants, accessibility)

### `src/components/icons/index.tsx`
- Added export for `LinkIcon`

### `src/index.css`
- Added `.share-snapshot-button` styles with proper spacing

### `src/utils/snapshotUrl.test.ts` (new)
- 11 tests covering URL generation, parsing, and clipboard copying
- Tests edge cases like special characters, malformed params, empty values

## API/Visible Changes

### URL Parameters
- `endpoint` - The selected endpoint ID (e.g., "endpoint-1", "endpoint-2")
- `params` - Base64-encoded JSON of request parameters

### Example URL
```
/usage?endpoint=endpoint-2&params=eyJhYm91dCI6MTAwLCJjdXJrenVjdXIiOiJVU0QifQ%3D%3D
```

## Accessibility (WCAG 2.1 AA)
- Share button has `aria-label` for screen readers
- Icon is marked `aria-hidden` when button has accessible label
- Focus styles follow existing design tokens

## Test Output

```
✓ src/utils/snapshotUrl.test.ts (11 tests) 36ms
```

All tests pass including:
- URL generation with/without params
- Base64 encoding/decoding with Unicode support
- Graceful handling of malformed URLs
- Clipboard copy success/failure

closes #252

## PR Link
https://github.com/CalloraOrg/Callora-Frontend/pull/339