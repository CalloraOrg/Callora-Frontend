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
- 500 error page with retry flow
- 404 catch-all page
- Theme playground for previewing primary/accent/surface tokens live
- Dev proxy to backend at `http://localhost:3000` for `/api`
- **Global Command Palette**: Instantly jump to views, search APIs by name, cycle/toggle light & dark themes, or trigger vault deposits. Use `Cmd+K` on macOS or `Ctrl+K` on Windows/Linux to open.
- **Pattern-based status badges**: Status indicators now use distinct textures in addition to color so they remain understandable for color-blind users and in grayscale displays.
- **Smooth theme transition**: Light/dark switches animate color tokens (background, text, border) over 240 ms instead of snapping. The transition is gated behind a `theme-transitions-ready` class that ThemeProvider adds after the first paint, preventing any flash on load. Animated elements (toasts, skeletons, spinners) are automatically excluded. Use the `.no-theme-transition` escape hatch on any element that must opt out.

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

## Accessibility notes

The dashboard includes an accessible usage gauge that summarizes API spend for the current cycle. It exposes `role="progressbar"`, numeric ARIA values, and a human-readable usage state such as “Within limit”, “Approaching limit”, “Critical usage”, “Limit reached”, or “No limit configured” so screen-reader users receive the same status information as sighted users.

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
| `/theme-playground` | Live theme token playground for designers |
| `/500`              | Server error page                         |
| `*`                 | 404 not found                             |

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
│   │   ├── FiltersSidebar.tsx
│   │   ├── NotFound.tsx
│   │   ├── SearchBar.tsx
│   │   ├── ServerError.tsx
│   │   ├── ServerErrorDemo.tsx
│   │   └── Skeleton.tsx
│   ├── pages/               # Standalone page components
│   │   ├── ApiDetailPage.tsx
│   │   └── MarketplacePage.tsx
│   ├── hooks/               # Custom React hooks
│   │   └── useDebounce.ts
│   ├── data/                # Static and mock data
│   │   └── mockApis.ts
│   ├── utils/               # Utility functions
│   │   └── format.ts        # Currency formatters (formatUsdc, formatUsdShortcut, formatPrice)
│   └── vite-env.d.ts
├── docs/
│   └── UI-Design-System.md
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

This repo is part of [Callora](https://github.com/your-org/callora). Backend and contracts live in separate repos: `callora-backend`, `callora-contracts`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.
