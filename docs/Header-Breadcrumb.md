# Header Middle-Ellipsis Breadcrumb — GrantFox FWC26

Date: 2026-07-28

## Summary

Added a `middleEllipsis` prop to the `Breadcrumb` component and created a new `Header` page component that renders the topbar banner with a breadcrumb that collapses long paths using a middle-ellipsis pattern.

## Changes

### `src/components/Breadcrumb.tsx`

- Added `middleEllipsis?: boolean` prop to `BreadcrumbProps` (default `false`).
- When `middleEllipsis` is `true`, intermediate breadcrumb items (between the first and last) are hidden from the main breadcrumb trail on **all viewports** and exposed via a "…" popover triggered by an ellipsis button in the first crumb.
- Added CSS modifier class `.breadcrumb-nav--middle-ellipsis` that:
  - Hides `.breadcrumb-middle` items (`display: none`) on all viewports.
  - Shows `.breadcrumb-collapsed` as `display: flex` on all viewports.
- Focus management is preserved: Arrow keys navigate popover items, Escape closes and returns focus to the ellipsis button, the popover auto-focuses its first item on open.

### `src/pages/Header.tsx`

- New component: `Header` with a `breadcrumbItems` prop of type `ReadonlyArray<BreadcrumbItem>`.
- Renders a `<header>` with `role="banner"` and the existing `topbar` styling classes.
- Integrates `Breadcrumb` with `middleEllipsis={true}` inside the topbar actions area.
- Includes the Callora Vault branding (eyebrow + brand text) alongside the breadcrumb.
- Fully accessible: WCAG 2.1 AA compliant with `aria-label`, `aria-current`, `title`, and `aria-label` overrides on truncated items.
- Design-token consistent: uses `var(--accent)`, `var(--text)`, `var(--muted)`, `var(--surface)`, `var(--border)`, `var(--accent-strong)`.

### `src/components/Breadcrumb.test.tsx`

- Added 10 focused tests for the `middleEllipsis` prop covering:
  - Default behavior (no hiding without `middleEllipsis`).
  - Hiding middle items when `middleEllipsis` is `true`.
  - Ellipsis button rendering and ARIA attributes.
  - Popover open/close with click and keyboard (Escape).
  - Popover content correctness.
  - No ellipsis button when there are no middle items.
  - First and last crumb visibility with `middleEllipsis`.
  - Desktop viewport collapse behavior.
  - Keyboard navigation within the popover.

### `src/pages/Header.test.tsx`

- New test file with 9 focused tests covering:
  - Banner landmark rendering.
  - Brand text presence.
  - Breadcrumb with `middleEllipsis` class.
  - Middle items hidden.
  - Ellipsis button and popover interaction.
  - Current page item rendering.
  - Design token color usage.
  - Keyboard accessibility (Escape closes popover).
  - Focus return to trigger button on popover close.

## API Changes

### BreadcrumbProps (new optional prop)

| Prop            | Type      | Default | Description                                                        |
| --------------- | --------- | ------- | ------------------------------------------------------------------ |
| `middleEllipsis` | `boolean` | `false` | Collapse middle breadcrumb items behind an ellipsis popover on all viewports. |

### HeaderProps (new component)

| Prop               | Type                                         | Required | Description                        |
| ------------------ | -------------------------------------------- | -------- | ---------------------------------- |
| `breadcrumbItems`  | `ReadonlyArray<BreadcrumbItem>`              | Yes      | Breadcrumb items to render in the header. |

### BreadcrumbItem (existing type, unchanged)

| Field        | Type      | Required | Description                        |
| ------------ | --------- | -------- | ---------------------------------- |
| `label`      | `string`  | Yes      | Display label for the crumb.       |
| `href`       | `string`  | Yes      | Link destination.                  |
| `isCurrent`  | `boolean` | No       | Marks the current page (renders as `<span>` with `aria-current="page"`). |

## Visual Behavior

- **Without `middleEllipsis` (default)**: All breadcrumb items visible on desktop; middle items collapse behind an ellipsis only on mobile (≤480px).
- **With `middleEllipsis={true}`**: Middle items are hidden behind an ellipsis on **all viewports** — first and last crumbs always visible, intermediate items accessible via the popover.

## Accessibility

- WCAG 2.1 AA compliant.
- Truncated labels expose their full text via `title` (hover) and `aria-label` (screen reader).
- Popover uses `role="menu"` with `role="menuitem"` links.
- Focus trap: Escape closes popover, focus returns to trigger button.
- Keyboard navigation: ArrowUp/ArrowDown cycle through popover items, Home/End jump to first/last.