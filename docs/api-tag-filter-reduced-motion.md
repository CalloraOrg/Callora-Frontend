# ApiTagFilter Reduced-Motion Fallback

## Issue
[b#024] / #701 — Add reduced-motion fallback for ApiTagFilter animations

## Description
This change adds `prefers-reduced-motion` fallback support for the `ApiTagFilter` component to ensure users who prefer reduced motion experience a static UI without transitions or motion hints.

## Changes Made

### CSS Changes (`src/index.css`)
Enhanced the existing `@media (prefers-reduced-motion: reduce)` block for the ApiTagFilter component:

```css
@media (prefers-reduced-motion: reduce) {
  .api-tag-filter__pill {
    transition: none;
  }

  .api-tag-filter__pill--active {
    border-width: 2px;
  }

  .api-tag-filter {
    -webkit-mask-image: none;
    mask-image: none;
  }

  .api-tag-filter__pill-skeleton {
    animation: none !important;
    background: var(--surface-soft);
  }
}
```

What each rule does:
- `.api-tag-filter__pill { transition: none; }` — Disables the 240ms background/border/color transition on pill hover, focus, and active state changes. The state change is instant and static.
- `.api-tag-filter__pill--active { border-width: 2px; }` — Reinforces the active pill border so the selected state remains visually obvious even without the smooth color transition.
- `.api-tag-filter { -webkit-mask-image: none; mask-image: none; }` — Removes the right-edge fade mask on narrow viewports. The mask implies "more content to scroll" which is a motion-related affordance; without smooth scrolling it can be disorienting.
- `.api-tag-filter__pill-skeleton { animation: none !important; background: var(--surface-soft); }` — Ensures skeleton loading pills render as static blocks instead of shimmering, matching the global `.skeleton` reduced-motion behavior.

### Test Changes
Added focused tests in `src/pages/ApiTagFilter.test.tsx` to verify:
- Pill CSS classes are present and targeted by reduced-motion rules
- Active modifier class is present for the border-width reinforcement
- Skeleton pills use the correct BEM class for static fallback
- No inline transition styles are set (motion is CSS-controlled)

## API/Visible Changes

### User-Visible Changes
Users with `prefers-reduced-motion: reduce` enabled will see:
- Instant pill state changes (no 240ms color transition)
- Thicker active-pill border for clear selection visibility
- No scroll fade mask on narrow viewports
- Static skeleton loaders (no shimmer animation)

Users without reduced-motion preference will see no change in behavior.

### API Changes
- No API changes
- No breaking changes
- No new props or component interfaces

## Accessibility Impact
This change improves accessibility for users with vestibular disorders or motion sensitivity by providing a completely static fallback when the OS-level reduced-motion preference is enabled. This follows WCAG 2.1 guidelines for avoiding motion that can cause discomfort or nausea.

The active state remains clearly distinguishable via:
- A 2px solid accent border (instead of 1px)
- The accent background tint (instant, not animated)
- The `aria-pressed="true"` state for screen readers

## Testing
Added test cases to verify:
- Pill and active modifier CSS classes are present
- Skeleton pills use the correct class for reduced-motion targeting
- No inline styles override the CSS motion control

Run tests with:
```bash
npm test -- src/pages/ApiTagFilter.test.tsx
```

## Browser Support
Uses standard CSS `@media (prefers-reduced-motion: reduce)` query, supported by all modern browsers:
- Chrome 74+
- Firefox 63+
- Safari 10.1+
- Edge 79+

## Related
- Follows the same pattern as `docs/api-usage-reduced-motion-fallback.md` (b#004)
- Uses the same design tokens (`--surface-soft`, `--accent`, `--transition-speed`)