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
- `/sw.js` is served with `Cache-Control: no-cache` and `Service-Worker-Allowed: /` so browsers always revalidate the service worker script on navigation.

## Service Worker & Caching

Production builds register `public/sw.js` (via `src/utils/registerServiceWorker.ts` in `src/main.tsx` when `import.meta.env.PROD` is true, after `window` `load`). It is never registered in development (`npm run dev`) or Vitest.

### Strategy

- **App shell & static assets (`callora-shell-v1`)**: `/` and `/index.html` are precached on install. Same-origin `/assets/*` and navigation requests use **stale-while-revalidate** (SWR) with offline fallback to cached `/index.html`.
- **Catalogue API (`callora-catalog-v1`)**: Same-origin `GET /api/apis` and `GET /api/apis/*` requests without an `Authorization` header use **stale-while-revalidate** so the last catalogue response loads offline while refreshing in the background.
- **Network-only**: All other `/api/*` endpoints, all non-`GET` requests, cross-origin requests, and any request carrying an `Authorization` header bypass the service worker cache completely so authenticated or account-scoped data is never cached across accounts.
- **Account switching / removal**: `invalidateAccountCache` in `src/utils/offlineApiCache.ts` posts `{ type: "CLEAR_API_CACHE" }` to the active service worker, dropping `callora-catalog-v1` alongside `localStorage`.

### Versioning & Busting Caches

- Cache names are versioned at the top of `public/sw.js` (`SHELL_CACHE = "callora-shell-v1"`, `CATALOG_CACHE = "callora-catalog-v1"`).
- To force a full cache bust on deploy, bump the version suffix (e.g. `v1` -> `v2`). On `activate`, the service worker automatically deletes any caches whose names are not in `CURRENT_CACHES` and claims active clients.
- Because `/sw.js` is served with `Cache-Control: no-cache`, browsers detect the updated script on the next navigation and install the new version automatically.

Deploy with the CLI:

```bash
vercel link --yes --project callora-frontend
vercel --prod --yes          # add --archive=tgz if you hit the upload rate limit
```

Set `VITE_*` variables (see `.env.example`) with `vercel env add`. They are inlined at build time and are public: never put secrets in them.

## Demo mode

Without a reachable backend the marketplace falls back to `src/data/mockApis.ts` and other pages use built-in sample data. Set `VITE_API_BASE_URL` to a real Callora API to use live data.

## CI

`.github/workflows/ci.yml` runs on every push to `main` and on pull requests: `tsc --noEmit`, `npm run build`, `vitest run`.
