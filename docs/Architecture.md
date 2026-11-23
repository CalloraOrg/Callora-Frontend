# Architecture overview

| Layer | Location | Notes |
| --- | --- | --- |
| Entry | `src/main.tsx`, `src/renderRoute.tsx` | Picks the page for the URL; re-renders on `popstate` |
| Shell | `src/App.tsx`, `src/components/StandaloneShell.tsx` | `App` owns the vault/dashboard shell; `StandaloneShell` wraps marketplace, publish and details |
| Pages | `src/pages/` | Route-level components |
| Components | `src/components/` | Shared UI |
| Data | `src/api/`, `src/data/`, `src/services/` | Network clients, sample data, wallet/key services |
| State | `src/state/`, `src/hooks/` | Stores and hooks |
| Styles | `src/styles/`, `src/index.css` | Tokens, themes, print and contrast styles |

Fallback rule: any data fetch that fails because no backend is reachable must resolve to sample data (never an empty error screen) when the app is deployed statically.

## App shell modules (`src/app/`)

The application shell in `src/App.tsx` delegates route definitions, marketing sections, and global controls to dedicated modules under `src/app/`:

| Module | Responsibility |
| --- | --- |
| `src/app/routes.ts` | Route path constants (`APP_ROUTES`), primary navigation entries (`PRIMARY_NAV`), and lazy route prefetcher (`prefetchRoute`) |
| `src/app/deposit.ts` | Pending deposit helpers (`readPendingDeposit`, `writePendingDeposit`, `clearPendingDeposit`), stage labels (`STAGE_LABELS`), `getStageLabel`, and `buildExplorerLink` |
| `src/app/LandingPage.tsx` | Marketing landing page component shown at `/` with feature grids, consumer/developer flows, and footer |
| `src/app/StatusPage.tsx` | System operational status route component shown at `/status` |
| `src/app/WalletSignInButton.tsx` | Topbar Freighter wallet sign-in / sign-out button managing self-contained auth states |
| `src/app/AccountSwitcher.tsx` | Multi-account selector dropdown with rename, add, and remove capabilities |

## Shared HTTP client (`src/api/apiClient.ts`)

All backend HTTP calls should go through `apiClient` (`src/api/apiClient.ts`) rather than calling `fetch` directly:

- **Methods:** `apiClient.get/post/put/delete<T>(path, options)`
- **Auth:** Routes through `authFetch` by default (`auth: true`, single-flight 401 refresh); pass `auth: false` for public endpoints (e.g. `catalogApi`) or custom `fetchImpl` for tests.
- **Timeouts & cancellation:** Wraps requests with `runWithTimeout` (`timeoutMs` override) and forwards `AbortSignal`.
- **Errors:** Non-2xx responses throw `ApiError { status, code, retryable, message }` classified via `classifyHttpError`, with sensitive tokens redacted.
- **Validation & normalisers:** Pass `parse: (raw) => T` to run module-specific normalisers (e.g. `normalizeCatalog`, `validateInvoicesResponse`) and wrap `ApiError` into domain errors when keeping existing public error types stable.
