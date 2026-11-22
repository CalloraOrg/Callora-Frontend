# Route splitting, lazy chunks, and prefetching

This document describes how code-splitting works in the Callora frontend, the
contract every page route must satisfy, and the exact steps to add a new lazy
route. It exists because a page added with only a `lazy()` import still works,
but silently misses prefetching — which is the whole point of the strategy.

## Where the strategy lives

| Concern | File |
| --- | --- |
| Lazy page imports, prefetch map, `Suspense` & `RouteErrorBoundary` | `src/App.tsx` |
| Manual entry router (skeletons, `startRouteLoading`, `StandaloneErrorBoundary`) | `src/renderRoute.tsx`, `src/main.tsx` |
| Route error boundary fallback & retry/reset logic | `src/components/RouteErrorBoundary.tsx` |
| Loading state + `RouteProgressBar` | `src/hooks/useRouteLoading.ts`, `src/components/RouteProgressBar.tsx` |
| Regression coverage | `src/RouteSplitting.test.tsx`, `src/App.errorBoundary.test.tsx`, `src/renderRoute.test.tsx` |

Two routers exist on purpose:

- `src/App.tsx` is the React Router app. `main.tsx` renders it for the default
  case and for any path outside the four it handles itself.
- `src/main.tsx` owns a small manual router for `/publish`, `/marketplace`,
  `/details/*`, and `/latency-chart`. Those paths render a skeleton, `await
  import(...)`, render the real page, and bracket the swap with
  `startRouteLoading()` / `stopRouteLoading()`.

If a route is served by the manual router, adding it to the `App.tsx` prefetch
map alone is not enough — `main.tsx` must know about the path too.

## How lazy loading is wired

Every heavy page is a named `lazy()` binding at the top of `App.tsx`:

```tsx
const MarketplacePage = lazy(() => import("./pages/MarketplacePage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
// ...one binding per page
```

All of them are rendered from a single `Suspense` boundary wrapped in a
`RouteErrorBoundary`:

```tsx
<RouteErrorBoundary
  resetKey={location.pathname}
  onGoHome={() => navigate(APP_ROUTES.dashboard)}
>
  <Suspense fallback={<div className="route-loading-fallback" aria-busy="true" aria-label="Loading page" style={{ minHeight: "300px" }} />}>
    <Routes>{/* ... */}</Routes>
  </Suspense>
</RouteErrorBoundary>
```

Because the boundary is shared, the chunk for a route is only requested when
that route first renders. Hovering or focusing a nav link is what removes that
first-render delay.

## Error boundary placement

`RouteErrorBoundary` (`src/components/RouteErrorBoundary.tsx`) isolates render
and lazy-chunk load errors so a broken page never white-screens the whole app:

- **In `src/App.tsx`**: `RouteErrorBoundary` wraps the `<Suspense>` / `<Routes>`
  block inside `<main>`. The `<header>` topbar, primary navigation, and footer
  remain outside the boundary so the user can always navigate away from a
  crashed page. Passing `resetKey={location.pathname}` clears the error state
  automatically when the user navigates to another route, and `onGoHome`
  navigates back to `APP_ROUTES.dashboard`.
- **In `src/renderRoute.tsx`**: A small `StandaloneErrorBoundary` inner
  component reads `useLocation().pathname` as `resetKey` and uses
  `window.location.assign("/dashboard")` for `onGoHome`. Inside `wrap()`, it
  wraps the page content inside `StandaloneShell` (for `/publish`,
  `/marketplace`, and `/details/:id`) or directly around `<LatencyChart />`, so
  the standalone shell header and navigation stay usable on error.
- **Lazy-chunk load failures**: Because `RouteErrorBoundary` sits outside
  `<Suspense>`, rejected dynamic `import()` calls during route resolution are
  caught by the boundary and present a **Reload** action alongside **Try again**
  and **Go home** (after `maxRetries`, **Try again** is removed and the
  exhausted message is shown).
- `StickyTocErrorBoundary` (`src/components/StickyTocErrorBoundary.tsx`) is a
  separate, component-level boundary and is unaffected by route-level placement.

## The prefetch map contract

`prefetchRoute` is fed by `routePrefetchers`, a plain map from **exact path to
dynamic import**:

```tsx
const routePrefetchers: Record<string, () => Promise<any>> = {
  "/marketplace": () => import("./pages/MarketplacePage"),
  "/dashboard": () => import("./pages/DashboardPage"),
  // ...
};

export function prefetchRoute(path: string) {
  const prefetcher = routePrefetchers[path];
  if (prefetcher) {
    prefetcher().catch(() => {
      // Ignore prefetch failures gracefully
    });
  }
}
```

Rules that follow from the implementation:

1. **Keys are exact paths, not route patterns.** `prefetchRoute("/dashboard")`
   hits; `prefetchRoute("/dashboard/")` and `prefetchRoute("/dashboard?tab=1")`
   do not. Keep keys identical to the `APP_ROUTES` string they mirror.
2. **Unknown paths are a silent no-op.** This is deliberate: callers may pass
   routes that are not prefetchable (for example `/non-existent-route` in
   `RouteSplitting.test.tsx`) without needing a guard.
3. **Failures are swallowed.** A rejected chunk request must never surface as an
   unhandled rejection; the real navigation still loads the chunk normally.
4. **The map and the `lazy()` bindings are separate.** Adding a `lazy()` import
   does not register a prefetcher. Both must be updated.
5. **Not every lazy page is prefetchable.** `InvoiceCard` is lazily imported but
   has no nav link of its own, so it is intentionally absent from the map.

The map is consumed by six nav links, all of which prefetch on both pointer and
keyboard intent:

```tsx
<NavLink
  to={APP_ROUTES.dashboard}
  onMouseEnter={() => prefetchRoute(APP_ROUTES.dashboard)}
  onFocus={() => prefetchRoute(APP_ROUTES.dashboard)}
>
  Dashboard
</NavLink>
```

Both handlers are required: `onMouseEnter` covers pointer users and `onFocus`
covers keyboard users, so the optimisation does not create a keyboard-only
penalty.

## Suspense fallback conventions

- There is exactly **one** `Suspense` boundary around the router, not one per
  route. Adding a second boundary changes the perceived transition and should be
  avoided.
- The fallback is intentionally non-visual: a `route-loading-fallback` element
  with `aria-busy="true"`, `aria-label="Loading page"`, and a 300 px minimum
  height so the footer does not jump.
- Do not put user-facing copy in the fallback. Route transitions are announced
  through the progress bar instead, so screen readers do not read placeholder
  text twice.
- Rendering the fallback always flips `aria-busy`; `RouteProgressBar` is the
  visible indicator.

## Relationship with `RouteProgressBar` and `useRouteLoading`

`src/hooks/useRouteLoading.ts` owns a counter and two custom events
(`rl-start` / `rl-end`):

- `startRouteLoading()` / `stopRouteLoading()` dispatch the events.
- `useRouteLoading()` subscribes and returns `true` while at least one load is
  in flight (the counter handles overlapping loads).
- `RouteProgressBar` renders a `role="progressbar"` bar while loading, honours
  `prefers-reduced-motion` (0 ms vs. 240 ms exit delay), and is hidden from
  print via `no-print`.

The manual router in `main.tsx` is the only caller of
`startRouteLoading`/`stopRouteLoading`. React Router routes do **not** emit these
events: their transition is `Suspense`-driven, which is why the progress bar is
rendered in `App.tsx` as well and stays idle for pure client-side navigation.

## Adding a lazy route

1. **Create the page** under `src/pages/`.
2. **Add a `lazy()` binding** at the top of `src/App.tsx`, next to the others:
   `const MyPage = lazy(() => import("./pages/MyPage"));`.
3. **Add the path to `APP_ROUTES`** so the string has a single source of truth.
4. **Add a prefetcher entry** whose key is that exact `APP_ROUTES` value:
   `[APP_ROUTES.myPage]: () => import("./pages/MyPage"),`.
5. **Render it inside the existing `Suspense` boundary** with a
   `<Route path={APP_ROUTES.myPage} element={<MyPage />} />`. Do not add a new
   boundary.
6. **Add a `NavLink` with `onMouseEnter` and `onFocus`** if the page is
   reachable from the primary navigation, so it is prefetched like its
   neighbours.
7. **If the path needs a skeleton or is served by the manual router**, add the
   branch to `src/main.tsx` and bracket the `await import(...)` with
   `startRouteLoading()` / `stopRouteLoading()`.
8. **Run the regression suite:**

   ```bash
   npm test -- --run src/RouteSplitting.test.tsx
   ```

## What the regression suite guarantees

`src/RouteSplitting.test.tsx` renders the real `App` inside its providers and
asserts the strategy keeps working:

- the landing route renders without a loading fallback delay;
- `Plan Badge`, `Webhook Deliveries`, `Rate Limit Card`, and `Theme Playground`
  resolve inside the `Suspense` boundary;
- hovering and focusing nav links triggers prefetching without throwing;
- `prefetchRoute` is a no-op for an unknown path;
- rapid route transitions settle on the final route with no error state.

Add a case there when you add a new prefetched route — it is the guard against a
page that loads but never prefetches.
