# ServerError Component - Review Checklist

Use this checklist to verify the implementation meets all requirements.

## 1. Code Review

### Props Interface
- [ ] All props are optional (onRetry, requestId, title, description)
- [ ] onRetry supports both sync and async functions
- [ ] requestId is string type
- [ ] title and description have sensible defaults
- [ ] No sensitive data props (error objects, stack traces, status codes)

### Component Structure
- [ ] Container has `role="alert"`
- [ ] Heading is semantic `<h2>` element
- [ ] Illustration has `aria-hidden="true"`
- [ ] Retry button has `aria-busy` attribute
- [ ] Copy confirmation uses `aria-live="polite"`

### State Management
- [ ] `isRetrying` state prevents double-tap
- [ ] `copied` state shows confirmation for 2 seconds
- [ ] useEffect cleanup for focus management
- [ ] Async error handling in retry and copy functions

### Styling
- [ ] Uses existing design tokens (--text, --muted, --surface, etc.)
- [ ] Uses existing component classes (.primary-button, .ghost-button, .helper-text)
- [ ] Max-width: 400px for mobile-first layout
- [ ] Centered with auto margins
- [ ] 48px vertical padding
- [ ] All touch targets ≥ 48×48px

## 2. Copy Review

### Default Copy
- [ ] Title: "Something went wrong on our end"
- [ ] Description: "This is not your fault. Our team has been notified..."
- [ ] Retry button: "Try again" / "Retrying…"
- [ ] Copy button: "Copy" / "Copied!"
- [ ] Request ID label: "Reference: {requestId}"

### Tone Check
- [ ] No technical jargon (500, server error, exception)
- [ ] No alarming language (crashed, broken, fatal)
- [ ] No false promises (we'll fix this right away)
- [ ] Calm and compassionate tone
- [ ] User-focused (not system-focused)

## 3. Visual Design

### Illustration
- [ ] 80×80px size
- [ ] Muted color (not red/danger)
- [ ] Abstract/non-alarming icon
- [ ] Centered above heading
- [ ] Uses SVG for scalability

### Layout
- [ ] Centered horizontally and vertically
- [ ] Max-width prevents excessive line length
- [ ] Comfortable spacing on mobile
- [ ] Text is centered
- [ ] Request ID section separated with border-top

### Colors
- [ ] No red/danger colors used
- [ ] Muted colors for secondary elements
- [ ] Meets WCAG AA contrast (4.5:1 for normal text)
- [ ] Theme-aware (works in light and dark mode)

## 4. Functionality Testing

### Retry Button
- [ ] Only renders when onRetry prop provided
- [ ] Calls onRetry when clicked
- [ ] Shows "Retrying…" during async operation
- [ ] Disabled during retry (prevents double-tap)
- [ ] Re-enables after retry completes
- [ ] Re-enables after retry fails
- [ ] Receives focus on component mount

### Request ID
- [ ] Only renders when requestId prop provided
- [ ] Displays in monospace font
- [ ] Copy button copies to clipboard
- [ ] Shows "Copied!" confirmation
- [ ] Confirmation disappears after 2 seconds
- [ ] Gracefully handles clipboard API failure

### Props Override
- [ ] Custom title displays correctly
- [ ] Custom description displays correctly
- [ ] Component works with no props
- [ ] Component works with all props

## 5. Accessibility Testing

### Screen Reader
- [ ] Component announces on render (role="alert")
- [ ] Heading is announced as heading level 2
- [ ] Retry button is announced with correct label
- [ ] "Retrying…" state is announced
- [ ] "Copied!" confirmation is announced
- [ ] Illustration is not announced (aria-hidden)

### Keyboard Navigation
- [ ] Retry button is focusable with Tab
- [ ] Retry button activates with Enter/Space
- [ ] Copy button is focusable with Tab
- [ ] Copy button activates with Enter/Space
- [ ] Focus visible indicator shows on all interactive elements
- [ ] Focus moves to retry button on mount (if onRetry provided)

### Touch Targets
- [ ] Retry button ≥ 48×48px
- [ ] Copy button ≥ 32×32px (acceptable for secondary action)
- [ ] Adequate spacing between interactive elements

### Color Contrast
- [ ] Heading text meets 4.5:1 ratio
- [ ] Body text meets 4.5:1 ratio
- [ ] Button text meets 4.5:1 ratio
- [ ] Request ID text meets 4.5:1 ratio
- [ ] Focus indicators meet 3:1 ratio

## 6. Mobile Testing (390px viewport)

### Layout
- [ ] No horizontal overflow
- [ ] All text is readable
- [ ] No truncation of important content
- [ ] Comfortable spacing (not cramped)
- [ ] Centered layout works correctly

### Interaction
- [ ] Retry button is tappable
- [ ] Copy button is tappable
- [ ] No accidental taps on adjacent elements
- [ ] Loading state is visible during retry
- [ ] Copy confirmation is visible

## 7. Security & Privacy

### No Sensitive Information
- [ ] No error codes exposed (500, 503, etc.)
- [ ] No stack traces
- [ ] No internal error messages
- [ ] No API endpoints or URLs
- [ ] No session IDs or tokens
- [ ] Request ID is user-safe (not internal trace ID)

### Safe Defaults
- [ ] Component renders safely with no props
- [ ] No console errors or warnings
- [ ] Graceful handling of missing clipboard API
- [ ] Graceful handling of async errors

## 8. Documentation

### Code Documentation
- [ ] Props interface has JSDoc comments
- [ ] Complex logic has inline comments
- [ ] TypeScript types are accurate

### External Documentation
- [ ] MANUAL_TEST_PLAN.md exists and is complete
- [ ] ServerErrorDemo.tsx exists for testing
- [ ] Screenshot instructions exist
- [ ] Migration guide exists
- [ ] Implementation summary exists

## 9. Build & Validation

### TypeScript
- [ ] No TypeScript errors in ServerError.tsx
- [ ] Component compiles successfully
- [ ] Types are exported correctly

### Build
- [ ] `npm run build` completes successfully
- [ ] No build warnings related to ServerError
- [ ] Bundle size is reasonable

### Dependencies
- [ ] No new dependencies added
- [ ] Uses only React built-ins
- [ ] Compatible with existing React version

## 10. Screenshots

### Desktop (1280px)
- [ ] before-desktop.png captured
- [ ] after-desktop-no-props.png captured
- [ ] after-desktop-with-retry.png captured
- [ ] after-desktop-with-requestid.png captured
- [ ] after-desktop-retrying.png captured

### Mobile (390px)
- [ ] before-mobile.png captured
- [ ] after-mobile-full.png captured
- [ ] after-mobile-retrying.png captured

### Quality
- [ ] Screenshots are clear and readable
- [ ] Consistent theme across screenshots
- [ ] Full component visible in frame
- [ ] Proper viewport dimensions

## 11. Edge Cases

### Props Validation
- [ ] Empty string requestId doesn't render section
- [ ] Undefined onRetry doesn't render button
- [ ] Null values handled gracefully
- [ ] Very long requestId doesn't break layout
- [ ] Very long custom title/description wraps correctly

### Async Behavior
- [ ] Multiple rapid clicks don't trigger multiple retries
- [ ] Component unmount during retry doesn't cause errors
- [ ] Retry failure doesn't leave component in broken state
- [ ] Copy during retry doesn't interfere

### Browser Compatibility
- [ ] Works in Chrome/Edge
- [ ] Works in Firefox
- [ ] Works in Safari
- [ ] Clipboard API fallback for older browsers

## 12. Performance

### Rendering
- [ ] No unnecessary re-renders
- [ ] Minimal inline styles (only for critical layout)
- [ ] No layout thrashing
- [ ] Smooth transitions

### Memory
- [ ] No memory leaks from timers
- [ ] useEffect cleanup functions present
- [ ] No retained references after unmount

## Sign-off

### Developer
- [ ] All code review items checked
- [ ] All functionality tested locally
- [ ] Documentation is complete
- [ ] Ready for peer review

**Developer:** _________________ **Date:** _________

### Reviewer
- [ ] Code review completed
- [ ] Visual design approved
- [ ] Accessibility verified
- [ ] Documentation reviewed
- [ ] Ready for merge

**Reviewer:** _________________ **Date:** _________

### QA (if applicable)
- [ ] Manual test plan executed
- [ ] All scenarios tested
- [ ] Screenshots captured
- [ ] No regressions found
- [ ] Ready for production

**QA:** _________________ **Date:** _________

## Notes

Use this section for any additional comments, concerns, or observations:

---

---

---
