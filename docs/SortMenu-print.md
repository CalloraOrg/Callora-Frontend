# SortMenu Print Styling Implementation

## Overview
This document describes the implementation of print styling for the SortMenu component as part of the GrantFox FWC26 campaign (issue #580). The implementation follows the same pattern established by the ReviewsTab component for consistent print behavior across the application.

## Changes Made

### 1. New Component: `src/pages/SortMenu.tsx`
- **Purpose**: Standalone component for the sort menu in the marketplace page
- **Features**:
  - Wraps sort functionality in a section with class `sort-menu`
  - Hides interactive chrome (sort dropdown) when printing via `no-print` class
  - Displays current sort state when printing
  - Follows the same print-safe pattern as ReviewsTab
- **API**:
  ```typescript
  export interface SortMenuProps {
    value: SortValue;
    onChange: (value: SortValue) => void;
  }
  ```

### 2. CSS Updates: `src/index.css`
- **Added SortMenu component styles** (lines ~287-311):
  - `.sort-menu` - Container with flex layout
  - `.sort-menu__sort-row` - Sort dropdown container
  - `.sort-menu__current-state` - Current sort state display (hidden by default)
  - `.sort-menu__label` - Label for current state
  - `.sort-menu__value` - Current sort value display

- **Added print media query rules** (lines ~6846-6872):
  - Hides `.sort-menu__sort-row` in print media
  - Injects "Sort Options" heading via `::before` pseudo-element
  - Displays `.sort-menu__current-state` in print media
  - Sets `max-height: none` to expand any collapsibles
  - Forces light theme colors for print

### 3. Documentation Updates: `src/styles/print.css`
- **Added SortMenu print rules** (lines ~58-81):
  - Mirrors the `@media print` rules from `index.css`
  - Serves as human-readable documentation
  - Not imported by `main.tsx` (documentation only)

### 4. Test Updates: `src/print.test.ts`
- **Added SortMenu print markup contract tests**:
  - Verifies proper class names (`sort-menu`, `sort-menu__sort-row`, etc.)
  - Ensures `no-print` class is applied to interactive elements
  - Checks for proper ARIA attributes

- **Added SortMenu @media print CSS tests**:
  - Verifies print CSS rules are present in `index.css`
  - Ensures rules are mirrored in `print.css` documentation
  - Tests for proper hiding of chrome and expansion of content

### 5. New Test File: `src/pages/SortMenu.test.tsx`
- **Component tests**:
  - Renders with correct class names
  - Displays current sort state properly
  - Handles all sort values (popularity, price-asc, latency-asc, newest)
  - Has proper ARIA attributes
  - Calls onChange callback

## Print Behavior

### When Printing:
1. **Hidden Elements**:
   - Sort dropdown (`.sort-menu__sort-row`)
   - All interactive controls with `no-print` class

2. **Visible Elements**:
   - Current sort state (`.sort-menu__current-state`)
   - Print-only heading ("Sort Options")
   - All content without `no-print` class

3. **Layout Changes**:
   - Single-column layout
   - Light theme forced (black on white)
   - All collapsibles expanded
   - Page-break avoidance on key elements

### Screen Behavior:
- Sort dropdown visible and interactive
- Current state display hidden (CSS `display: none`)
- Normal dark/light theme support
- Standard responsive layout

## Accessibility
- Component wrapped in `<section>` with `role="region"` and `aria-label`
- Inherits accessibility from SortDropdown component (ARIA combobox/listbox)
- Proper keyboard navigation support
- WCAG 2.1 AA compliant

## Design Tokens
- All colors reference CSS custom properties from `tokens.css`
- Dark-mode and light-mode support
- Print media forces light theme for readability

## Testing
All changes include comprehensive tests:
- Component rendering tests
- Print markup contract tests
- CSS rule verification tests
- Accessibility tests

## Files Modified
1. `src/pages/SortMenu.tsx` (new)
2. `src/pages/SortMenu.test.tsx` (new)
3. `src/index.css` (added component styles and print rules)
4. `src/styles/print.css` (added documentation rules)
5. `src/print.test.ts` (added SortMenu tests)

## Migration Notes
To use the new SortMenu component in the MarketplacePage:
```tsx
import SortMenu from "../pages/SortMenu";

// Replace existing SortDropdown usage with:
<SortMenu value={sortParam} onChange={setSortParam} />
```

This will provide consistent print behavior across the application.
