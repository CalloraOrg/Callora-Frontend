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
5. [ ] Run `npm test -- --run` to validate that all tests pass.

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

### Testing

The project uses Vitest, jsdom, and Testing Library. 

*   **Naming and Location:** Test files must be named `*.test.tsx` or `*.test.ts`. Place them either immediately next to the source file they are testing or within a dedicated `tests/` directory.
*   **Test Setup (`src/setupTests.ts`):** This file is responsible for the global test environment configuration. This includes importing `jest-dom` matchers, running global cleanup between tests, and configuring mock environments.
*   **Fake Timers:** If your components or utilities rely on time-based operations (like `setTimeout`, `setInterval`, or `Date`), you must use Vitest's fake timers (`vi.useFakeTimers()`) to prevent flakiness and ensure fast execution.
*   **Pre-PR Validation:** You are required to run the full test suite locally before opening a pull request. Execute the following command:

    ```bash
    npm test -- --run
    ```
