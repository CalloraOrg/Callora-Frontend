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

- **Empty (default, local development).** Requests stay relative — `/api/apis` (the
  marketplace catalogue endpoint) is fetched from `http://localhost:5173/api/apis` and the dev server
  proxies it to Callora-Backend. Because the browser sees one origin, **no CORS
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

### `VITE_STELLAR_USDC_ISSUER`

Classic issuer public key for the `USDC` asset backing the configured vault's
Stellar Asset Contract. On testnet, the default is
`GDXDZNSTNORCX4373EGGYS4Q3U3XVZMBSIMMRHG5S5GCCF7JHC7QZWAZ`, backing token
`CAC7CFZ42L3LTTZCI4C3XI6UF7AHS2PYTNJ5QEG2PSLRGDGMWRQOZOT5`.
Override it only with the issuer used by the vault on the selected network.
Mainnet and futurenet require an explicit issuer; they do not inherit the
testnet issuer. Surrounding whitespace is trimmed. An invalid or explicitly
empty key produces a configuration error before a trustline lookup or signature
request. Validation uses `StrKey.isValidEd25519PublicKey`.

`STELLAR_USDC_ASSET` exports `{ code: "USDC", issuer }`.
`STELLAR_USDC_CONFIGURATION_ERROR` exposes validation failures to the modal.
`STELLAR_HORIZON_URL` follows `STELLAR_NETWORK`: testnet uses
`https://horizon-testnet.stellar.org`, mainnet uses `https://horizon.stellar.org`,
and futurenet uses `https://horizon-futurenet.stellar.org`.
See [Deposit flow](Deposit-Flow.md) for the trustline and funding steps.

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
- **No rewrite.** `/api/apis` arrives at the backend unchanged, so the
  frontend and backend agree on paths in every environment.
- **`changeOrigin: true`** rewrites the outgoing `Host` header to the target's
  host. Backends that route or validate on `Host` (common behind a load
  balancer) reject the request without it.

Production builds are static assets: the same relative `/api/...` calls are
served by whatever reverse proxy sits in front of the app, which must forward
`/api` to the backend the same way the dev proxy does. Keeping requests
relative is what makes that work without a rebuild per environment.

## Backend catalogue contract (`GET /api/apis`)

The marketplace catalogue connects to the Callora-Backend `GET /api/apis` route.
Key contract details and adapter behavior:
- **Path:** Built using `apiUrl('/api/apis')`.
- **Response Format:** Callora-Backend returns a cursor-paginated response `{ data: BackendApiRow[], meta: { limit, nextCursor, hasMore } }`.
- **`APIItem` Adaptation:** The pure adapter `adaptBackendApi` in `src/api/catalogApi.ts` transforms backend rows to the client's `APIItem` interface:
  - Stringifies numeric `id` to string.
  - Maps `developer.name` to `provider.name`, `developer.website` to `provider.url`, and `logo_url` to `provider.avatar`.
  - Maps `base_url` to `baseUrl`.
  - Derives `pricePerRequest` from the minimum endpoint price. If pricing is not specified or 0 without endpoints, sets `pricingOnRequest: true` so cards display "Pricing on request".
  - Tolerant: Missing optional developer fields gracefully fall back to "Unknown provider" without dropping the row.
- **Conditional Requests & 304 Caching:** Catalog fetch requests send `If-None-Match` using cached `ETag` and reuse cached data on `304 Not Modified`.
- **Fallback Policy:** When `API_BASE` is configured, errors reject rather than silently falling back to sample data, surfacing stale-data or error states in `MarketplacePage`. When unconfigured, mock sample data is displayed with a "Sample data" indicator.

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
| `STELLAR_NETWORK_PASSPHRASE` | passphrase for `STELLAR_NETWORK`, used to sign deposits |
| `STELLAR_RPC_URL` | `VITE_STELLAR_RPC_URL`, else the network's public RPC (none for mainnet) |
| `STELLAR_VAULT_CONTRACT_ID` | `VITE_STELLAR_VAULT_CONTRACT_ID`, empty by default |
| `STELLAR_USDC_ASSET` | classic USDC code and validated configured issuer |
| `STELLAR_USDC_CONFIGURATION_ERROR` | invalid/missing issuer configuration error, otherwise `null` |
| `STELLAR_HORIZON_URL` | Horizon origin for `STELLAR_NETWORK` |
| `ENABLE_DEMO_OUTCOME` | `VITE_ENABLE_DEMO_OUTCOME === "true"` on the dev server only |
| `EXPLORER_BASE_URL` | stellar.expert transaction URL for `STELLAR_NETWORK` |

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

## Session model (wallet sign-in)

Callora uses wallet-based authentication via Freighter and the backend
`POST /api/auth/wallet` endpoint. This section explains the token lifecycle,
storage decisions, and the automatic refresh flow.

### Sign-in sequence

```
Browser                    Freighter             Callora API
   |                           |                     |
   | requestAccess()           |                     |
   |-------------------------->|                     |
   |<----- address ------------|                     |
   |                           |                     |
   | signMessage(challenge)    |                     |
   |   challenge includes:     |                     |
   |   • app origin            |                     |
   |   • wallet address        |                     |
   |   • ISO timestamp         |                     |
   |   • expiry (+5 min)       |                     |
   |   • random nonce          |                     |
   |-------------------------->|                     |
   |<----- signedMessage ------|                     |
   |                           |                     |
   | POST /api/auth/wallet     |                     |
   |   { walletAddress,        |                     |
   |     signature,            |                     |
   |     message }             |                     |
   |---------------------------------------------->  |
   |<-- { accessToken,         |                     |
   |       refreshToken }------|---------------------|
   |                           |                     |
   | store tokens (see below)  |                     |
```

The signed challenge binds the signature to:
- **App origin** — a signature captured on `attacker.com` cannot be replayed
  on `callora.org`.
- **Expiry** — the backend can reject challenges older than 5 minutes.
- **Nonce** — two sign-ins at the same second produce different messages.

### Token storage

| Token | Storage | Rationale |
|---|---|---|
| Access token | Module-level variable (in memory only) | Never written to any browser storage. Survives page navigation within the SPA; cleared on page reload. |
| Refresh token | `sessionStorage` | Survives navigation and back/forward cache; cleared when the tab is closed. Guarded with `try/catch` so blocked storage (private browsing, full quota) degrades gracefully. |

**Why not `localStorage`?** Tokens in `localStorage` persist until explicitly
deleted and are accessible to any script running on the same origin (e.g.
through an XSS). `sessionStorage` is scoped to the tab and cleared when it
closes, which is a meaningful reduction in exposure.

**Why not `httpOnly` cookies?** An `httpOnly` cookie is the most secure option
because it is inaccessible to JavaScript entirely. The backend does not yet set
one (`authController.ts` TODO). Once the backend adds `Set-Cookie:
callora-rt=...; HttpOnly; Secure; SameSite=Strict`, the frontend should:

1. Remove the `sessionStorage` write in `authService.ts`.
2. Remove the `refreshToken` field from the JSON body sent to `/api/auth/refresh`.
3. Drop the `clearRefreshToken()` call in `signOut` (the cookie clears via `/api/auth/revoke`).

### Refresh and retry sequence

```
authFetch("/api/usage", init)
    │
    ├── fetch(url, { Authorization: Bearer <token> })
    │       │
    │   [200] ──────────────────────────────────────> return response
    │       │
    │   [401] ──> ensureRefresh()   ← shared across concurrent calls
    │               │
    │           POST /api/auth/refresh
    │               │
    │           [200] new accessToken ─> retry fetch
    │               │                       │
    │           [401/5xx] ──> signOut()     │
    │                       signalExpiry()   │
    │                       reject           │
    │                                       │
    │                             [200] ──> return response
    │                             [401] ──> signOut() + signalExpiry() + return 401
```

Key properties:
- **Single-flight refresh.** Three concurrent 401s share one `POST /api/auth/refresh`.
  The second and third calls await the promise started by the first.
- **Abort propagation.** An `AbortSignal` passed to `authFetch` is forwarded to
  both the initial request and the retry; it is checked before starting the
  retry as well, so a cancelled caller never triggers an unnecessary network request.
- **Session-expired event.** When the refresh itself fails, `signalExpiry()` is
  called, which `useSessionExpiry` subscribes to. `AppSessionExpiryBanner` in
  `App.tsx` renders `SessionExpiryBanner` when the session is expired.

### Relevant source files

| File | Purpose |
|---|---|
| `src/services/authService.ts` | `signIn`, `signOut`, `getAccessToken`, `refreshAccessToken` |
| `src/services/authFetch.ts` | `authFetch` with single-flight refresh |
| `src/services/sessionExpiry.ts` | Signal bus for session expiry events |
| `src/hooks/useSessionExpiry.ts` | React hook wrapping the signal bus |
| `src/components/SessionExpiryBanner.tsx` | UI banner shown on expiry |
