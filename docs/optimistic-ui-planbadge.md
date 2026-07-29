# Optimistic UI — PlanBadge Primary Action

## Behavior

- **Before**: Clicking "Choose a plan" navigated to `/billing`.
- **After**: Clicking "Choose a plan" immediately transitions from the empty state to the plan-selection view (loading spinner shown first, then tier picker). An optional async callback (`onChoosePlan`) runs in the background.

### Optimistic update

1. User clicks "Choose a plan".
2. UI immediately shows a loading spinner and replaces the empty state (no waiting for async).
3. When the async operation succeeds, the loading spinner is replaced by the tier-selection radiogroup.
4. If the async operation fails, the UI reverts to the exact previous empty state and an error toast is shown.

### Error handling

- On async failure: exact previous state restored, error toast shown via `useToast`.
- Non-`Error` rejections receive a safe fallback message: "Could not load plan options. Please try again."

### Duplicate-click prevention

- A `useRef` boolean (`activatingRef`) is checked synchronously before any state updates and reset in a `finally` block. This works even when React has not yet re-rendered between synchronous click events.

### Race conditions

- An `operationRef` counter ensures stale async responses from earlier activations do not overwrite newer state.

### Accessibility

- Loading state uses `role="status"` with `aria-live="polite"` and `aria-label="Loading plan options"`.
- Error feedback is delivered via toast (which uses `role="status"` and `aria-live="polite"`).
- The tier picker uses `role="radiogroup"` with a visible `<legend>`.
- A `LiveRegion` component provides screen-reader status announcements on success/failure.
- The Cancel button has an explicit `aria-label`.

## Public API

- Added `onChoosePlan?: () => Promise<void>` prop to `PlanBadgePage`.
- This prop is **optional** (backwards-compatible). When omitted, the action resolves immediately.
