# BottomSheet — Visible Drag Handle (GrantFox FWC26)

Generic, reusable bottom-sheet dialog component with a prominent visible drag
handle. Replaces ad-hoc modal patterns across the app with a consistent,
accessible, and design-token-driven primitive.

---

## Visible change

A pill-shaped drag handle is always rendered at the very top of the sheet. It
is visible in all states (half-snap and full-snap) so users can immediately
understand that the panel is draggable without needing a tutorial or discovery
gesture.

```
┌────────────────────────────────────────┐
│               ▬▬▬▬▬                   │  ← handle pill (always visible)
├────────────────────────────────────────┤
│ Sheet title                     ✕      │
├────────────────────────────────────────┤
│                                        │
│         …sheet body content…           │
│                                        │
├────────────────────────────────────────┤
│         [optional footer CTA]          │
└────────────────────────────────────────┘
```

On hover and during active drag the pill widens (44 px → 52 px) and brightens
(`--line-strong` → `--muted`) to reinforce the affordance. Both transitions
are gated behind `prefers-reduced-motion`.

---

## Component API

```tsx
import BottomSheet from "@/components/BottomSheet";
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | — | Controls visibility. |
| `onClose` | `() => void` | — | Called when the sheet should close. |
| `title` | `string` | — | Sheet heading. Used as the accessible dialog name. |
| `children` | `React.ReactNode` | — | Scrollable body content. |
| `footer` | `React.ReactNode` | `undefined` | Sticky footer slot (e.g. a primary CTA). Omit when not needed. |
| `triggerRef` | `React.RefObject<HTMLElement \| null>` | `undefined` | Ref to the trigger element; focus returns here on close (WCAG 2.4.3). |
| `defaultSnap` | `"half" \| "full"` | `"half"` | Initial snap point each time the sheet opens. |
| `className` | `string` | `undefined` | Extra CSS classes on the sheet panel. |
| `data-testid` | `string` | `"bottom-sheet"` | Test ID on the sheet panel. |

---

## Usage example

```tsx
import { useRef, useState } from "react";
import BottomSheet from "@/components/BottomSheet";

function MyPage() {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button ref={triggerRef} onClick={() => setOpen(true)}>
        Open settings
      </button>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Settings"
        triggerRef={triggerRef}
        footer={
          <button
            className="primary-button"
            style={{ width: "100%" }}
            onClick={() => setOpen(false)}
          >
            Save
          </button>
        }
      >
        <p>Your settings content goes here.</p>
      </BottomSheet>
    </>
  );
}
```

---

## Drag-to-snap behaviour

| Gesture | From `half` | From `full` |
|---------|-------------|-------------|
| Drag **down** > 60 px | Dismisses (calls `onClose`) | Snaps to `half` |
| Drag **up**   > 60 px | Snaps to `full` | No change |
| Drag within ±60 px | No change | No change |

The sheet uses **pointer events** (`onPointerDown` / `onPointerUp`) so it
works with mouse, touch, and stylus inputs. Pointer capture ensures the drag
remains responsive even if the cursor leaves the handle area mid-gesture.

---

## Accessibility

- `role="dialog"` + `aria-modal="true"` on the sheet panel.
- `aria-labelledby` wired to the rendered `<h2>` title element via `useId()`.
- **Focus trap**: Tab and Shift-Tab cycle only inside the open sheet.
- **Initial focus**: First focusable element inside the sheet receives focus on open.
- **Focus restore**: `triggerRef.current.focus()` called when the sheet closes.
- **Body scroll lock**: `document.body.style.overflow = "hidden"` while open, restored on close.
- **Escape key**: Closes the sheet and fires `onClose`.
- **Backdrop click**: Closes the sheet.
- **Handle area**: Marked `aria-hidden="true"` — it is a pointer-only affordance. Keyboard users use the close button (✕) or Escape to dismiss.
- **Close button**: `aria-label="Close {title}"` for screen-reader clarity.
- Touch target for the handle area is ≥ 44 × 44 px (WCAG 2.5.5 Target Size).

---

## Responsive behaviour

The sheet stretches edge-to-edge on mobile (`left: 0; right: 0`) and is
capped at `92 vh` in the full-snap state so the page behind remains
partially visible. No breakpoint-specific overrides are needed; the component
is designed for mobile-first layouts and degrades gracefully on larger screens
when used alongside a modal or drawer pattern.

---

## Theming

All colours and shadows use CSS custom properties from the design token system,
so both dark and light themes work automatically:

| Token | Usage |
|-------|-------|
| `--surface-strong` | Sheet background and footer background |
| `--line-strong` | Top border + handle pill default colour |
| `--muted` | Handle pill colour on hover/drag |
| `--line` | Header border-bottom and footer border-top |
| `--text` | Title text colour |
| `--backdrop` | Backdrop overlay colour (index.css) |

---

## prefers-reduced-motion

Spring transitions (height snapping, pill resize) are disabled via both:

1. `@media (prefers-reduced-motion: reduce)` in `index.css`
2. `style.transition = "none"` applied inline when the media query matches

This belt-and-suspenders approach ensures instant transitions regardless of
browser support for the CSS query.

---

## CSS hooks (for integrators)

The following class names are available for theme overrides:

| Class | Element |
|-------|---------|
| `.bottom-sheet` | Outer sheet panel |
| `.bottom-sheet--half` | Applied when snap = half |
| `.bottom-sheet--full` | Applied when snap = full |
| `.bottom-sheet__handle-area` | Drag-target strip at the top |
| `.bottom-sheet__handle` | Visible pill element |
| `.bottom-sheet__header` | Title + close-button row |
| `.bottom-sheet__title` | `<h2>` heading |
| `.bottom-sheet__close` | ✕ close button |
| `.bottom-sheet__body` | Scrollable body wrapper |
| `.bottom-sheet__footer` | Sticky footer wrapper |
| `.bottom-sheet__backdrop` | Dimmed overlay behind the sheet |

---

## Relationship to `FiltersBottomSheet`

`FiltersBottomSheet` is a purpose-built wrapper that embeds `FiltersSidebar`
content. It follows the same drag/snap pattern but is not generic. If
`FiltersBottomSheet` is refactored in a future PR it should delegate to
`BottomSheet` as its layout primitive.

---

## Testing notes

**33 unit tests** in `src/components/BottomSheet.test.tsx` cover:

- Closed / open render states
- Visible handle area and pill presence + class names
- `aria-hidden` on the handle area
- Snap point class + height for both `"half"` and `"full"`
- All close interactions: backdrop, ESC, close button
- Accessible `close` button label derived from `title`
- `aria-labelledby` wired to the title element
- Body overflow lock and unlock
- `triggerRef` focus restore
- Safe no-op when `triggerRef` is absent
- `prefers-reduced-motion` inline transition override
- `className` and `data-testid` forwarding
- Footer rendered/absent conditionally
- Snap resets on re-open

> **Note on drag tests**: jsdom does not implement `PointerEvent` with `clientY`
> initialisation, so drag-to-snap logic cannot be reliably tested in a unit
> environment. This follows the same pattern as `FiltersBottomSheet.test.tsx`.
> Drag behavior is verified manually in a browser. Add E2E tests (e.g.
> Playwright) to cover the drag contract in a real DOM.
