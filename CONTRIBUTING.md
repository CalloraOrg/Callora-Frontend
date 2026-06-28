# Contributing to Callora Frontend

Thanks for contributing! Follow these guidelines to keep the codebase consistent.

## Prerequisites

- Node.js 18+
- npm (comes with Node.js)

## Setup

```bash
git clone https://github.com/your-org/Callora-Frontend.git
cd Callora-Frontend
npm install
npm run dev      # dev server at http://localhost:5173
npm run build    # TypeScript check + production build
```

## Branch naming

Branch off `main` using the format:

```
feature/<short-description>   # new features
fix/<short-description>        # bug fixes
docs/<short-description>       # documentation only
```

Example: `git checkout -b feature/api-search-filters`

## Making changes

1. Fork the repo and create a branch from `main`.
2. Make your changes, following the guidelines below.
3. Run `npm run build` to confirm no TypeScript errors.
4. Open a pull request against `main` with a clear description of what changed and why.

## Design system

All UI changes must follow the [UI Design System](docs/UI-Design-System.md).

Key rules:
- **Use design tokens, not raw values.** Colors, spacing, and shadows are defined as CSS custom properties in `src/index.css`. Reference them via `var(--token-name)` — never use inline hex values or hardcoded pixel sizes.
- **Reuse existing components.** Check `src/components/` before building something new. Components like `ApiCard`, `EmptyState`, `SearchBar`, `Skeleton`, and `Breadcrumb` are shared across views.
- **Do not introduce a component library.** The project is intentionally dependency-light.

## Accessibility

- All interactive elements must be keyboard navigable and have visible focus styles.
- Use semantic HTML elements (`<button>`, `<nav>`, `<main>`, `<article>`, etc.).
- Provide `aria-label` or visible text for icon-only controls.
- Verify your changes in both light and dark modes (use the theme toggle in the top bar).

## Testing

A test runner is being introduced — see the Vitest setup issue for progress. Once merged, tests will run via:

```bash
npm run test
```

Until then, manually verify the affected routes load and behave correctly after your changes.
