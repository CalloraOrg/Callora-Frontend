# SubscribeCTA — Icon-Only Action Buttons with Tooltip Wiring

**Campaign:** GrantFox FWC26  
**Issue scope:** `src/pages/SubscribeCTA.tsx`, `src/components/Tooltip.tsx`

---

## Overview

The `SubscribeCTA` sticky bar now includes two icon-only action buttons — **Share** and **Bookmark** — positioned between the price group and the Subscribe button. Both buttons are wired to the shared `Tooltip` primitive with configurable hover-delay and long-press behaviour so users always have an accessible label, regardless of input modality.

---

## New props on `SubscribeCTA`

| Prop | Type | Default | Description |
|---|---|---|---|
| `onShare` | `() => void` | – | Called when the Share button is clicked. When omitted, the current page URL is copied to the clipboard via `navigator.clipboard.writeText`. |
| `onBookmark` | `(isBookmarked: boolean) => void` | – | Called after each toggle with the **new** bookmarked state. |
| `isBookmarked` | `boolean` | `false` | Initialises the bookmark button in the saved state. |
| `tooltipHoverDelayMs` | `number` | `300` | Milliseconds to wait after `mouseenter` before the tooltip opens. Passed directly to the `Tooltip` `hoverDelayMs` prop for both buttons. |
| `tooltipLongPressMs` | `number` | `500` | Touch-contact duration before the tooltip opens on mobile. Passed to the `Tooltip` `longPressMs` prop for both buttons. |

All other existing props (`apiName`, `pricePerRequest`, `onSubscribe`, `observeElementSelector`) are unchanged.

---

## Behaviour

### Share button
- **Default action:** Calls `navigator.clipboard.writeText(window.location.href)` — copies the current URL silently. Clipboard errors are swallowed so the UI never enters an error state.
- **Custom action:** Pass `onShare` to override (e.g. open a native share sheet, fire an analytics event, or open a modal).
- **Tooltip label:** `"Share {apiName}"` — shown after `tooltipHoverDelayMs` ms on hover, immediately on keyboard focus, and after `tooltipLongPressMs` ms on touch.

### Bookmark button
- **Toggle state:** Internal `bookmarked` state is initialised from the `isBookmarked` prop. Each click flips the state and fires `onBookmark(newState)`.
- **Visual feedback:** When bookmarked, the SVG bookmark is **filled** and the button receives the `.subscribe-cta-bar__icon-btn--active` CSS class (accent-coloured background/border).
- **Tooltip label:** Dynamically reflects toggle state:
  - Unsaved: `"Save {apiName}"`
  - Saved: `"Remove {apiName} from saved"`
- **`aria-pressed`:** Always present; `"true"` when bookmarked, `"false"` when not.

---

## Accessibility (WCAG 2.1 AA)

| Criterion | How it is met |
|---|---|
| **1.1.1 Non-text content** | Every button has an explicit `aria-label`. SVG icons are `aria-hidden="true"`. |
| **1.4.1 Use of color** | Toggle state is communicated by `aria-pressed` + icon fill change, not colour alone. |
| **2.1.1 Keyboard** | Both buttons are standard `<button>` elements; fully keyboard-navigable. |
| **2.1.3 Keyboard (no exception)** | `Escape` dismisses any open tooltip (handled by `Tooltip` primitive). |
| **2.4.3 Focus order** | Buttons appear in DOM order: Share → Bookmark → Subscribe. |
| **2.5.3 Label in name** | `aria-label` is identical to the visible tooltip text. |
| **4.1.2 Name, role, value** | Share: `aria-label`. Bookmark: `aria-label` + `aria-pressed`. Both connected to tooltip via `aria-describedby` (injected by `Tooltip`). |

Tap target is `36 × 36 px` visual; the `Tooltip` wrapper is `display: inline-flex` so the touch area extends to the pointer-level padding added by surrounding layout.

---

## CSS — new classes

All styles live in the `SubscribeCTA` block of `src/index.css`.

| Class | Purpose |
|---|---|
| `.subscribe-cta-bar__icon-actions` | Flex row grouping Share + Bookmark buttons. |
| `.subscribe-cta-bar__icon-btn` | Base icon button: 36 × 36 px, transparent bg, `var(--muted)` colour. |
| `.subscribe-cta-bar__icon-btn:hover` | Reveals subtle surface tint + border using `var(--surface-soft)` and `var(--line)`. |
| `.subscribe-cta-bar__icon-btn--active` | Bookmark saved state: accent colour + `rgba(78,133,255,0.1)` bg in dark mode. |
| `.subscribe-cta-bar__icon-btn:focus-visible` | 2 px `var(--accent)` outline, 3 px offset. Mirrors global `focus.css` pattern. |

Light-mode counterparts are scoped under `[data-theme="light"]`.

---

## Usage example

```tsx
<SubscribeCTA
  apiName="WeatherSim API"
  pricePerRequest={0.01}
  onSubscribe={handleSubscribe}
  onShare={() => navigator.share({ url: window.location.href })}
  onBookmark={(saved) => dispatch(saved ? pinApi(id) : unpinApi(id))}
  isBookmarked={pinnedApis.includes(apiId)}
  tooltipHoverDelayMs={300}
  tooltipLongPressMs={500}
/>
```

---

## Test coverage

`src/pages/SubscribeCTA.test.tsx` — **28 tests**, all passing.

New tests cover:
- Rendering with default and bookmarked state
- `aria-label`, `aria-pressed`, `role="group"` for the actions container
- Hover delay: tooltip absent before delay, present after
- Early mouse-leave cancels the hover timer
- Keyboard focus shows tooltip immediately; blur hides it
- Escape dismisses the open tooltip
- Touch long-press opens the tooltip after `longPressMs`
- Early `touchEnd` cancels the press timer
- Custom `tooltipHoverDelayMs` forwarded correctly
- Bookmark toggle updates `aria-pressed`, label, and CSS class
- `onBookmark` callback receives the correct next state
- Tooltip label updates dynamically after bookmark toggle
- `onShare` callback vs. default clipboard fallback
- All icon SVGs have `aria-hidden="true"`
- `.subscribe-cta-bar__icon-btn--active` class applied when bookmarked
