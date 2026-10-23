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
