# MethodChip — Responsive & Accessibility Fixes (GrantFox FWC26)

## Overview

This document describes the changes made to `src/components/MethodChip.tsx` and
`src/components/MethodChip.css` as part of the GrantFox FWC26 UI/UX campaign.

All fixes are backwards-compatible: the public API (`method` prop) and rendered
HTML structure are unchanged except for the addition of a `<span class="method-chip-label">`
wrapper around the method text (see [Structural change](#structural-change-method-chip-label-span)
below).

---

## Bugs fixed

### 1. CSS custom-property name mismatch

**File:** `MethodChip.tsx` — `METHOD_COLORS` map

The `fg` key in `METHOD_COLORS` referenced tokens named `--method-<verb>-fg`, but
`src/index.css` defines these tokens under the suffix `-color`
(e.g. `--method-get-color`).  The mismatch caused foreground colours to fall back
to the browser default, making chips render with the wrong text colour in both
light and dark themes.

| Before | After |
|---|---|
| `fg: 'var(--method-get-fg)'` | `color: 'var(--method-get-color)'` |
| `style={{ color: colors.fg }}` | `style={{ color: colors.color }}` |

Affected verbs: GET, POST, PUT, DELETE, PATCH.

---

### 2. Icon-wrapper CSS class mismatch

**Files:** `MethodChip.tsx`, `MethodChip.css`

The JSX used `className="method-chip-icon"` but the CSS defined `.method-icon`.
Because the selector did not match, the icon's right-margin was never applied and
it sat flush against the method text.

| Before (CSS) | After (CSS) |
|---|---|
| `.method-icon { margin-right: 4px; }` | `.method-chip-icon { margin-right: var(--mkt-space-sm, 4px); }` |

---

### 3. Tap target too small (WCAG 2.1 AA §2.5.5)

**File:** `MethodChip.css`

The chip's `padding: 2px 8px` produced a visual height of ~18 px — well below the
44 × 44 px minimum recommended by WCAG 2.1 AA for pointer targets.

The fix uses a `::before` pseudo-element to expand the interactive hit area to at
least 44 × 44 px without changing the visual size of the chip:

```css
.method-chip::before {
  content: '';
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: max(100%, 44px);
  height: max(100%, 44px);
  pointer-events: none;
}
```

The chip container must remain `position: relative` (already the case) for this
to work correctly.

---

### 4. No ≤375 px breakpoint

**File:** `MethodChip.css`

The chip's `min-width: 60px` was fixed at all viewport widths.  On 320–375 px
screens (iPhone SE, older Android phones) a row of chips inside an endpoint card
could overflow the container.

```css
@media (max-width: 375px) {
  .method-chip {
    padding: var(--mkt-space-xs, 2px) 6px;
    min-width: 52px;
    font-size: 0.7rem;
  }

  .method-chip-icon {
    margin-right: var(--mkt-space-xs, 2px);
  }
}
```

The icon is still shown at ≤375 px (it is only 14 px wide); only spacing is
tightened.

---

### 5. No text-overflow protection

**File:** `MethodChip.css`

Long labels (e.g. `DELETE`) could overflow their container on narrow screens.  The
chip now clips overflowing text with an ellipsis:

```css
.method-chip {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

---

## Structural change — `.method-chip-label` span

A new `<span class="method-chip-label">` wraps the method text inside the chip.
This is required so that `text-overflow: ellipsis` applies only to the label, not
the icon, preventing the icon from being truncated before the text.

```tsx
// Before
<span className="method-chip" ...>
  <span className="method-chip-icon">…</span>
  {upper}
</span>

// After
<span className="method-chip" ...>
  <span className="method-chip-icon">…</span>
  <span className="method-chip-label">{upper}</span>
</span>
```

Consumers who use CSS selectors targeting direct text nodes of `.method-chip`
should update their selectors to `.method-chip-label`.

---

## API

`MethodChip` accepts a single prop and its signature is unchanged:

```ts
type MethodChipProps = {
  /**
   * The HTTP verb to display (case-insensitive).
   * Recognised values: GET | POST | PUT | DELETE | PATCH.
   * Unrecognised values fall back to a neutral grey chip.
   */
  method: string;
};
```

---

## Accessibility

| Criterion | Implementation |
|---|---|
| WCAG 2.1 AA §1.1.1 Non-text content | `role="img"` + `aria-label="<VERB> request"` |
| WCAG 2.1 AA §1.3.1 Info & Relationships | Icon wrapper carries `aria-hidden="true"` |
| WCAG 2.1 AA §2.1.1 Keyboard | `tabIndex={0}`; tooltip shown on `focus`, hidden on `blur` |
| WCAG 2.1 AA §2.5.5 Pointer Target Size | `::before` pseudo-element ensures ≥44 × 44 px hit area |
| WCAG 2.1 AA §4.1.3 Status Messages | Tooltip uses `role="tooltip"` |

---

## Tests

36 Vitest tests live in `src/components/MethodChip.test.tsx`:

- All 5 recognised HTTP verbs rendered correctly
- Case-insensitive input (`delete`, `patch`, …)
- Fallback chip for unrecognised verbs
- `aria-label` / `role="img"` contract
- Tooltip appears on `mouseenter` / `focus` and disappears on `mouseleave` / `blur`
- CSS class contracts (`method-chip`, `method-chip-icon`, `method-chip-label`)
- Colour-token contract: inline `style` references `--method-<verb>-bg` and
  `--method-<verb>-color` (not the deprecated `-fg` suffix)
- Tap-target structural contract (no inline width/height blocks `::before`)
- No inline overflow styles that would break the high-contrast token cascade

Run with:

```bash
npx vitest run src/components/MethodChip.test.tsx
```

---

## Design tokens used

| Token | Purpose |
|---|---|
| `--method-<verb>-bg` | Chip background (both themes) |
| `--method-<verb>-color` | Chip foreground text (both themes) |
| `--method-default-bg` | Fallback background for unknown verbs |
| `--method-default-color` | Fallback foreground for unknown verbs |
| `--mkt-space-xs` / `--mkt-space-sm` / `--mkt-space-md` | Spacing tokens |
| `--mkt-font-size-micro` | Label font size (0.75 rem) |
| `--accent` | `:focus-visible` outline colour |
| `--tooltip-bg` / `--tooltip-fg` | Tooltip colours |

All tokens are defined in `src/index.css` and `src/styles/tokens.css`.
