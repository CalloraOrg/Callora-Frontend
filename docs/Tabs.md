# Tabs — Smooth Transition + Accessible Animation

## Overview




The `Tabs` component replaces the inline tab navigation in `ApiDetailPage` with a reusable, fully accessible tab strip featuring a **smooth sliding ink-bar indicator** that animates between tabs using CSS `transition` driven by DOM geometry measurements. No animation libraries required.

---

## Files changed

| File | Change |
|---|---|
| `src/components/Tabs.tsx` | **New** — animated tab strip component |
| `src/components/Tabs.test.tsx` | **New** — focused unit tests (30+ cases) |
| `src/pages/ApiDetailPage.tsx` | **Updated** — replaces inline `<nav>` with `<Tabs>`; adds `role="tabpanel"` + `aria-labelledby` to every panel |
| `src/index.css` | **Updated** — `.api-detail-tabs` trimmed to placement-only rules; `.tabs-nav` / `.tabs-tab` / `.tabs-indicator` added via scoped styles in component |

---

## How the indicator works

```
┌──────────────────────────────────────────────────────┐
│  nav.tabs-nav  (position: relative)                  │
│  ┌──────────┐  ┌───────────────┐  ┌────────┐        │
│  │ Overview │  │ Documentation │  │Pricing │  …     │
│  └──────────┘  └───────────────┘  └────────┘        │
│  ══════════                                           │ ← span.tabs-indicator
│                                                      │
└──────────────────────────────────────────────────────┘
```

1. A ref map (`buttonRefs`) stores every tab's `<button>` element.
2. On every `activeTab` change, `useLayoutEffect` reads `btn.offsetLeft` and `btn.offsetWidth` — both are cheap integer reads with no forced reflow.
3. The indicator `<span>` receives inline `left` and `width` styles.
4. A CSS `transition` on `left` and `width` (using `cubic-bezier(0.4, 0, 0.2, 1)`) animates it smoothly to the new position.
5. A `resize` listener keeps the indicator accurate when the viewport changes.

---

## Animation & reduced motion

| User preference | Indicator behaviour |
|---|---|
| No preference (default) | Slides with `--transition-speed` (240 ms) cubic-bezier |
| `prefers-reduced-motion: reduce` | Snaps instantly (`--tabs-indicator-duration: 0ms`) |

The component checks `window.matchMedia('(prefers-reduced-motion: reduce)')` once on mount and injects the override as an inline CSS custom property, so no JavaScript animation loop is involved — it is purely CSS.

---

## `Tabs` props

```ts
type TabItem = {
  id: string;     // unique identifier; also used for aria-controls
  label: string;  // text displayed in the button
};

type TabsProps = {
  tabs:         TabItem[];
  activeTab:    string;                      // controlled
  onChange:     (id: string) => void;
  tabPanelId?:  (tabId: string) => string;  // defaults to (id) => `panel-${id}`
  className?:   string;                      // forwarded to <nav>
};
```

### Usage

```tsx
import Tabs from '../components/Tabs';

const TABS = [
  { id: 'overview',      label: 'Overview'      },
  { id: 'documentation', label: 'Documentation' },
  { id: 'pricing',       label: 'Pricing'       },
];

<Tabs
  tabs={TABS}
  activeTab={activeTab}
  onChange={(id) => setActiveTab(id)}
/>

{/* Matching panels */}
{activeTab === 'overview' && (
  <section
    id="panel-overview"
    role="tabpanel"
    aria-labelledby="tab-overview"
    tabIndex={0}
  >
    …
  </section>
)}
```

---

## Accessibility (WCAG 2.1 AA)

| Criterion | Implementation |
|---|---|
| 4.1.2 Name, Role, Value | `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls` on every button |
| 2.1.1 Keyboard | Arrow keys (← →), Home, End navigate between tabs per the APG Tab Pattern |
| 2.4.3 Focus Order | `tabIndex={0}` on active tab, `tabIndex={-1}` on others (roving tabindex) |
| 2.4.7 Focus Visible | `:focus-visible` outline uses `--accent` + `--focus-ring` tokens |
| 1.4.1 Use of Color | Active state conveyed by `aria-selected` — not colour alone |
| 2.3.3 Animation from Interactions | `prefers-reduced-motion` respected; indicator snaps at 0 ms |
| Indicator | `aria-hidden="true"` — decorative, not announced by screen readers |
| Tab panels | `role="tabpanel"`, `id="panel-{id}"`, `aria-labelledby="tab-{id}"`, `tabIndex={0}` |

### Keyboard reference

| Key | Action |
|---|---|
| `Tab` | Move focus into / out of the tab strip |
| `→` | Focus and select next tab (wraps) |
| `←` | Focus and select previous tab (wraps) |
| `Home` | Focus and select first tab |
| `End` | Focus and select last tab |
| `Enter` / `Space` | Not needed — selection follows focus (APG "Automatic Activation") |

---

## Design tokens used

| Token | Purpose |
|---|---|
| `--accent` | Indicator colour, active tab border |
| `--text` | Active tab label colour |
| `--muted` | Inactive tab label colour |
| `--line` | Strip border-bottom |
| `--page-bg` | Sticky background |
| `--transition-speed` | Default indicator animation duration (240 ms) |
| `--focus-ring` | Keyboard focus box-shadow |

All tokens are defined in `src/index.css` for both `[data-theme="dark"]` and `[data-theme="light"]`, so dark/light mode works with zero extra code in this component.

---

## Running tests

```bash
npm test
# single run:
npm test -- --run
```

Tests in `src/components/Tabs.test.tsx` cover:
- All tabs rendered with correct labels
- `role="tablist"` and `role="tab"` present
- `aria-selected` true/false per active state
- `tabIndex` roving (0 on active, -1 on others)
- `aria-controls` default and custom `tabPanelId`
- Click → `onChange` with correct id
- ArrowRight / ArrowLeft navigation including wrap-around
- Home / End jump keys
- Other keys do not call `onChange`
- Single-tab edge case (arrow keys wrap to self, no crash)
- Custom `className` applied alongside `tabs-nav`
- Indicator `aria-hidden="true"`
