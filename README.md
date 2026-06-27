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
- Marketplace (browse and compare APIs)
- Billing (USDC deposit, Stellar settlement, transaction tracking)
- API Usage analytics view
- 500 error page with retry flow
- 404 catch-all page
- Dev proxy to backend at `http://localhost:3000` for `/api`

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

## Scripts

| Command          | Description                          |
|------------------|--------------------------------------|
| `npm run dev`    | Start dev server (port 5173)         |
| `npm run build`  | TypeScript check + production build  |
| `npm run preview`| Serve production build locally       |

## Routes

| Path        | Description                     |
|-------------|---------------------------------|
| `/`         | Landing page                    |
| `/dashboard`| Developer dashboard             |
| `/marketplace` | API marketplace              |
| `/billing`  | USDC deposit and settlements    |
| `/api-usage`| API usage analytics             |
| `/500`      | Server error page               |
| `*`         | 404 not found                   |

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
