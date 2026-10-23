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

# Route Skeleton Manual Test Plan

## Setup
- [ ] Open `/marketplace`
- [ ] Open `/details/<api-id>` from the marketplace
- [ ] Throttle the network to slow 3G in browser DevTools

## Visual checks
- [ ] Marketplace transition keeps the filters/sidebar and grid footprint stable
- [ ] API detail transition keeps the breadcrumb, hero, tabs, and sidebar footprint stable
- [ ] No empty frame flashes during route changes
- [ ] Skeleton surfaces use neutral token colors only

## Accessibility checks
- [ ] Route shell sets `aria-busy="true"` while the destination is pending
- [ ] Reduced motion removes shimmer from skeleton surfaces

# ApiDetailPage Print Preview Manual Test Plan

## Setup
- [ ] Open `/details/weather-001` in Chrome
- [ ] Open the same page in Firefox

## Print preview checks
- [ ] Global nav, footer, deposit CTA, in-page tabs, and sidebar are hidden
- [ ] Background is white and body text is black/dark gray
- [ ] Provider and other inline links show the full URL in parentheses after the link text
- [ ] Long code snippets wrap without horizontal scrollbar or clipped content
- [ ] Endpoint cards, parameter tables, and documentation content remain visible

## Regression checks
- [ ] Screen layout is unchanged when not printing
- [ ] Interactive controls still work normally on screen after print stylesheet changes
