# CodeExample — Mobile Responsive Layout (Issue #724)

## Summary

**Issue #724 — Polish CodeExample layout for narrow (mobile) viewports ≤375 px**  
*GrantFox FWC26 campaign — Callora Frontend*

This document describes the changes made to the `CodeExample` component to ensure
a polished, accessible layout on narrow mobile viewports (≤375 px).

---

## What changed

### `src/components/CodeExample.tsx`

All **inline layout styles** were removed from the component. Previously, inline
styles on the tab strip, individual tab buttons, the copy button, and the code
panel competed with CSS `@media` rules — CSS cannot override an inline `style`
attribute regardless of specificity. The fix moves every layout concern exclusively
into `src/styles/code.css`.

Key changes:

| Element | Before | After |
|---|---|---|
| `.code-sample__header` | No inline style | No inline style (unchanged) |
| `.code-sample__tabs` | `style={{ display: "flex", … flex: "1 1 auto", … }}` | **No inline style** |
| `code-sample__tab` (each button) | `style={{ flexShrink: 0, minHeight: "36px", … }}` | **No inline style** |
| `.code-sample__copy` (button) | `style={{ flexShrink: 0, minHeight: "36px", … }}` | **No inline style** |
| `.code-sample__panel` | `style={{ overflowX: "auto", … }}` | **No inline style** |
| Copy "Copied" inner span | Unnamed `<span>` with inline style | `<span className="code-sample__copy-inner">` |

### `src/styles/code.css`

The CSS was substantially expanded and re-documented. The `@media (max-width: 375px)`
rule now takes full effect because no inline styles are present to override it.

Responsive tiers:

| Viewport | Behaviour |
|---|---|
| ≥ 481 px | Default horizontal header. Tabs scroll horizontally. Copy button at right. |
| 376–480 px | Same layout; tab and copy button `min-height` increased to 40 px. |
| ≤ 375 px | Header stacks to a column. Tab rail is full-width with a fade hint. Copy button is right-aligned with 44 × 44 px tap target (WCAG 2.5.5). Code panel uses `overflow-x: auto` and `pre-wrap`. |

Notable CSS additions:

- `.code-sample__panel { overflow-x: auto; -webkit-overflow-scrolling: touch; }` — long
  code lines scroll inside the panel without causing the page to overflow.
- `.code-sample__copy-inner` — aligns the check icon and "Copied" text on the same baseline.
- Right-edge fade mask on the tab strip at ≤375 px to hint at horizontal scrollability.
- `white-space: pre-wrap` and `word-break: break-word` on `code-sample__pre` at ≤375 px
  so extremely long single-line snippets wrap rather than forcing very wide horizontal scroll.

### `src/components/CodeExample.test.tsx`

Added a dedicated `'mobile layout — CSS-class contract (Issue #724)'` describe block
containing tests that verify:

1. **No inline style attributes** exist on any layout-bearing element (`header`,
   `tablist`, each `tab`, `copy`, `panel`).
2. **All required CSS classes are present** so that the CSS media-query rules can
   apply in a real browser (`code-sample__tabs`, `code-sample__tab`,
   `code-sample__copy`, `code-sample__panel`, `code-sample__pre`,
   `code-sample__copy-inner`).
3. **All tabs remain interactive** at any viewport width.
4. **Copy button is accessible** at any viewport width.

Also added two new `edge cases` tests:

- Single-snippet renders one tab correctly.
- Empty `snippets` object renders no tabs.
- `defaultLanguage` prop is respected when no stored preference exists.

### `.github/workflows/ci.yml`  *(new file)*

Created a GitHub Actions CI workflow with three jobs:

| Job | What it does |
|---|---|
| `build` | Runs `npm run build` (`tsc -b && vite build`) — type-checks and bundles. |
| `test` | Runs `npm test -- --run` (Vitest, no watch mode). |
| `coverage` | Runs `npm run test:coverage` and uploads the report as an artifact. |

The workflow triggers on every push and pull request to any branch.

---

## Accessibility

| Criterion | Status |
|---|---|
| WCAG 2.5.5 — Minimum 44 × 44 px touch target at ≤375 px | ✅ |
| WCAG 1.4.4 — Text remains readable at 200 % zoom | ✅ |
| WCAG 2.1.1 — Keyboard navigable (arrow keys, Home, End) | ✅ (unchanged) |
| WCAG 4.1.3 — Status messages via `aria-live` | ✅ (unchanged) |
| WCAG 2.4.7 — Focus visible (`:focus-visible` ring via `--accent`) | ✅ (unchanged) |
| Dark mode consistency | ✅ — all colours use design tokens |
| `prefers-reduced-motion` | ✅ — tab transition disabled |

---

## Design tokens used

All colours and radii reference existing design tokens from `src/index.css`:

- `--radius-md` — container border radius
- `--accent` — focus ring colour
- `--muted` — inactive tab label colour
- `--success` — "Copied" state colour
- `--surface-strong` — dark-theme tab active background
- `--line` — dark-theme border colour
- `--text` — dark-theme primary text

No hardcoded hex values were introduced.

---

## Testing locally

```bash
# Unit tests (one-shot)
npm test -- --run

# Watch mode during development
npm test

# Coverage report
npm run test:coverage

# Production build (TypeScript check + Vite)
npm run build
```

To verify the layout visually, open the app in a browser DevTools device emulator
set to 375 × 667 px (iPhone SE) or 360 × 800 px (Galaxy A series) and check that:

1. The header stacks vertically (tabs on top, copy button right-aligned below).
2. Long code lines scroll horizontally inside the panel without overflowing the page.
3. Tapping a tab or the copy button is comfortable (≥44 px height).
4. The keyboard focus ring is visible on tabs and the copy button.
