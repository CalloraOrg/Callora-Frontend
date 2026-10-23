# RecentlyActiveRail Component

`src/components/RecentlyActiveRail.tsx`

The `RecentlyActiveRail` component provides a horizontally scrollable rail highlighting recently active APIs on the Marketplace page. This helps developers discover actively-maintained, high-demand APIs at a glance.

---

## Features

- **Dynamic Sorting**: Automatically ranks APIs based on creation/usage timestamp (`createdAt`) with usage volume (`usageCount`) as a tiebreaker.
- **Relative Time formatting**: Formats dates into compact relative timestamps (e.g. "today", "1d ago", "3d ago", "1mo ago").
- **Horizontal Scroll & Snap**: Smooth horizontal scrolling with CSS scroll-snap for touch and mouse interactions.
- **Accessible (WCAG 2.1 AA)**:
  - Accessible region container with `aria-label="Recently active APIs"`.
  - Native `<button>` elements for complete keyboard focusability and interaction.
  - Informative screen reader labels describing API name, provider, and relative active time.
- **Dark Mode Compatibility**: Uses standard CSS design variables (`var(--text-main)`, `var(--border-subtle)`, `var(--bg-highlight)`).

---

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `apis` | `APIItem[]` | Required | Source list of APIs to rank and display |
| `limit` | `number` | `8` | Maximum number of cards shown in the rail |
| `onSelect` | `(api: APIItem) => void` | Optional | Callback when an API card is activated |

---

## Usage

```tsx
import RecentlyActiveRail from "../components/RecentlyActiveRail";

<RecentlyActiveRail
  apis={mockApis}
  limit={8}
  onSelect={(api) => navigate(`/marketplace/${api.id}`)}
/>
```
