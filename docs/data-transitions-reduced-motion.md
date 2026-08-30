# Reduced-Motion Data Transitions (Issue #1005)

## Issue
#1005 [Quality-2][High] — Respect reduced-motion settings in data transitions.

## Description
Data-driven transitions (loading skeletons, route-progress bars, stale-data
fades, and the dashboard activity fetch) now respect the OS-level
`prefers-reduced-motion` setting and announce their state changes to screen
readers. A shared reactive hook replaces the several hand-rolled
`window.matchMedia("(prefers-reduced-motion: reduce)")` copies so behaviour is
consistent app-wide.

## Changes Made

### Shared hook (`src/hooks/usePrefersReducedMotion.ts`)
- `usePrefersReducedMotion()` returns the live value of
  `(prefers-reduced-motion: reduce)` via `useSyncExternalStore`, so components
  re-render when the user flips the OS setting at runtime.
- SSR / absent-`matchMedia` environments fall back to `false`.
- Exports `REDUCED_MOTION_QUERY` so tests and CSS stay in sync.

Refactored consumers (behaviour kept identical, source-of-truth removed):
- `src/components/ApiCard.tsx`
- `src/components/FiltersSidebar.tsx`
- `src/components/BottomSheet.tsx`
- `src/components/ApiDetailStickyTOC.tsx`
- `src/pages/ApiUsage.tsx`
- `src/pages/ApiDetailPage.tsx`
- `src/pages/MarketplacePage.tsx`

### Global CSS (`src/index.css`)
- New `@media (prefers-reduced-motion: reduce)` block freezes `.skeleton`,
  `.skeleton--stellar`, `.api-card-skeleton` (and light-theme variants) to a
  static `--surface-soft` surface, and stops `.button-spinner` rotation.
- `.route-progress-bar` opacity fade is disabled under reduced motion.
- New `.webhook-deliveries-error` / `.webhook-deliveries-data` /
  `.webhook-deliveries-data--stale` / `.webhook-deliveries-stale-note` classes
  replace the page's hardcoded `red`/`orange` inline colors with the semantic
  `--danger` / `--warning` design tokens (theme-aware contrast). The stale
  opacity transition is `none` under reduced motion.

### Dashboard (`src/components/Dashboard.tsx`)
- When reduced motion is active the simulated activity fetch skips
  `LOADING_DELAY_MS` (delay `0`) so the skeleton never flashes.
- The activity region is marked `aria-busy` while loading.
- A polite `LiveRegion` announces `Loading recent activity.` →
  `Recent activity loaded.` (or `No recent activity yet.`) via the pure,
  unit-tested helper `describeActivityAnnouncement`.

### Webhook Deliveries (`src/pages/WebhookDeliveries.tsx`)
- Loading is announced with `role="status"`.
- Errors are announced with `role="alert"`.
- Stale/refreshing data keeps the old rows visible but sets `aria-busy` and
  dims them via a token-based class instead of an inline animated style.

### Route Progress Bar (`src/components/RouteProgressBar.tsx`)
- The 240 ms delayed exit collapses to `0` ms under reduced motion.

## API / Visible Changes

### User-Visible Changes
Users with `prefers-reduced-motion: reduce` see static skeletons, a static
progress bar, instant stale-data updates, and no delayed activity skeleton.
Screen-reader users hear loading/success/error/empty transitions for the
dashboard activity and webhook delivery table.

Users without the preference see no change.

### API Changes
- None. No props or interfaces changed.

## Accessibility Impact
- Dynamic status/errors/success/loading changes are semantically announced
  (`role="status"`, `role="alert"`, `aria-live="polite"`).
- Color meaning (error, warning) is carried by theme-aware tokens plus text,
  preserving contrast in both themes.
- Motion is gated behind `prefers-reduced-motion`, per WCAG 2.3.3.
- `aria-busy` conveys in-progress data transitions without stealing focus.

## Testing
Run with:
```bash
npm test -- src/hooks/__tests__/usePrefersReducedMotion.test.tsx \
  src/components/Dashboard.test.tsx src/components/RouteProgressBar.test.tsx \
  src/pages/WebhookDeliveries.test.tsx
```

Note: on Windows, run vitest with `--pool=forks --poolOptions.forks.singleFork`
if multiple files hang with the default thread pool; keep single-file runs for
precise isolation.

## Related
- Follows the existing patterns in `docs/api-usage-reduced-motion-fallback.md`
  (Issue #721) and `docs/api-tag-filter-reduced-motion.md` (Issue #701).