# QuotaBanner Empty State (Issue #702 / b#025)

This document describes the themed empty-state illustration and CTA added to
`QuotaBanner` for the **GrantFox FWC26 campaign (Stellar Wave)**.

## Summary of Changes

When no quota data is configured, `QuotaBanner` can render a themed
`EmptyState` (`variant="quota-banner"`) instead of the quota form:

- **Illustration:** Gauge meter + usage bars (line-art SVG), using design
  tokens `--muted` / `--accent` only — no hardcoded hex. Decorative sparkles
  follow the Stellar Wave visual language used by other empty-state variants.
- **Copy:** Title "No quota configured" with a short supporting message.
- **CTA:** Primary button "Set up quota" that invokes `onSetupQuota`.
- **Accessibility:** Illustration is `aria-hidden`; the section is labelled via
  `aria-labelledby` → heading `id="quota-banner-empty-heading"` (WCAG 1.1.1,
  1.3.1, 4.1.2). Meaning is never conveyed by colour alone (WCAG 1.4.1).

## Visible / API Changes

### `EmptyState`

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `variant` | includes `"quota-banner"` | `"empty"` | New semantic variant for quota empty UI. |
| `headingId?` | `string` | — | Optional `id` on the heading so parents can wire `aria-labelledby`. |

Default copy for `quota-banner`:

| Size | Title | Message |
| --- | --- | --- |
| default | "No quota configured" | "No quota has been configured for this API yet. Set a quota to track and manage your usage limits." |
| compact | same | "Set a quota to track your API usage limits." |

### `QuotaBanner`

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `showEmptyState?` | `boolean` | `false` | When `true` **and** `onSetupQuota` is provided, renders the empty state. |
| `onSetupQuota?` | `() => void` | — | CTA handler for "Set up quota". Required for the empty state to mount. |

```tsx
import QuotaBanner from '../pages/QuotaBanner';

<QuotaBanner
  showEmptyState
  onSetupQuota={() => openQuotaSetupModal()}
/>
```

When `showEmptyState` is false (default), the existing form UI is unchanged.

## Design Tokens & Dark Mode

All empty-state colours reference CSS custom properties (`--muted`, `--accent`,
`--surface`, `--surface-soft`, `--line`, `--text`). Light and dark themes
resolve these tokens, so contrast remains WCAG 2.1 AA compliant on theme
toggle.

## Responsive Behaviour

- Default EmptyState layout uses `clamp()` heading sizing and flex centering;
  works from mobile (~320px) through desktop.
- `QuotaBanner` empty wrapper (`.quota-banner--empty`) drops internal padding so
  EmptyState owns spacing; the outer surface/border remain for visual
  consistency with the filled banner.
- At `max-width: 640px`, the filled banner still tightens padding; the empty
  variant inherits EmptyState's responsive padding.

## Accessibility Checklist (WCAG 2.1 AA)

- [x] **1.1.1** Illustration + SVG are `aria-hidden`; text carries meaning
- [x] **1.3.1** Semantic `h2` with stable `id` for region labelling
- [x] **1.4.1** Accent colour is decorative only
- [x] **1.4.3** Text uses `--text` / `--muted` tokens (4.5:1 calibrated)
- [x] **2.5.5** CTA min-height 44px (default EmptyState button)
- [x] **4.1.2** `aria-labelledby` target exists and matches heading id
