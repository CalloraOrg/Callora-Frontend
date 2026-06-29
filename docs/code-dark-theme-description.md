# Add code-sample dark theme variant

## Summary

This PR adds dark theme CSS variants for the CodeExample component. Code samples now respect CSS custom properties with proper light/dark theme overrides, ensuring visual parity across both modes.

## Changes

### `src/styles/code.css` (new)
- CSS custom properties for code sample styling (`--bg-subtle`, `--bg-highlight`, `--border-subtle`, `--text-main`, `--font-mono`)
- Light theme defaults for all properties
- `[data-theme="dark"]` overrides for dark mode parity
- `.code-sample__tab` styles with active state
- `.code-sample__pre` styles for code display
- `.sr-only` utility class for screen reader announcements
- Reduced motion support via `prefers-reduced-motion`

### `src/components/CodeExample.tsx`
- Refactored from inline styles to CSS classes
- Added import for `../styles/code.css`
- Replaced `preview-card` with `code-sample` wrapper class
- Uses semantic class names: `code-sample__header`, `code-sample__tabs`, `code-sample__tab`, `code-sample__tab--active`, `code-sample__panel`, `code-sample__pre`
- Removed embedded `<style>` block, now uses external CSS

### `src/components/CodeExample.test.tsx`
- Added tests for dark theme styling hooks (`.code-sample` class)
- Added tests for accessible focus styles on tabs

## CSS Custom Properties

| Property | Light Value | Dark Value |
|----------|-------------|------------|
| `--bg-subtle` | `#f9f9f9` | `rgba(255, 255, 255, 0.03)` |
| `--bg-highlight` | `#ffffff` | `var(--surface-strong)` |
| `--border-subtle` | `#e2e8f0` | `var(--line)` |
| `--text-main` | `#1a2332` | `var(--text)` |
| `--font-mono` | SFMono-Regular stack | Same |

## Accessibility (WCAG 2.1 AA)
- Focus styles use `var(--accent)` for keyboard navigation
- `prefers-reduced-motion` support for users who request reduced motion
- Screen reader announcement for copy success via `.sr-only`
- All existing ARIA attributes maintained

## Test Output

```
✓ src/components/CodeExample.test.tsx (19 tests) 2557ms
```

All tests pass including:
- Language persistence to localStorage
- Tab keyboard navigation (arrows, Home, End)
- Copy-to-clipboard functionality
- Dark theme styling hooks

closes #243

## PR Link
https://github.com/CalloraOrg/Callora-Frontend/pull/340