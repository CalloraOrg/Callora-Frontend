# ServerError Manual Test Plan

## Setup
- [ ] Render `<ServerError />` with no props
- [ ] Render `<ServerError onRetry={mockFn} />`
- [ ] Render `<ServerError requestId="REF-1234-ABCD" />`
- [ ] Render `<ServerError onRetry={mockFn} requestId="REF-1234-ABCD" />`

## Visual checks
- [ ] Heading reads "Something went wrong on our end"
- [ ] Body copy is present and calm in tone
- [ ] Illustration renders, is muted color (not red), not alarming
- [ ] No retry button visible when onRetry not passed
- [ ] Retry button visible when onRetry passed
- [ ] No reference line visible when requestId not passed
- [ ] Reference line visible with correct ID when requestId passed

## Interaction checks
- [ ] Retry button click calls onRetry
- [ ] During async onRetry, button shows "Retrying…" and is disabled
- [ ] After onRetry resolves, button re-enables
- [ ] Tapping copy icon next to requestId copies to clipboard
- [ ] "Copied!" appears and changes back to "Copy" after 2s

## Mobile checks (test at 390px viewport width)
- [ ] Layout is centered, no horizontal overflow
- [ ] All text is readable, no truncation
- [ ] Retry button touch target is at least 44×44px (currently 48px)
- [ ] Sufficient spacing — not cramped

## Accessibility checks
- [ ] Screen reader announces component on render (role="alert")
- [ ] Retry button is keyboard focusable and activatable
- [ ] Retry button receives focus on component mount when onRetry provided
- [ ] "Copied!" is announced by screen reader (aria-live)
- [ ] Illustration has aria-hidden="true"
- [ ] No color contrast failures (check with browser DevTools)
- [ ] Retry button has aria-busy="true" during loading state
- [ ] Heading is rendered as h2

## Edge cases
- [ ] Component renders correctly with custom title prop
- [ ] Component renders correctly with custom description prop
- [ ] Double-clicking retry button during loading doesn't trigger multiple calls
- [ ] Copy button works correctly on mobile devices
- [ ] Request ID with special characters displays correctly
