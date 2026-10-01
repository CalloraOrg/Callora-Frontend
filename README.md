# Callora Frontend

Web app for the Callora API marketplace: developer dashboard, API management, and billing views.

## Tech stack

- **React 18** + **TypeScript**
- **Vite** for build and dev server
- **React Router v6** for client-side routing
- Minimal UI (no component library); ready to extend

## What's included

- Landing page with product overview
- Dashboard (usage stats, vault balance)
- Screen-reader-friendly dashboard usage gauge with visible usage state and remaining allowance
- Marketplace (browse and compare APIs)
- **Marketplace density preference**: The marketplace toolbar offers Comfortable and Compact result layouts. The selected layout updates every result card, remains keyboard accessible, and is saved locally for future visits.
- Pinned APIs on the dashboard for fast access to saved marketplace APIs
- Billing (USDC deposit, Stellar settlement, transaction tracking)
- API Usage analytics view
- `ApiUsage` screen-reader status announcements for endpoint, filter, and copy actions via a centralized `aria-live` region
- 500 error page with retry flow
- 404 catch-all page
- Theme playground for previewing primary/accent/surface tokens live
- Sticky bottom action bar on the theme toggle that surfaces primary theme actions after scrolling
- Dev proxy to backend at `http://localhost:3000` for `/api`
- **Global Command Palette**: Instantly jump to views, search APIs by name, cycle/toggle light & dark themes, or trigger vault deposits. Use `Cmd+K` on macOS or `Ctrl+K` on Windows/Linux to open.
- **Pattern-based status badges**: Status indicators now use distinct textures in addition to color so they remain understandable for color-blind users and in grayscale displays.
- **Response diff highlighting**: Pass a `compareWith` prop to `CallHistoryRow` to show a line-by-line diff between two call responses, with added (green), removed (red), and unchanged context lines. Includes a Diff/Raw toggle, before/after call labels, and full WCAG 2.1 AA accessibility. See [docs/ResponseDiff.md](docs/ResponseDiff.md).
- **SLA details card**: The GrantFox Wave Compute API SLA page (`/marketplace/grantfox-wave-compute/sla`) displays all SLA metrics with per-value copy-to-clipboard buttons. Each button shows a 2-second "Copied!" success state (green checkmark + label), announces the copy to screen readers via `aria-live`, and falls back to `execCommand` in non-HTTPS contexts. Powered by the reusable `useCopy` hook. See [docs/SlaCard-CopyToClipboard.md](docs/SlaCard-CopyToClipboard.md).
- **Smooth theme transition**: Light/dark switches animate color tokens (background, text, border) over 240 ms instead of snapping. The transition is gated behind a `theme-transitions-ready` class that ThemeProvider adds after the first paint, preventing any flash on load. Animated elements (toasts, skeletons, spinners) are automatically excluded. Use the `.no-theme-transition` escape hatch on any element that must opt out.
- **Endpoint hover preview**: On the API Detail documentation tab, hovering or focusing an individual endpoint card header reveals a compact floating panel showing the HTTP method badge, endpoint URL, parameter table (name / type / required), and an optional response-shape snippet. Keyboard accessible (Escape dismisses); all colours from design tokens. See `src/components/EndpointPreview.tsx`.
- **Generic BottomSheet with visible drag handle** (GrantFox FWC26): `src/components/BottomSheet.tsx` is a reusable bottom-sheet dialog with a persistent pill-shaped drag handle. The pill widens and brightens on hover and during active drag. Supports two snap points (`"half"` / `"full"`), a `footer` slot, focus trap, Escape / backdrop dismiss, focus restore, body scroll lock, and full `prefers-reduced-motion` support. All colours use design tokens. See [docs/BottomSheet-drag-handle.md](docs/BottomSheet-drag-handle.md).
- **Reduced-motion data transitions** (Issue #1005): Loading skeletons, spinners, the route-progress bar, stale-data fades, and the dashboard activity fetch all respect `prefers-reduced-motion` via a shared `usePrefersReducedMotion` hook + a global CSS fallback. Dashboard activity and webhook-delivery loading/error/stale changes are announced through `role="status"` / `role="alert"` live regions. See [docs/data-transitions-reduced-motion.md](docs/data-transitions-reduced-motion.md).
- **Route splitting and prefetching** (Issue #1155): every heavy page in `src/App.tsx` is a `lazy()` chunk behind one shared `Suspense` boundary, and a `routePrefetchers` map warms a page's chunk on nav-link hover/focus. Adding a page means updating both the lazy import and the prefetch map. See [docs/RouteSplitting.md](docs/RouteSplitting.md).

## Keyboard shortcuts

### Command Palette

`src/components/CommandPalette.tsx` isn't rendered anywhere in the app yet, so these keys currently do nothing. They describe the component as built:

- **Open Command Palette**: `Cmd + K` (macOS) or `Ctrl + K` (Windows/Linux)
- **Navigate options**: `Up / Down Arrow` keys
- **Select option**: `Enter`
- **Close Palette**: `Escape` or backdrop click

### Shortcut reference

The tables below list every entry in `SHORTCUTS` (`src/hooks/useGlobalShortcuts.ts`), which is what the Shortcuts dialog renders, grouped by the same categories in the same order. For two-key shortcuts such as `g h`, press `g` and then `h`.

`?` (open the Shortcuts dialog) and the `g` sequences are handled in `App.tsx`, so they work on pages rendered inside the app shell. Pages that `src/main.tsx` renders on its own after a full page load (`/publish`, `/marketplace`, `/details/:id` and `/latency-chart`) don't respond to them.

**Not wired up yet:** four entries in the dialog have no handler for the action they describe: `u` (Upgrade plan), `/` (Focus search bar), `1-5` (Switch tabs) and `Esc` on the API detail page (Go back to Marketplace). They are listed so this reference matches the dialog.

#### Global

| Key | Action |
| --- | ------ |
| `?` | Open shortcuts help |
| `Esc` | Close modals |

#### Navigation

| Key | Action |
| --- | ------ |
| `g h` | Go to Dashboard |
| `g m` | Go to Marketplace |
| `g b` | Go to Billing |
| `g a` | Go to My APIs |

#### Plan

| Key | Action |
| --- | ------ |
| `u` | Upgrade plan |

#### Marketplace

| Key | Action |
| --- | ------ |
| `/` | Focus search bar |
| `c` | Add/remove focused API card to comparison |

#### ApiDetailPage

| Key | Action |
| --- | ------ |
| `Esc` | Go back to Marketplace |
| `1-5` | Switch tabs (1=Overview, 2=Documentation, 3=Pricing, 4=Examples, 5=Reviews) |

#### Pricing

| Key | Action |
| --- | ------ |
| `s` | Select recommended pricing plan |

### Typing in form fields

`?` and the `g` that starts a navigation sequence go through `useGlobalShortcuts`, which ignores key presses while focus is in an `input`, `textarea` or `select` element or in editable (`contenteditable`) content. Typing in a form therefore never opens the Shortcuts dialog or starts a `g` sequence. `c` (on a focused API card) and `s` (on the pricing table) are handled by those components, which also ignore key presses from text inputs.

When you add a shortcut, add it to `SHORTCUTS` and to the matching table above. `src/hooks/useGlobalShortcuts.test.tsx` fails when the README and the Shortcuts dialog disagree.

## UI Design System

Callora uses a comprehensive design token system and component library. All contributors must follow the [UI Design System guide](docs/UI-Design-System.md) when building or modifying UI.

Key principles:

- **Use design tokens, not inline hex values** — All colors, spacing, and shadows use CSS custom properties
- **Reuse shared components** — Use existing components from `src/components/` before creating new ones
- **Maintain accessibility** — All UI must be keyboard navigable and screen reader friendly
- **Test both themes** — Verify appearance in both light and dark modes

## Local setup

1. **Prerequisites:** Node.js 18+

2. **Install and run:**

   ```bash
   npm install
   npm run dev
   ```

3. Open [http://localhost:5173](http://localhost:5173).

No `.env` file is required — every variable has a working default.

## Configuration

All configuration is read from `VITE_*` environment variables. Copy
[`.env.example`](.env.example) to `.env.local` and adjust as needed:

```bash
cp .env.example .env.local
```

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `VITE_API_BASE_URL` | *(empty)* | API origin. Empty keeps requests relative so the dev server proxies them; set an absolute origin to call a backend directly (requires CORS). |
| `VITE_STELLAR_NETWORK` | `testnet` | One of `testnet`, `mainnet`, `futurenet`. Unrecognised values fall back to `testnet` with a dev warning. |
| `VITE_DEV_API_PROXY_TARGET` | `http://localhost:3000` | Dev-server-only: where `/api` is proxied. Never inlined into the bundle. |

In development, `vite.config.ts` proxies `/api` to
`VITE_DEV_API_PROXY_TARGET`, so the browser only ever talks to
`localhost:5173` and **no CORS setup is needed**. Paths are forwarded without
rewriting, and the value is read at startup, so a one-off override works too:

```bash
VITE_DEV_API_PROXY_TARGET=https://api.staging.callora.com npm run dev
```

Every `VITE_*` value is inlined into the shipped bundle and is therefore public
— never put a secret in one. See [docs/Configuration.md](docs/Configuration.md)
for the full reference, including where each value is read in code and how to
add a new variable.

## Print stylesheet

Added `src/styles/print.css` to hide UI chrome and expand collapsible
sections when printing the `SortMenu` page. This improves printed output
by removing interactive controls and making content fully visible. (Closes #708)


**ApiDetailPage keyboard focus (WCAG 2.1 AA, Issue #411):** All interactive elements on `ApiDetailPage` — buttons, links, inputs, selects, icon buttons, tab panels, and the pricing range slider — display a WCAG-compliant `:focus-visible` outline. The focus ring uses the theme-aware `--accent` token (2 px solid, 3 px offset), which meets the 3:1 non-text contrast requirement against both dark (`#4e85ff` on `#0b1020`) and light (`#2563eb` on `#f5f7fa`) backgrounds. Styles live in `src/styles/focus.css` inside `@layer focus` so they are always lower-priority than intentional page overrides. No mouse-triggered focus rings are shown (`outline: none` on `:focus`, restored on `:focus-visible`).

**Plan Badge empty state (WCAG 2.1 AA, Issue #529):** The `EmptyState` `"plan-badge"` variant illustration is `aria-hidden`; meaning is carried exclusively by the heading and paragraph text (WCAG 1.1.1). Accent colour is a subordinate decorative detail — the state is never communicated by colour alone (WCAG 1.4.1). Both CTA buttons carry explicit accessible names via `aria-label`. All colours reference design tokens so contrast is maintained in both light and dark themes.

**QuotaBanner empty state (WCAG 2.1 AA, Issue #702 / b#025):** When `showEmptyState` and `onSetupQuota` are set, `QuotaBanner` renders `EmptyState` `variant="quota-banner"` (gauge + bars illustration). The illustration is `aria-hidden`; the section is labelled via `aria-labelledby` → `headingId="quota-banner-empty-heading"`. The "Set up quota" CTA guides configuration. See `docs/QuotaBanner-EmptyState.md`.
## Scripts

| Command                | Description                                    |
| ---------------------- | ---------------------------------------------- |
| `npm run dev`          | Start dev server (port 5173)                   |
| `npm run build`        | TypeScript check + production build            |
| `npm run preview`      | Serve production build locally                 |
| `npm test`             | Run the Vitest suite in watch mode             |
| `npm run test:coverage`| Run the suite once and write a coverage report |

### Running tests

Vitest discovers `src/**/*.test.{ts,tsx}`. Commands for the common cases:

```bash
npm test                                  # watch mode, re-runs on change
npm test -- --run                         # single pass, no watch
npm test -- --run src/components/Pagination.test.tsx   # one file
npm test -- --run -t "clamps the page"    # one test by name
npm run test:coverage                     # single pass + coverage report
```

`vitest.config.ts` provides the defaults: `globals: true` (so `describe`,
`it`, and `expect` need no import), the `jsdom` environment, `src/setupTests.ts`
for shared matchers and cleanup, and CSS handling for components that import
stylesheets. Coverage output is written to `coverage/`.

See [CONTRIBUTING.md](CONTRIBUTING.md#testing) for what to test before opening
a pull request.

## Routes

Most pages are registered in `src/App.tsx`: the `APP_ROUTES` map and the `<Route>` elements that use it. On every full page load `src/main.tsx` checks the URL first and renders a few paths itself, outside the `App` shell. It matches by prefix, so `/marketplace/anything` also shows the marketplace. The "Rendered by" column shows which file serves each path.

| Path | Description | Rendered by | Notes |
| ---- | ----------- | ----------- | ----- |
| `/` | Landing page | `App.tsx` | |
| `/onboarding` | Guided multi-step tour for new users | `App.tsx` | |
| `/dashboard` | Developer dashboard | `App.tsx` | |
| `/marketplace` | API marketplace | `main.tsx`, `App.tsx` | `main.tsx` serves full page loads |
| `/details/:id` | API detail page: overview, documentation, pricing, examples, reviews and embed tabs | `main.tsx` | `App.tsx` has no route for it; links push the URL and dispatch `popstate` |
| `/publish` | Publish a new API listing | `main.tsx`, `App.tsx` | `main.tsx` serves full page loads |
| `/apis/my-apis` | Published APIs management | `App.tsx` | |
| `/apis/plan-badge` | Plan-tier badge assignment and empty state | `App.tsx` | |
| `/api-usage` | API usage analytics | `App.tsx` | |
| `/billing` | USDC deposit and settlements | `App.tsx` | |
| `/billing/history` | Paginated history of past USDC billing transactions | `App.tsx` | |
| `/webhooks/deliveries` | Webhook delivery log | `App.tsx` | |
| `/documentation` | Documentation landing page | `App.tsx` | Placeholder copy |
| `/status` | System status | `App.tsx` | Placeholder copy |
| `/latency-chart` | API latency chart with min, average and P95 | `main.tsx` | Not linked from the app yet |
| `/theme-playground` | Live theme token playground for designers | `App.tsx` | Internal tool |
| `/design-system/docs` | UI component catalogue with live examples | `App.tsx` | Internal tool |
| `/a11y-audit` | Accessibility audit board | `App.tsx` | Internal tool |
| `/500` | Server error page | `App.tsx` | Demo only |
| `/rate-limit` | Rate-limit configuration card | `App.tsx` | Demo only |
| `/marketplace/grantfox-wave-compute/sla` | GrantFox Wave Compute API SLA details (FWC26) | `main.tsx` | Not wired up yet: it is in `APP_ROUTES`, but no `<Route>` renders `SlaCard`, so a page load here shows the marketplace |
| `*` | 404 not found | `App.tsx` | Unmatched paths that reach `App.tsx` |

When you add a route (an `APP_ROUTES` entry, a `<Route>` in `src/App.tsx` or a path check in `src/main.tsx`), add a row here. `src/readme-routes.test.ts` fails when a route in the code is missing from this table or a row names a path the code doesn't serve.


## Project layout

- **`src/`**
  - `main.tsx` — Application entry point
  - `App.tsx` — Router, layout, and route definitions
  - **`api/`** — API client configurations and network request handlers
  - **`components/`** — Shared UI components following the [UI Design System](docs/UI-Design-System.md)
  - **`config/`** — Shared application configuration and environment constants
  - **`data/`** — Static assets and mock data definitions
  - **`hooks/`** — Custom React hooks for shared logic
  - **`pages/`** — Standalone route-level page components
  - **`services/`** — Core business logic and external service integrations
  - **`state/`** — Zustand state management slices and global stores
  - **`styles/`** — Global CSS, design tokens, and utility classes
  - **`utils/`** — Pure utility functions (e.g., [Response Diff Engine](docs/ResponseDiff.md))
- **`docs/`** — Technical documentation and architecture records


This repo is part of [Callora](https://github.com/CalloraOrg/callora). Backend and contracts live in separate repos: `callora-backend`, `callora-contracts`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.
