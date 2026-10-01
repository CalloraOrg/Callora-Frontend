# Contributing to Callora Frontend

Thanks for contributing! Follow these guidelines to keep the codebase consistent.



## Prerequisites

- Node.js 18+
- npm (comes with Node.js)

## Setup

```bash
git clone https://github.com/CalloraOrg/Callora-Frontend.git
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
3. Run `npm test -- --run` and `npm run build` to confirm tests pass and there are no TypeScript errors.
4. Open a pull request against `main` with a clear description of what changed and why.

## Pull request checklist

Before opening a pull request, confirm:

- [ ] `npm run build` passes with no TypeScript errors.
- [ ] Tests pass (`npm test -- --run`).
- [ ] Any new component added to `src/components/` has a matching entry in
      [`src/data/a11y-manifest.json`](src/data/a11y-manifest.json)
      (`{ "id", "name", "status" }`), and changed components have their `status`
      re-checked. See
      [Accessibility Audit Manifest — Upkeep Rules](docs/a11y-manifest.md).

## Design system

All UI changes must follow the [UI Design System](docs/UI-Design-System.md).

Key rules:
- **Use design tokens, not raw values.** `src/index.css` is the canonical source for app-wide design tokens; `src/styles/tokens.css` defines additional marketplace, API, and status tokens. Reference them via `var(--token-name)` — never use inline hex values or hardcoded pixel sizes.
- **Reuse existing components.** Check `src/components/` before building something new. Components like `ApiCard`, `EmptyState`, `SearchBar`, `Skeleton`, and `Breadcrumb` are shared across views.
- **Do not introduce a component library.** The project is intentionally dependency-light.

## Accessibility

- All interactive elements must be keyboard navigable and have visible focus styles.
- Use semantic HTML elements (`<button>`, `<nav>`, `<main>`, `<article>`, etc.).
- Provide `aria-label` or visible text for icon-only controls.
- Verify your changes in both light and dark modes (use the theme toggle in the top bar).

## Testing

Tests run with [Vitest](https://vitest.dev) in a `jsdom` environment. The full
command reference lives in the [README](README.md#running-tests); the essentials:

```bash
npm test                                                # watch mode
npm test -- --run                                       # single pass
npm test -- --run src/components/Pagination.test.tsx    # one file
npm test -- --run -t "clamps the page"                  # one test by name
npm run test:coverage                                   # single pass + coverage
```

Before opening a pull request:

1. Run `npm test -- --run` and make sure the suite is green.
2. Run `npm run build` to confirm there are no TypeScript errors.
3. Add or update tests for the behaviour you changed. New components should
   ship with a `src/components/<Name>.test.tsx` file; bug fixes should add a
   regression test that fails against the old code.
4. Prefer testing observable behaviour — what a user sees and does — over
   implementation details, so refactors do not require rewriting tests.

`vitest.config.ts` supplies the defaults, so test files need no setup:
`globals: true` makes `describe`/`it`/`expect` available without imports,
`src/setupTests.ts` registers the shared matchers and per-test cleanup, and CSS
imports are handled automatically.

Conventions:

- **Naming and location:** test files must be named `*.test.tsx` or `*.test.ts`
  (only these match the `include` pattern in `vitest.config.ts`). Place them
  next to the source file they test.
- **Fake timers:** if a component or utility relies on `setTimeout`,
  `setInterval`, or `Date`, use Vitest's fake timers (`vi.useFakeTimers()`)
  instead of real waits, to keep tests fast and deterministic. Restore them
  with `vi.useRealTimers()` afterwards; note that Testing Library's `waitFor`
  can hang under fake timers.

## Manual verification

For changes that automated tests cannot cover — layout, animation, theming,
or the dev-server proxy — manually verify the affected routes load and behave
correctly after your changes, in both light and dark mode.
