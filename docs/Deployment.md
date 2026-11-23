# Deployment

Production is a static build served by [Vercel](https://vercel.com). Live demo: https://callora-frontend-six.vercel.app

## Build

```bash
npm ci
npm run build   # tsc type-check + vite build -> dist/
```

## Vercel

`vercel.json` configures the project:

- Framework `vite`, output `dist`.
- A single rewrite sends every path except `/api/*` and `/assets/*` to `index.html`, so client-side routes survive a refresh. `/api/*` is deliberately excluded so a missing backend returns a real 404 (the app then switches to mock data) rather than HTML.
- Hashed files under `/assets/` get immutable caching.

Deploy with the CLI:

```bash
vercel link --yes --project callora-frontend
vercel --prod --yes          # add --archive=tgz if you hit the upload rate limit
```

Set `VITE_*` variables (see `.env.example`) with `vercel env add`. They are inlined at build time and are public: never put secrets in them.

## Demo mode

When `VITE_API_BASE_URL` is empty the app runs in static demo mode: the
marketplace catalogue is served from [`src/data/mockApis.ts`](../src/data/mockApis.ts)
and labelled **Sample data**, and the billing invoice card shows the labelled
`DEMO_INVOICE` fixture. Pages backed by authenticated endpoints (My APIs, API
usage, dashboard activity, invoices) do not all fall back the same way — see the
matrix below. Set `VITE_API_BASE_URL` to a real Callora API to use live data.

## Fixture and fallback behaviour

What each page reads from when a backend is configured, when
`VITE_API_BASE_URL` is empty (demo), and when the configured backend cannot be
reached. "Cached" means the account-scoped `sessionStorage` copy written by
[`src/utils/offlineApiCache.ts`](../src/utils/offlineApiCache.ts) or
[`src/hooks/useApiCache.ts`](../src/hooks/useApiCache.ts).

| Page | Source file(s) | Backend reachable | Backend unreachable | User-visible indicator |
| --- | --- | --- | --- | --- |
| Marketplace | [`src/pages/MarketplacePage.tsx`](../src/pages/MarketplacePage.tsx), [`src/api/catalogApi.ts`](../src/api/catalogApi.ts), [`src/data/mockApis.ts`](../src/data/mockApis.ts) | **Configured:** `GET /api/apis` through `fetchCatalog`, with server-side search/category and `If-None-Match` revalidation.<br>**Demo (empty `VITE_API_BASE_URL`):** no request is made; `fetchCatalog` returns `MOCK_APIS`. | Uses the cached catalogue and flags it as stale; with no usable cache it clears the list and shows the error empty state with retry. | **Sample data** badge beside the title in demo mode; "Showing saved results" stale notice on a cache fallback; error empty state with retry otherwise. |
| My APIs | [`src/pages/MyApis.tsx`](../src/pages/MyApis.tsx), [`src/api/catalogApi.ts`](../src/api/catalogApi.ts), [`src/data/mockApis.ts`](../src/data/mockApis.ts) | **Configured:** calls `fetchCatalog` (the same `/api/apis` request as the marketplace), then filters the result to the provider slug `acme-labs` and assigns representative `publishStatus` values by row index. There is no `/api/provider/apis` request yet.<br>**Demo:** same `fetchCatalog` path, so the rows are built from `MOCK_APIS`. | Rejects into the "Failed to load your APIs" error state with retry. No fixture fallback and no cached copy. | Error empty state only. In demo mode there is **no** sample-data badge (see PR notes). |
| API usage | [`src/pages/ApiUsage.tsx`](../src/pages/ApiUsage.tsx), [`src/services/testCall.ts`](../src/services/testCall.ts), [`src/services/authFetch.ts`](../src/services/authFetch.ts) | **Configured:** `authFetch('/api/usage?groupBy=day&limit=100')`; test calls hit the selected endpoint path for real. Only signed-in accounts issue the request.<br>**Demo:** no fixture — the relative request fails against the static host and the stats stay zeroed with the error alert below. | Keeps the last cached usage response visible and shows an error alert; a test call returns the safe network-error payload. No fixture fallback. | Error `<p role="alert">` only; cached rows are not labelled as stale. Signed-out / no-account state shows zeroed stats and an empty history without an error. |
| Dashboard activity | [`src/hooks/useRecentActivity.ts`](../src/hooks/useRecentActivity.ts), [`src/pages/DashboardOverview.tsx`](../src/pages/DashboardOverview.tsx), [`src/hooks/useApisByIds.ts`](../src/hooks/useApisByIds.ts) | **Configured:** `GET /api/activity?accountId=…&limit=10` for the feed; pinned API previews resolve through `resolveApisByIds` (`/api/apis/:id`).<br>**Demo:** the activity feed has no fixture, so it settles into the error state; pinned APIs resolve from `MOCK_APIS`. | Feed shows the error alert with a Retry action and no items. No fixture fallback or cached copy. Pinned previews show their own error/partial state. | Error alert with retry. Pinned demo data has no sample-data label. The legacy unrouted [`src/components/Dashboard.tsx`](../src/components/Dashboard.tsx) still shows hard-coded activity after `LOADING_DELAY_MS`. |
| Billing invoices | [`src/api/invoicesApi.ts`](../src/api/invoicesApi.ts), [`src/pages/InvoiceCard.tsx`](../src/pages/InvoiceCard.tsx), [`src/data/billingFixtures.ts`](../src/data/billingFixtures.ts) | **Configured:** `GET /api/invoices?limit=20` with the active account's bearer token; the newest `pending` invoice is rendered.<br>**Demo:** no request; `DEMO_INVOICE` is rendered instead. | Error state with retry; a 401 shows the sign-in prompt instead. No fixture fallback. | Error state / sign-in prompt with retry. In demo mode the invoice card shows its **Demo** badge. `billingFixtures.ts` is test-only and is not imported by the production page. |
| Latency chart | [`src/pages/LatencyChart.tsx`](../src/pages/LatencyChart.tsx), [`src/api/latencyApi.ts`](../src/api/latencyApi.ts) | **Configured:** `authFetch('/api/apis/:apiId/latency?range=24h')` for the `?api=<id>` query param; shows an empty state when no API is selected.<br>**Demo:** no request; `getDemoLatencyData()` is rendered instead. | Error empty state with retry. No fixture fallback. | **Sample data** badge beside the title in demo mode; stale opacity + live-region notice while refetching; error empty state with retry on failure. |

The legacy [`src/ApiUsage.tsx`](../src/ApiUsage.tsx) is not routed (the router
loads `src/pages/ApiUsage.tsx`); it keeps its own `MOCK_ENDPOINTS` and
`MOCK_CALL_HISTORY`, so editing it has no effect on the live page.

## CI

`.github/workflows/ci.yml` runs on every push to `main` and on pull requests: `tsc --noEmit`, `npm run build`, `vitest run`.
