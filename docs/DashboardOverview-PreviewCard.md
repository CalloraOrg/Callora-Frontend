# Hover-Preview Cards on DashboardOverview (Issue #581)

## Overview

Implements a hover-triggered and keyboard-accessible **PreviewCard** overlay on all
rows and cards in the `DashboardOverview` page, as part of the GrantFox FWC26
campaign (Stellar Wave).

Users can preview rich details — status, metrics, tags, pricing, description —
**without navigating away** from the dashboard.

---

## Components changed

| File | Change |
|---|---|
| `src/components/PreviewCard.tsx` | New reusable hover+focus preview card wrapper |
| `src/pages/DashboardOverview.tsx` | Uses `PreviewCard` on all rows/cards; bugfix `api.latencyMs` → `api.avgLatencyMs` |
| `src/pages/DashboardPage.tsx` | Now accepts and passes through `DashboardOverviewProps` to `DashboardOverview` |
| `src/App.tsx` | `/dashboard` route now renders `DashboardPage` (with `DashboardOverview`) instead of the old `Dashboard` component |
| `src/components/PreviewCard.test.tsx` | Full unit-test coverage for `PreviewCard` |
| `src/pages/DashboardOverview.test.tsx` | Integration tests for all preview-card surfaces on the page |

---

## PreviewCard API

```tsx
import PreviewCard, { type PreviewCardData } from '../components/PreviewCard';

<PreviewCard data={myData} position="bottom">
  <div>Hover or focus me to see a preview</div>
</PreviewCard>
```

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `data` | `PreviewCardData` | — | Item details displayed in the overlay |
| `children` | `ReactNode` | — | The trigger element wrapped by the card |
| `position` | `'top' \| 'bottom' \| 'left' \| 'right'` | `'bottom'` | Floating overlay placement relative to the trigger |
| `className` | `string` | `''` | Optional extra class on the wrapper div |

### PreviewCardData shape

```ts
interface PreviewCardData {
  id: string;
  title: string;
  subtitle?: string;
  category?: string;
  status?: StatusVariant;        // renders a StatusBadge
  description?: string;
  metrics?: Array<{ label: string; value: string | number }>;
  tags?: string[];
  price?: string | number;       // "$0.005 / call" auto-formatted
  lastActive?: string;
  details?: Record<string, string | number>;
}
```

---

## Surfaces on DashboardOverview

### 1. Balance cards (Vault Balance, Wallet Available)
Wrapped in `<PreviewCard position="bottom">`. Hovering or focusing opens a tooltip
with balance details, estimated API runway, and account metadata.

### 2. Pinned API rows
Each row in the "Pinned APIs" section is wrapped in `<PreviewCard position="top">`.
The preview shows the API name, provider, status badge, category, latency, uptime,
and price per call.

### 3. Recent Activity items
Each activity row is wrapped in `<PreviewCard position="right">`. The preview shows
the transaction type (deposit or usage charge), amount in USDC, endpoint, and
timestamp.

---

## Accessibility (WCAG 2.1 AA)

- **`role="tooltip"`** on the preview panel so screen readers announce it as
  supplementary information.
- **`aria-describedby`** on the trigger points to the panel's ID while open;
  cleared on close.
- **`tabIndex={0}`** and **`role="button"`** on the trigger — fully keyboard
  reachable without a mouse.
- **Escape key** closes the panel and restores focus to the trigger.
- **`aria-label="Preview details for <title>"`** on every trigger for descriptive
  screen reader identification.
- All colors use CSS custom properties (`--surface`, `--text-primary`, `--accent`,
  etc.) that resolve correctly in both light and dark themes.
- `prefers-reduced-motion` is respected by the parent components; no CSS transitions
  are added inside `PreviewCard` itself.

---

## Dark / light mode

`PreviewCard` uses only CSS custom properties that are defined in both
`[data-theme="dark"]` and `[data-theme="light"]` blocks in `src/index.css`:

```
--surface          panel background
--border-color     panel border
--shadow           panel drop shadow
--text-primary     title text
--text-secondary   subtitle / description text
--accent           metric values
--bg-chip          metrics grid and tag chips background
--line             footer separator
--success          price value
```

---

## Responsive behavior

- `maxWidth: 90vw` on the floating panel prevents overflow on small screens.
- At `≤ 560 px` the panel position snaps to `bottom` by default since there is no
  horizontal space for `right` or `left` placement; callers should choose
  appropriate positions per breakpoint.
- `pointerEvents: 'none'` on the panel ensures it never blocks pointer interaction
  with content underneath.

---

## Bug fix included

`DashboardOverview.tsx` previously referenced `api.latencyMs` (undefined property)
for the pinned-API preview metrics. This is corrected to `api.avgLatencyMs`, which
matches the `APIItem` type in `src/data/mockApis.ts`. A regression test is included
in `DashboardOverview.test.tsx` under the heading
_"shows latency and uptime metrics from api.avgLatencyMs (not api.latencyMs)"_.
