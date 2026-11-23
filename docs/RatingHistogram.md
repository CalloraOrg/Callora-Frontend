# RatingHistogram

Tooltip that reveals a 5-star rating distribution when the user hovers, focuses, or long-presses a rating display. Used by the marketplace `ApiCard` next to the inline rating (e.g. `4.6 ★`).

## Usage

```tsx
import RatingHistogram from "../components/RatingHistogram";

<RatingHistogram
  rating={api.rating}
  distribution={api.ratingDistribution}
  placement="top-end"
>
  ⭐ {api.rating}
</RatingHistogram>;
```

The child node is the always-visible trigger content. The tooltip is rendered on top of it when the trigger is hovered, focused, or long-pressed.

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `rating` | `number` | — | Average rating (0–5). Shown prominently in the tooltip header. |
| `distribution` | `Record<number, number>` | — | Per-star review counts keyed by star value (1–5). When omitted or when all counts sum to zero, the tooltip shows "No rating breakdown yet" instead of bars. |
| `children` | `ReactNode` | — | The trigger content (typically the inline rating string). |
| `placement` | `"top" \| "top-start" \| "top-end"` | `"top"` | How the tooltip anchors relative to the trigger. `top-end` is recommended when the trigger sits near the right edge of a container (as it does in `ApiCard`) so the 240px-wide popover does not overflow. |

## Interactions

| Input | Behavior |
| --- | --- |
| Mouse hover | Shows on `mouseenter`. Hides ~120ms after the pointer leaves both the trigger and the tooltip (the grace period satisfies WCAG 1.4.13 "Hoverable" — users can move the pointer onto the tooltip without it disappearing). |
| Keyboard focus | Shows on `focus`, hides on `blur`. The trigger is included in tab order (`tabIndex={0}`). |
| Touch long-press | Holding the trigger for ≥400ms reveals the tooltip; releasing hides it. A short tap does not reveal the tooltip. |
| `Escape` | Dismisses the tooltip while it is visible. |
| Click on trigger | Does not propagate, so clicking the rating inside a clickable card (e.g. `ApiCard`) does not navigate. |

## Accessibility

- WCAG 2.1 AA SC 1.4.13 (Content on Hover or Focus):
  - **Dismissible** via Escape.
  - **Hoverable** — the close timer is cancelled when the pointer enters the tooltip, so users with motor impairments can move onto it.
  - **Persistent** until pointer/focus leaves or the user dismisses.
- The trigger exposes an `aria-label` of the form `"Rating 4.6 out of 5, 124 reviews"` when a distribution is supplied, or `"Rating 4.6 out of 5"` when no breakdown is available, so screen-reader users always hear the rating context.
- While the tooltip is visible, the trigger sets `aria-describedby` to the tooltip's `id`, and the tooltip itself uses `role="tooltip"`.
- Each histogram row has an `aria-label` like `"5 stars: 85 reviews"`.

## Design tokens

All colors come from the existing design-token set (`--surface`, `--text`, `--muted`, `--accent`, `--surface-soft`, `--shadow`, `--transition-speed`). The component therefore renders correctly under both `[data-theme="dark"]` and `[data-theme="light"]` without additional work.

## Responsive behavior

The tooltip is 240px wide with `max-width: calc(100vw - 32px)` so it never overflows the viewport on small screens. When placed near a container edge in `ApiCard`, `placement="top-end"` keeps it anchored within the card.

## Edge cases

- All-zero distribution: tooltip shows "No rating breakdown yet" (no bars, no review count).
- Missing `distribution`: same as all-zero — tooltip shows "No rating breakdown yet". No synthetic data is ever generated.
- `rating = 0` or `NaN`: the accessible label prints `"0.0"` rather than `"NaN"`. The tooltip still opens normally.
- Mounted inside a clickable ancestor: trigger `onClick` stops propagation; Enter/Space on the trigger also stop propagation.
