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

## CI

`.github/workflows/ci.yml` runs on every push to `main` and on pull requests: `tsc --noEmit`, `npm run build`, `vitest run`.
