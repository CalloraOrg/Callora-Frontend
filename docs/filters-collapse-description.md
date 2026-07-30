# Polish FiltersSidebar with Collapse Persistence

## Summary

This PR implements collapsible filter sections in `FiltersSidebar` with localStorage persistence to remember collapsed states across page visits. Users can now collapse/expand each filter group (Categories, Price range, Popularity) independently, and their preferences are saved for future sessions.

## Changes

### `src/components/FiltersSidebar.tsx`
- Refactored filter sections into a reusable `FilterGroup` component with collapsible behavior
- Each filter group now has an expandable/collapsible header with a chevron indicator
- Uses `usePersistedState` hook to persist collapsed state in localStorage
- Implements proper ARIA attributes (`aria-expanded`, `aria-controls`) for accessibility
- Uses `hidden` attribute to hide collapsed content from screen readers

### `src/components/icons/ChevronIcon.tsx` (new)
- New icon component for the expand/collapse chevron indicator
- Follows the existing icon pattern in the codebase (size variants, accessibility)

### `src/components/icons/index.tsx`
- Added export for the new `ChevronIcon` component

### `src/index.css`
- Added styles for `.filter-group__header`, `.filter-group__chevron`, and `.filter-group__panel`
- Includes hover and focus-visible states matching design-token patterns
- Reduced motion support via `prefers-reduced-motion` media query
- Responsive adjustments for smaller viewports (max-width: 640px)

### `src/state/uiPrefs.ts`
- Added `isSectionCollapsed()`, `toggleSectionCollapsed()`, and `setSectionCollapsed()` functions for collapsed section state management

### Test Files
- `src/components/FiltersSidebar.test.tsx` - New comprehensive tests for collapse functionality
- `src/state/uiPrefs.test.ts` - Tests for the uiPrefs collapse state functions

## Accessibility (WCAG 2.1 AA)

- `aria-expanded` indicates the current state of each filter group
- `aria-controls` associates headers with their content panels
- `hidden` attribute removes collapsed content from assistive technology
- Focus styles use `var(--accent)` with proper contrast against both light and dark backgrounds
- `prefers-reduced-motion` support for users who request reduced motion

## Responsive Design

The filter headers adapt to smaller screens:
- Reduced padding (10px 14px) on screens under 640px
- Smaller font size (0.9rem) on mobile viewports
- All breakpoints maintain proper touch target sizes (minimum 44px height)

## API/Visible Changes

### Component API (no breaking changes)
`FiltersSidebar` maintains the same external props interface - this is a purely visual enhancement.

### localStorage Keys
- `callora.filters.categories.collapsed` - Categories section state (boolean)
- `callora.filters.price.collapsed` - Price range section state (boolean)
- `callora.filters.popularity.collapsed` - Popularity section state (boolean)

## Test Output

```
✓ src/components/FiltersSidebar.test.tsx (16 tests) 966ms
✓ src/state/uiPrefs.test.ts (9 tests) 11ms
```

All tests pass including:
- Default expanded state verification
- localStorage persistence on toggle
- State restoration on re-render
- aria-expanded and aria-controls attribute correctness
- Independent collapse/expand of each section
- Chevron rotation animation
- Price validation error handling

## Notes

The existing tests in the repository have pre-existing issues unrelated to this change:
- `FiltersBottomSheet.test.tsx` - missing `window.matchMedia` mock in jsdom
- `Tabs.test.tsx` - same matchMedia issue
- `ApiDetailPage.tsx`, `ApiUsage.tsx`, `ApiCard.tsx` - JSX syntax errors in existing code

These do not affect the functionality of the changes in this PR.

PR: https://github.com/CalloraOrg/Callora-Frontend/pull/337

closes #254

## Regression fix (2026-07-24)

A merge conflict in a later PR dropped part of this feature from `FiltersSidebar.tsx`: the
`ChevronIcon`/`usePersistedState` imports and the entire "Price range" section were lost, and the
"Popularity" section was left outside of `FilterGroup` (so it no longer collapsed or persisted its
state). The matching `.filter-group__header`, `.filter-group__chevron`, and `.filter-group__panel`
styles were also dropped from `src/index.css`.

This fix restores:
- The "Price range" section wrapped in `FilterGroup` (`storageKey="price"`), including the
  min/max validation error.
- The "Popularity" section wrapped in `FilterGroup` (`storageKey="popularity"`) so it collapses
  and persists like Categories and Price range.
- The missing imports and collapsible-section CSS.

The "Favorites" section intentionally remains a plain, non-collapsible `fieldset` — it was never
part of the original collapsible set.

closes #369