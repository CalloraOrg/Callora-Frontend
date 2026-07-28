# QuotaBanner & KbdHint Enhancement

This document outlines the API updates, visible UI/UX enhancements, and accessibility implementations for `QuotaBanner` and `KbdHint`, implemented for the **GrantFox FWC26 campaign (Stellar Wave)**.

## Summary of Changes

1. **Subtle Shortcut Hint Chip**:
   - `QuotaBanner` now features a primary action button ("Save Quota") equipped with an inline, subtle keyboard shortcut hint chip (`KbdHint` with `variant="chip"`).
   - Pressing `Ctrl+Enter` (or `Cmd+Enter` on macOS) triggers the primary action.

2. **`KbdHint` Component Enhancements**:
   - Accepts both `shortcut` (single object) and `shortcuts` (array of objects).
   - Added `variant` prop: `"default"` | `"chip"` | `"subtle"`.
   - Added `as` prop (`"aside"` | `"span"` | `"div"`): Defaults to `"span"` for chip/subtle variants to ensure valid inline HTML when embedded inside buttons or text nodes.

3. **Design Token & Theme Support**:
   - Utilizes CSS custom properties (`--surface-soft`, `--line`, `--muted`, `--text`) for seamless dark and light mode consistency.
   - Complies with WCAG 2.1 AA contrast requirements across all viewports.

---

## Component API Reference

### `QuotaBanner`

```tsx
import QuotaBanner from '../pages/QuotaBanner';

<QuotaBanner
  initialQuota="1000"
  primaryActionLabel="Save Quota"
  shortcutKey="Ctrl+Enter"
  onSave={(newQuota) => console.log('Saved:', newQuota)}
/>
```

#### Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `onSave` | `(quota: string) => void` | `undefined` | Callback fired when the primary action button is clicked or shortcut is pressed. |
| `initialQuota` | `string` | `""` | Initial input value for the quota field. |
| `primaryActionLabel` | `string` | `"Save Quota"` | Label text for the primary action button. |
| `shortcutKey` | `string` | `"Ctrl+Enter"` | Shortcut key combination text displayed in the hint chip. |

---

### `KbdHint`

```tsx
import KbdHint from '../components/KbdHint';

// Single chip hint inside button
<KbdHint
  shortcut={{ key: "Ctrl+Enter", description: "Save", category: "Quota" }}
  variant="chip"
  label="Primary action shortcut"
/>

// Default sidebar/aside shortcut list
<KbdHint shortcuts={CARD_SHORTCUTS} />
```

#### Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `shortcut` | `Shortcut` | `undefined` | Single shortcut item `{ key, description, category }`. |
| `shortcuts` | `readonly Shortcut[]` | `undefined` | Array of shortcut items. |
| `variant` | `"default" \| "chip" \| "subtle"` | `"default"` | Visual variant style. |
| `as` | `"aside" \| "span" \| "div"` | Derived | Wrapper container element (`aside` for default, `span` for chip/subtle). |
| `label` | `string` | `"Keyboard shortcuts"` | Accessible `aria-label` for screen readers. |
| `className` | `string` | `""` | Additional CSS class names. |

---

## Accessibility (WCAG 2.1 AA)

- **Keyboard Focus & Navigation**: The primary action button is fully focusable with visible focus ring indicators.
- **Global Listener Cleanup**: The `keydown` listener for `Ctrl+Enter` is properly cleaned up on unmount.
- **ARIA Attributes**: `aria-describedby` wiring on `<FormField>` is fully maintained. `KbdHint` container carries `aria-label` for screen reader clarity.
