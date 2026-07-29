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

## Keyboard shortcuts

- **Open Command Palette**: `Cmd + K` (macOS) or `Ctrl + K` (Windows/Linux)
- **Navigate options**: `Up / Down Arrow` keys
- **Select option**: `Enter`
- **Close Palette**: `Escape` or backdrop click

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

## Print stylesheet

Added `src/styles/print.css` to hide UI chrome and expand collapsible
sections when printing the `SortMenu` page. This improves printed output
by removing interactive controls and making content fully visible. (Closes #708)


**ApiDetailPage keyboard focus (WCAG 2.1 AA, Issue #411):** All interactive elements on `ApiDetailPage` — buttons, links, inputs, selects, icon buttons, tab panels, and the pricing range slider — display a WCAG-compliant `:focus-visible` outline. The focus ring uses the theme-aware `--accent` token (2 px solid, 3 px offset), which meets the 3:1 non-text contrast requirement against both dark (`#4e85ff` on `#0b1020`) and light (`#2563eb` on `#f5f7fa`) backgrounds. Styles live in `src/styles/focus.css` inside `@layer focus` so they are always lower-priority than intentional page overrides. No mouse-triggered focus rings are shown (`outline: none` on `:focus`, restored on `:focus-visible`).

**Plan Badge empty state (WCAG 2.1 AA, Issue #529):** The `EmptyState` `"plan-badge"` variant illustration is `aria-hidden`; meaning is carried exclusively by the heading and paragraph text (WCAG 1.1.1). Accent colour is a subordinate decorative detail — the state is never communicated by colour alone (WCAG 1.4.1). Both CTA buttons carry explicit accessible names via `aria-label`. All colours reference design tokens so contrast is maintained in both light and dark themes.

**QuotaBanner empty state (WCAG 2.1 AA, Issue #702 / b#025):** When `showEmptyState` and `onSetupQuota` are set, `QuotaBanner` renders `EmptyState` `variant="quota-banner"` (gauge + bars illustration). The illustration is `aria-hidden`; the section is labelled via `aria-labelledby` → `headingId="quota-banner-empty-heading"`. The "Set up quota" CTA guides configuration. See `docs/QuotaBanner-EmptyState.md`.
## Scripts

| Command           | Description                         |
| ----------------- | ----------------------------------- |
| `npm run dev`     | Start dev server (port 5173)        |
| `npm run build`   | TypeScript check + production build |
| `npm run preview` | Serve production build locally      |

## Routes

| Path                | Description                               |
| ------------------- | ----------------------------------------- |
| `/`                 | Landing page                              |
| `/dashboard`        | Developer dashboard                       |
| `/marketplace`      | API marketplace                           |
| `/billing`          | USDC deposit and settlements              |
| `/api-usage`        | API usage analytics                       |
| `/apis/my-apis`     | Published APIs management                 |
| `/apis/plan-badge`  | Plan-tier badge assignment and empty state |
| `/theme-playground` | Live theme token playground for designers |
| `/500`              | Server error page                         |
| `*`                 | 404 not found                             |
| `/marketplace/grantfox-wave-compute/sla` | GrantFox Wave Compute API SLA details (FWC26) |

## Project layout

```
callora-frontend/
├── src/
│   ├── App.tsx              # Router, layout, and route definitions
│   ├── main.tsx             # Entry point
│   ├── index.css            # Global styles and design tokens
│   ├── ThemeContext.tsx      # Light/dark theme context
│   ├── ThemeToggle.tsx      # Theme toggle component
│   ├── ApiUsage.tsx         # API usage analytics view
│   ├── config/              # Shared app configuration
│   │   └── constants.ts     # App constants (URLs, deposit limits, loading delay)
│   ├── components/          # Shared UI components
│   │   ├── ApiCard.tsx
│   │   ├── Breadcrumb.tsx
│   │   ├── CodeExample.tsx
│   │   ├── CommandPalette.css
│   │   ├── CommandPalette.test.tsx
│   │   ├── CommandPalette.tsx
│   │   ├── CommandPalette_MANUAL_TEST_PLAN.md
│   │   ├── Dashboard.tsx
│   │   ├── EmptyState.tsx
│   │   ├── EndpointGroupHover.tsx
│   │   ├── EndpointPreview.tsx
│   │   ├── FiltersSidebar.tsx
│   │   ├── NotFound.tsx
│   │   ├── SearchBar.tsx
│   │   ├── ServerError.tsx
│   │   ├── ServerErrorDemo.tsx
│   │   └── Skeleton.tsx
│   ├── pages/               # Standalone page components
│   │   ├── ApiDetailPage.tsx
│   │   ├── MarketplacePage.tsx
│   │   └── RateLimitCard.tsx  # (Issue #537) Rate-limit quota card with middle-ellipsis breadcrumb
│   ├── hooks/               # Custom React hooks
│   │   └── useDebounce.ts
│   ├── data/                # Static and mock data
│   │   └── mockApis.ts
│   ├── utils/               # Utility functions
│   │   ├── diff.ts          # Line-level diff engine (computeDiff, diffJson, hasDifferences)
│   │   └── format.ts        # Currency formatters (formatUsdc, formatUsdShortcut, formatPrice)
│   └── vite-env.d.ts
├── docs/
│   ├── UI-Design-System.md
│   └── ResponseDiff.md      # Response diff highlighting (CallHistoryRow)
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

This repo is part of [Callora](https://github.com/your-org/callora). Backend and contracts live in separate repos: `callora-backend`, `callora-contracts`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.
