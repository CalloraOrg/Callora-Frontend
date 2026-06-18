# Callora Frontend

Web app for the Callora API marketplace: developer dashboard, API management, and billing views.

## Tech stack

- **React 18** + **TypeScript**
- **Vite** for build and dev server
- Minimal UI (no component library); ready to extend

## What’s included

- Dashboard placeholder (usage, vault balance)
- APIs section (publish/manage APIs and pricing)
- Billing section (USDC deposit, settlements)
- Dev proxy to backend at `http://localhost:3000` for `/api`

## UI Design System

Callora uses a comprehensive design token system and component library. All contributors must follow the [UI Design System guide](docs/UI-Design-System.md) when building or modifying UI.

Key principles:
- **Use design tokens, not inline hex values** - All colors, spacing, and shadows use CSS custom properties
- **Reuse shared components** - Use existing components from `src/components/` before creating new ones
- **Maintain accessibility** - All UI must be keyboard navigable and screen reader friendly
- **Test both themes** - Verify appearance in both light and dark modes

## Local setup

1. **Prerequisites:** Node.js 18+

2. **Install and run:**

   ```bash
   cd callora-frontend
   npm install
   npm run dev
   ```

3. Open [http://localhost:5173](http://localhost:5173).

## Scripts

| Command     | Description              |
|------------|--------------------------|
| `npm run dev`    | Start dev server (port 5173) |
| `npm run build`  | TypeScript check + production build |
| `npm run preview`| Serve production build locally     |

## Project layout

```
callora-frontend/
├── src/
│   ├── App.tsx              # Main app and tabs
│   ├── main.tsx             # Entry
│   ├── index.css            # Global styles
│   ├── config/
│   │   └── constants.ts     # Shared app constants (URLs, deposit limits, loading delay)
│   ├── utils/
│   │   └── format.ts        # Currency formatters (formatUsdc, formatUsdShortcut, formatPrice)
│   ├── components/          # Reusable UI components
│   ├── pages/               # Route-level page components
│   └── vite-env.d.ts
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

This repo is part of [Callora](https://github.com/your-org/callora). Backend and contracts live in separate repos: `callora-backend`, `callora-contracts`.
