# ApiUsage Reduced-Motion Fallback

## Issue
[b#004] - Add reduced-motion fallback for ApiUsage animations

## Description
This change adds `prefers-reduced-motion` fallback support for ApiUsage page animations to ensure users who prefer reduced motion experience a static UI without pulsing, spinning, or shimmering effects.

## Changes Made

### CSS Changes (`src/index.css`)
Extended the existing `@media (prefers-reduced-motion: reduce)` block for the ApiUsage page to include button spinner animation and disable hover/focus transitions on all interactive button elements:

```css
@media (prefers-reduced-motion: reduce) {
  .api-usage-page .status-dot {
    animation: none;
    opacity: 1;
  }

  .api-usage-page .skeleton {
    animation: none;
    background: var(--surface-soft);
  }

  .api-usage-page .button-spinner {
    animation: none;
    border-top-color: rgba(255, 255, 255, 0.3);
  }

  .api-usage-page .chart-bar {
    transition: none;
  }

  .api-usage-page .tab-button {
    transition: none;
  }

  .api-usage-page .danger-button {
    transition: none;
  }

  .api-usage-page .primary-button {
    transition: none;
  }

  .api-usage-page .secondary-button {
    transition: none;
  }

  .api-usage-page .ghost-button {
    transition: none;
  }
}
```

### Test Changes
Added focused tests in `src/pages/ApiUsage.test.tsx` to verify that each button element (`.tab-button`, `.danger-button`, `.primary-button`, `.secondary-button`, `.ghost-button`) has the CSS class targeted by the reduced-motion transition rules.

## API/Visible Changes

### User-Visible Changes
- **Users with `prefers-reduced-motion: reduce` enabled** will see:
  - Static status dots (no pulsing animation)
  - Static skeleton loaders (no shimmer animation)
  - Static button spinners (no rotation animation)
  - Instant chart bar transitions (no animation delay)
  - Static button hover/focus effects (no background, opacity, or transform transitions)
  - Static language tab hover/active transitions
- **Users without reduced-motion preference** will see no change in behavior

### API Changes
- No API changes
- No breaking changes
- No new props or component interfaces

## Accessibility Impact
This change improves accessibility for users with vestibular disorders or motion sensitivity by providing a static fallback when the OS-level reduced-motion preference is enabled. This follows WCAG 2.1 guidelines for avoiding motion that can cause discomfort or nausea.

## Testing
Added test cases to verify:
1. Button spinner CSS class is present and targeted by reduced-motion rules
2. Existing reduced-motion behavior for status dots, skeletons, and chart bars remains unchanged

## Browser Support
Uses standard CSS `@media (prefers-reduced-motion: reduce)` query, supported by all modern browsers:
- Chrome 74+
- Firefox 63+
- Safari 10.1+
- Edge 79+
