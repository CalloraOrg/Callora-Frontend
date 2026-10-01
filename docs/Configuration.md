# Configuration

The Callora frontend reads all of its configuration from `VITE_*` environment
variables. This document covers the variables, their defaults, the dev-server
`/api` proxy, and how the pieces fit together at runtime and at build time.

Every variable is listed in [`.env.example`](../.env.example); that file is the
canonical, committed reference and is safe to copy.

## Environment files

Vite loads env files from the project root, most specific first:

| File | Committed? | Use |
| --- | --- | --- |
| `.env` | no | shared defaults |
| `.env.local` | no | your machine, overrides `.env` |
| `.env.development` / `.env.production` | no | per-mode overrides |
| `.env.example` | **yes** | documented template |

`.gitignore` ignores `.env` and `.env.*` but re-includes `.env.example`
(`!.env.example`), so the template always ships while real values never do.

To get started:

```bash
cp .env.example .env.local
```

`VITE_*` values are inlined into the JavaScript bundle by Vite at build time.
They are **not** secrets. Anything that must stay private belongs in the
backend, never here.

## Variables

### `VITE_API_BASE_URL`

Base origin the browser uses for Callora API requests. Default: **empty**.

- **Empty (default, local development).** Requests stay relative — `/api/marketplace`
  is fetched from `http://localhost:5173/api/marketplace` and the dev server
  proxies it to the backend. Because the browser sees one origin, **no CORS
  setup is required** and cookies behave normally.
- **Absolute origin** (e.g. `https://api.staging.callora.com`). Requests go
  straight to that origin and the dev proxy is bypassed. That backend must send
  CORS headers allowing this app's origin.

Trailing slashes and surrounding whitespace are stripped automatically by
`normalizeBaseUrl`, so `https://api.callora.com/` and
`https://api.callora.com` are equivalent. Use `apiUrl()` from
`src/config/constants.ts` to build request paths so this normalisation is
applied consistently.

### `VITE_STELLAR_NETWORK`

Stellar network the UI is pointed at. One of `testnet`, `mainnet`,
`futurenet`. Default: `testnet`.

The value is case-insensitive and whitespace-trimmed. An unset value falls back
to `testnet` silently; an unrecognised value (a typo, for example
`VITE_STELLAR_NETWORK=testnett`) also falls back to `testnet` but logs a warning
in development, because a silently wrong network is worse than a loud warning.
Resolve it through `resolveStellarNetwork()` rather than reading the raw
variable.

### `VITE_DEV_API_PROXY_TARGET`

Where the dev server forwards `/api` requests. Default:
`http://localhost:3000`.

Read by `vite.config.ts` at startup only. It is **never** inlined into the
browser bundle and has no effect on production builds. Point it at a remote
backend for local UI work against staging data:

```bash
VITE_DEV_API_PROXY_TARGET=https://api.staging.callora.com npm run dev
```

or set it once in `.env.local`.

## The dev-server `/api` proxy

`vite.config.ts` forwards every request whose path starts with `/api`:

```ts
server: {
  port: 5173,
  proxy: {
    '/api': {
      target: env.VITE_DEV_API_PROXY_TARGET?.trim() || 'http://localhost:3000',
      changeOrigin: true,
    },
  },
},
```

What this buys you:

- **No CORS in development.** The browser only ever talks to
  `localhost:5173`; the forwarding happens in Node, where the same-origin
  policy does not apply.
- **No rewrite.** `/api/marketplace` arrives at the backend unchanged, so the
  frontend and backend agree on paths in every environment.
- **`changeOrigin: true`** rewrites the outgoing `Host` header to the target's
  host. Backends that route or validate on `Host` (common behind a load
  balancer) reject the request without it.

Production builds are static assets: the same relative `/api/...` calls are
served by whatever reverse proxy sits in front of the app, which must forward
`/api` to the backend the same way the dev proxy does. Keeping requests
relative is what makes that work without a rebuild per environment.

## Where configuration lives in code

| Export | Purpose |
| --- | --- |
| `API_BASE` | normalised `VITE_API_BASE_URL`, empty by default |
| `STELLAR_NETWORK` | validated `VITE_STELLAR_NETWORK` |
| `DEFAULT_STELLAR_NETWORK` | `"testnet"` |
| `StellarNetwork` | union type of valid networks |
| `apiUrl(path)` | join a path onto `API_BASE` |
| `normalizeBaseUrl(value)` | trim + strip trailing slashes |
| `resolveStellarNetwork(raw)` | validate with dev-only warning |

`src/config/constants.ts` is the single place these variables are read. Read
the exported constants instead of `import.meta.env` elsewhere so validation and
defaults cannot drift between call sites.

```ts
import { STELLAR_NETWORK, apiUrl } from "./config/constants";

fetch(apiUrl("/marketplace")); // "/marketplace" locally, absolute when configured
```

## Adding a new variable

1. Add it to `.env.example` under a section heading, with a comment explaining
   the effect of each accepted value.
2. Read and validate it in `src/config/constants.ts`; export a named constant
   rather than exposing the raw value.
3. Document it in the [Variables](#variables) section above.
4. Prefix it with `VITE_` only if the browser bundle genuinely needs it.
5. Give it a safe default so a fresh clone runs with no `.env` at all.

## See also

- [`README.md`](../README.md) — setup and scripts
- [`.env.example`](../.env.example) — copy-paste template
