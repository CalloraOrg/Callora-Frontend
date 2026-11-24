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

## Security headers

`vercel.json` defines a global `"source": "/(.*)"` headers rule that Vercel merges with the `/assets/(.*)` immutable cache rule. Every response includes:

| Header | Value | Purpose |
| --- | --- | --- |
| `Content-Security-Policy` | See directive table below | Restricts script, style, image, frame, and network origins. |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Sends only the origin on cross-origin navigations and requests. |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | Disables unused browser sensor and payment APIs. |

### Content-Security-Policy directives

| Directive | Value | Notes |
| --- | --- | --- |
| `default-src` | `'self'` | Fallback for any resource type without a more specific directive. |
| `script-src` | `'self'` | Only same-origin scripts may execute. Pre-paint theme resolution is served from `public/theme-init.js` rather than an inline `<script>` so no `'unsafe-inline'` or hash is needed. |
| `style-src` | `'self' 'unsafe-inline'` | `'unsafe-inline'` is required because several components (such as `FormField.tsx` and `SessionExpiryBanner.tsx`) inject `<style>` tags at runtime and some elements use inline `style` attributes. |
| `img-src` | `'self' data:` | Allows same-origin images plus `data:` SVG backgrounds used in `src/styles/patterns.css` and `src/index.css`. |
| `connect-src` | `'self'` + Callora API + Stellar Horizon, Soroban RPC, and Friendbot origins | Allows browser `fetch`/XHR calls to `https://api.callora.com`, Stellar Horizon (`horizon-testnet.stellar.org`, `horizon.stellar.org`, `horizon-futurenet.stellar.org`), Soroban RPC (`soroban-testnet.stellar.org`, `rpc-futurenet.stellar.org`), and `https://friendbot.stellar.org`. |
| `frame-ancestors` | `'none'` | Blocks the app from being embedded in `<iframe>`, `<frame>`, or `<object>` elements (clickjacking protection). |
| `base-uri` | `'self'` | Prevents `<base>` tag injection from redirecting relative URLs. |
| `object-src` | `'none'` | Disables legacy plugin content (`<object>`, `<embed>`, `<applet>`). |

### Extending `connect-src` for custom origins

Because `Content-Security-Policy` is evaluated by the browser at runtime, any new origin the frontend calls must be added to the `connect-src` directive in `vercel.json`:

- **Custom or staging Callora API (`VITE_API_BASE_URL`):** If you deploy against a non-default backend (for example `https://staging-api.callora.com`), append that origin to `connect-src` in `vercel.json`.
- **Mainnet Soroban RPC (`VITE_STELLAR_RPC_URL`):** Stellar mainnet has no default public Soroban RPC endpoint in `src/config/constants.ts`. When building for mainnet with a custom `VITE_STELLAR_RPC_URL` host, add that RPC origin to `connect-src` in `vercel.json` so wallet balance reads and deposit submissions are not blocked.

## Demo mode

Demo mode provides a complete, standalone preview of the Callora marketplace, detail pages, provider APIs, usage analytics, billing invoices, and webhook deliveries without needing a live backend service or Stellar wallet.

Instead of ad-hoc per-page fallbacks, demo mode is powered by a unified [Mock Service Worker (MSW)](https://mswjs.io/) handler set located in `src/mocks/handlers.ts`. In the browser, MSW registers a service worker (`public/mockServiceWorker.js`) that intercepts outgoing `/api/*` network requests and responds with realistic fixtures. In Vitest, the exact same handlers run under Node via `src/mocks/server.ts`.

### Enabling demo mode

Set `VITE_DEMO_MODE=true` in `.env.local` or inline when running the dev server or build:

```bash
# Start dev server with MSW demo mode
VITE_DEMO_MODE=true npm run dev

# Build a standalone demo preview
VITE_DEMO_MODE=true npm run build
```

When `VITE_DEMO_MODE` is not `"true"` (default), MSW is not initialized and requests proceed over the network. MSW is imported dynamically in `src/main.tsx`, ensuring that standard production builds do not include any MSW code in the primary bundle chunk.

### Mock service worker setup

The browser worker script is initialized with:

```bash
npx msw init public/ --save
```

This places `public/mockServiceWorker.js` in the public directory and registers `msw.workerDirectory` in `package.json`.

### How to add an endpoint handler

1. **Add or reuse fixtures**: Place sample payloads in `src/mocks/fixtures/` (e.g. `catalog.ts`, `billing.ts`, `usage.ts`, `webhooks.ts`, `quota.ts`), reusing existing data sources like `MOCK_APIS` and `billingFixtures.ts` rather than duplicating data.
2. **Define the handler**: Add an `http.<method>()` entry to `src/mocks/handlers.ts`:
   ```ts
   import { http, HttpResponse } from "msw";

   export const handlers = [
     // ...
     http.get("*/api/example", ({ request }) => {
       const url = new URL(request.url);
       return HttpResponse.json({ ok: true, query: url.searchParams.get("q") });
     }),
   ];
   ```
3. **Share across browser and tests**: Both `src/mocks/browser.ts` and `src/mocks/server.ts` export instances wired to `handlers`. Any handler added here is immediately available in both demo mode in the browser and in Vitest.
4. **Override in tests**: In specific Vitest test suites, override or simulate edge cases (e.g., 500 error, custom delay) using `server.use(...)`:
   ```ts
   import { server } from "../mocks/server";
   import { http, HttpResponse } from "msw";

   server.use(
     http.get("*/api/example", () => {
       return new HttpResponse(null, { status: 500 });
     }),
   );
   ```

## Endpoint behaviours

When `VITE_DEMO_MODE=true`, MSW intercepts requests across the app and serves consistent fixtures:
- **Marketplace (`GET /api/apis`)**: Returns catalogue items supporting search, category, and `304 Not Modified` conditional ETag revalidation.
- **API Details (`GET /api/apis/:id`)**: Returns API details or 404 for unknown IDs.
- **Provider APIs (`GET /api/provider/apis`)**: Returns publisher APIs for `acme-labs` with cyclical publish statuses.
- **API Usage (`GET /api/usage`)**: Returns aggregated daily usage and history matching `UsageApiResponse`.
- **Billing Invoices (`GET /api/invoices`)**: Returns invoice listings with status, amounts, and dates.
- **Activity Feed (`GET /api/activity`)**: Returns recent account activity events.
- **Quota (`GET /api/quota`, `PUT /api/quota`)**: In-memory stateful store supporting updates and version conflict detection.
- **Auth (`/api/auth/*`)**: Simulated wallet authentication, session refresh, and revocation.

## CI

`.github/workflows/ci.yml` runs on every push to `main` and on pull requests: `tsc --noEmit`, `npm run build`, `vitest run`.
