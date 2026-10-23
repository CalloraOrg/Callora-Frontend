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

Without a reachable backend the marketplace falls back to `src/data/mockApis.ts` and other pages use built-in sample data. Set `VITE_API_BASE_URL` to a real Callora API to use live data.

## CI

`.github/workflows/ci.yml` runs on every push to `main` and on pull requests: `tsc --noEmit`, `npm run build`, `vitest run`.
