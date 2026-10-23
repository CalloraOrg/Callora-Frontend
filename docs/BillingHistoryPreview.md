# BillingHistory Preview Card

**Campaign:** GrantFox FWC26
**Issue:** UI/UX — hover-triggered preview card on BillingHistory; keyboard-accessible alternative
**Route:** `/billing/history`
**Files changed:**
- `src/components/PreviewCard.tsx` — extended with billing-specific fields
- `src/pages/BillingHistory.tsx` — new page component
- `src/App.tsx` — route + navigation entries added

---

## Overview

The Billing History page displays a paginated table of USDC transactions. Each row's description cell is wrapped in a **PreviewCard** trigger. Hovering or focusing the trigger opens a compact floating panel that reveals on-chain details — transaction hash, network, confirmation count, direction badge, formatted amount, and timestamp — without requiring the user to navigate to a separate page.

---

## User flows

### Mouse user

1. Visit `/billing/history`.
2. Hover the description text of any transaction row.
3. A tooltip-style card appears below the cell with:
   - Transaction type + credit/debit badge
   - Formatted USDC amount (e.g. `+100.00 USDC`)
   - Network name (`Stellar Mainnet`)
   - Confirmation count
   - Truncated tx hash (full hash available in the `title` attribute)
   - Formatted timestamp
4. Moving the cursor off the row closes the card.

### Keyboard user

1. Tab to a transaction row's description trigger.
2. The preview card opens automatically on focus.
3. Read the on-chain details via the `aria-describedby` association or by listening to the `role="tooltip"` announcement.
4. Press **Escape** to dismiss the card and return focus to the trigger.
5. Tab again to move to the next row (card closes automatically on blur).

### Touch user (below 640px)

Below 640px the table is replaced by a list of transaction cards. Only one of the two layouts is in the DOM at a time, so screen readers never read both.

1. Each card is a list item with a heading (the description), a status badge, the signed amount (`+` for credits, a minus sign for debits), the date, and a **Details** button.
2. Tap **Details** to open a bottom sheet with the same on-chain details as the hover preview: transaction hash (with a **Copy** button), network, confirmations and timestamp.
3. Close the sheet with the close button, a tap on the backdrop, or **Escape**. Focus returns to that card's Details button.
4. Sorting uses a single **Sort by** select (date or amount, either direction). It writes the same `sort` and `dir` URL params as the desktop column headers, so a shared link sorts the same way on both layouts.
5. Filters stack in one column and behave exactly as on desktop. The net-balance summary stays at the top.

The breakpoint is `(max-width: 639px)`. It is read in JavaScript by the `useMediaQuery` hook (to choose which layout to render) and in CSS (to stack the filters). All touch targets are at least 44x44px.

---

## Filtering

The page exposes four filter controls above the table:

| Control | Values |
|---------|--------|
| Search | Free text (description or tx hash prefix) |
| Type | All / Deposit / API Call / Refund / Settlement / Fee |
| Status | All / success / pending / error / warning |
| Direction | All / Credit / Debit |

Filters are combinable. A live region (`role="status" aria-live="polite"`) announces the active filter state to screen readers after each change.

When no transactions match, a clearly labelled empty-state message replaces the table.

---

## API — PreviewCard

`PreviewCard` is a shared component (`src/components/PreviewCard.tsx`). It accepts a `PreviewCardData` object, a trigger as `children`, an optional `position` prop, and an optional `className`.

### `PreviewCardData` — complete type

```ts
export interface PreviewCardData {
  id: string;
  title: string;

  // — Shared (dashboard overview + billing history)
  subtitle?: string;
  category?: string;
  status?: StatusVariant;           // See StatusBadge
  description?: string;
  metrics?: PreviewMetric[];        // { label, value }[]
  tags?: string[];
  price?: string | number;
  lastActive?: string;
  details?: Record<string, string | number>;

  // — Billing-specific (GrantFox FWC26)
  txHash?: string;          // Full 64-char Stellar hash
  network?: string;         // e.g. "Stellar Mainnet"
  confirmations?: number;   // Ledger confirmation count
  type?: string;            // "Deposit" | "API Call" | etc.
  timestamp?: string;       // ISO 8601
  amount?: number;          // USDC value (positive)
  direction?: 'credit' | 'debit';
}
```

**Mode detection:** if any of `txHash`, `network`, `confirmations`, `type`, or `amount` is present, the card renders the billing-specific section and suppresses the generic `metrics` grid and `price/lastActive` footer. Existing callers (DashboardOverview) are unaffected.

### `PreviewCardProps`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `PreviewCardData` | required | Card content |
| `children` | `ReactNode` | required | Hover/focus trigger element |
| `position` | `'top' \| 'bottom' \| 'left' \| 'right'` | `'bottom'` | Floating panel placement |
| `className` | `string` | `''` | Extra class on the wrapper `div` |

### Usage example — billing row

```tsx
import PreviewCard, { type PreviewCardData } from '../components/PreviewCard';

const data: PreviewCardData = {
  id: 'tx-001',
  title: 'USDC vault deposit',
  status: 'success',
  type: 'Deposit',
  direction: 'credit',
  amount: 100.00,
  txHash: 'A3F9B2C1D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B6C7D8E9F0A1',
  network: 'Stellar Mainnet',
  confirmations: 120,
  timestamp: '2026-07-25T14:32:00Z',
};

<PreviewCard data={data} position="bottom">
  <span>USDC vault deposit</span>
</PreviewCard>
```

---

## API — BillingHistory page

`BillingHistory` is a default-exported React component at `src/pages/BillingHistory.tsx`. It requires no props — all data comes from the internal `MOCK_TRANSACTIONS` constant.

### Exports

| Name | Kind | Description |
|------|------|-------------|
| `BillingHistory` | named + default export | Page component |
| `MOCK_TRANSACTIONS` | named export | Array of `BillingTransaction` for use in tests and Storybook |
| `BillingTransaction` | type | Shape of a single transaction record |
| `TxType` | type | `'Deposit' \| 'API Call' \| 'Refund' \| 'Settlement' \| 'Fee'` |
| `TxDirection` | type | `'credit' \| 'debit'` |
| `TxStatus` | type | Subset of `StatusVariant` used for transactions |

---

## Accessibility notes (WCAG 2.1 AA)

| Criterion | Implementation |
|-----------|----------------|
| **1.1.1 Non-text content** | Direction arrows are `aria-hidden`; information is also in the `direction` badge text. |
| **1.3.1 Info and Relationships** | `<table>` with `<thead>` / `<th scope="col">` / `<tbody>` exposes structure. |
| **1.3.3 Sensory Characteristics** | Status is never conveyed by colour alone — `StatusBadge` adds a texture pattern. |
| **1.4.1 Use of Color** | Credit/debit is labelled with text ("↑ credit" / "↓ debit") in addition to colour. |
| **1.4.3 Contrast** | All colours reference design tokens; both dark and light themes pass 4.5:1 minimum. |
| **2.1.1 Keyboard** | All PreviewCard triggers are `tabIndex={0}` with `role="button"`. Escape dismisses the preview. |
| **2.4.3 Focus Order** | Escape restores focus to the trigger; `suppressNextFocus` guard prevents immediate re-open. |
| **2.4.6 Headings and Labels** | Page heading (`<h1>`), filter group (`role="group" aria-label`), and table all have labels. |
| **4.1.2 Name, Role, Value** | Trigger: `role="button"`, `aria-label`, `aria-describedby`. Panel: `role="tooltip"`, `aria-label`. |
| **4.1.3 Status Messages** | Filter changes announced via `role="status" aria-live="polite" aria-atomic="true"`. |

### Skip-link support

The page lives under `<main id="main-content">` which the app-level skip link already targets — no additional work needed.

---

## Design-token usage

All colours in `PreviewCard` and `BillingHistory` use CSS custom properties so both light and dark themes are covered automatically.

| Token | Used for |
|-------|----------|
| `--surface` | Preview card background |
| `--line` / `--border-color` | Preview card and table borders |
| `--shadow` | Preview card drop shadow |
| `--text-primary` / `--text` | Primary text |
| `--text-secondary` / `--muted` | Secondary / muted text |
| `--accent` | Tx hash, confirmation count, accent values |
| `--success` | Credit amounts, high-confirmation count |
| `--danger` | Debit amounts, error states |
| `--bg-chip` | Billing details section background |
| `--sb-success-bg/fg` | Credit direction badge |
| `--sb-error-bg/fg` | Debit direction badge |

---

## Responsive behaviour

- **Below 640px:** transactions render as cards (see "Touch user" above). The table is not rendered, so there is no horizontal scrolling at 320px.
- **640px and above:** the table renders as before. Its container keeps `overflow-x: auto` as a fallback for narrow desktop windows.
- The preview card has `maxWidth: 90vw`, so it never overflows the viewport on narrow screens.
- Filter controls wrap on wider screens and stack into one column below 640px.
- The page heading uses `clamp(1.35rem, 3vw, 1.75rem)` for fluid sizing.
- Styles live in `src/pages/BillingHistory.css` (`.billing-history .bh-*` classes), not inline.
---

## Running the tests

```bash
# New tests only
npm test -- --run src/components/PreviewCard.test.tsx src/pages/BillingHistory.test.tsx

# Full suite
npm test -- --run
```

Expected result: **56 new tests pass** (31 BillingHistory + 25 PreviewCard).

---

## Related docs

- [UI Design System](./UI-Design-System.md) — design tokens and component guidelines
- [ResponseDiff](./ResponseDiff.md) — similar hover/focus pattern on `CallHistoryRow`
- `src/components/EndpointPreview.tsx` — the original hover preview pattern this feature follows
