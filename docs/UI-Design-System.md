# Callora UI Design System

This guide documents Callora's design tokens, component library, and visual specifications. All contributors must follow these guidelines to ensure consistency across the application.

## Core Rule: Use Tokens, Not Inline Values

**Always use CSS custom properties (design tokens) instead of hardcoded hex values.**

❌ **Don't do this:**

```tsx
<div style={{ color: "#4e85ff", background: "#ffffff" }}>
```

✅ **Do this:**

```tsx
<div style={{ color: "var(--accent)", background: "var(--surface)" }}>
```

This ensures:

- Consistent theming across light/dark modes
- Easy maintenance and updates
- Accessibility compliance
- Reduced technical debt

---

## Design Tokens

All design tokens are defined in `src/index.css`. They are organized by category and theme.

### Global Tokens (Theme-Agnostic)

These tokens are shared across both light and dark themes.

| Token                 | Value                                     | Purpose                                   |
| --------------------- | ----------------------------------------- | ----------------------------------------- |
| `--font-family`       | `'Space Grotesk', 'Segoe UI', sans-serif` | Primary typeface for all text             |
| `--radius-xl`         | `28px`                                    | Extra-large border radius (cards, modals) |
| `--radius-lg`         | `20px`                                    | Large border radius (sections, panels)    |
| `--radius-md`         | `16px`                                    | Medium border radius (buttons, inputs)    |
| `--transition-speed`  | `240ms`                                   | Standard animation duration               |
| `--focus-ring`        | `0 0 0 3px rgba(78, 133, 255, 0.55)`      | Focus indicator for keyboard navigation   |
| `--focus-ring-offset` | `0 0 0 5px rgba(78, 133, 255, 0.55)`      | Extended focus ring for better visibility |

### Color Tokens

#### Dark Theme Values

| Token              | Value                                                                     | Usage                                     |
| ------------------ | ------------------------------------------------------------------------- | ----------------------------------------- |
| `--page-bg`        | `#0b1020`                                                                 | Main page background                      |
| `--surface`        | `rgba(14, 20, 39, 0.86)`                                                  | Card/panel backgrounds with transparency  |
| `--surface-strong` | `rgba(17, 24, 46, 0.96)`                                                  | High-opacity surfaces (modals, overlays)  |
| `--surface-soft`   | `rgba(255, 255, 255, 0.04)`                                               | Subtle backgrounds (hover states, inputs) |
| `--line`           | `rgba(169, 184, 255, 0.16)`                                               | Standard borders and dividers             |
| `--line-strong`    | `rgba(169, 184, 255, 0.28)`                                               | Emphasized borders                        |
| `--text`           | `#f3f5fb`                                                                 | Primary text color                        |
| `--muted`          | `#93a0bf`                                                                 | Secondary text, labels, metadata          |
| `--accent`         | `#4e85ff`                                                                 | Primary brand color, links, active states |
| `--accent-strong`  | `#1ed6a4`                                                                 | Success states, highlights, CTAs          |
| `--danger`         | `#ff7d8d`                                                                 | Error states, destructive actions         |
| `--success`        | `#73f2bb`                                                                 | Success messages, confirmations           |
| `--shadow`         | `0 24px 80px rgba(3, 8, 22, 0.45)`                                        | Card and modal shadows                    |
| `--ambient-a`      | `rgba(78, 133, 255, 0.22)`                                                | Ambient glow effect (blue)                |
| `--ambient-b`      | `rgba(30, 214, 164, 0.18)`                                                | Ambient glow effect (green)               |
| `--backdrop`       | `rgba(4, 8, 18, 0.76)`                                                    | Modal backdrop overlay                    |
| `--modal-bg`       | `linear-gradient(180deg, rgba(20, 27, 50, 0.98), rgba(12, 18, 34, 0.98))` | Modal background gradient                 |

#### Light Theme Values

| Token              | Value                                                                           | Usage                                     |
| ------------------ | ------------------------------------------------------------------------------- | ----------------------------------------- |
| `--page-bg`        | `#f5f7fa`                                                                       | Main page background                      |
| `--surface`        | `#ffffff`                                                                       | Card/panel backgrounds                    |
| `--surface-strong` | `rgba(255, 255, 255, 0.92)`                                                     | High-opacity surfaces                     |
| `--surface-soft`   | `rgba(0, 0, 0, 0.06)`                                                           | Subtle backgrounds                        |
| `--line`           | `rgba(0, 0, 0, 0.8)`                                                            | Standard borders and dividers             |
| `--line-strong`    | `rgba(0, 0, 0, 0.12)`                                                           | Emphasized borders                        |
| `--text`           | `#1a2332`                                                                       | Primary text color                        |
| `--muted`          | `#64748b`                                                                       | Secondary text, labels, metadata          |
| `--accent`         | `#2563eb`                                                                       | Primary brand color, links, active states |
| `--accent-strong`  | `#059669`                                                                       | Success states, highlights, CTAs          |
| `--danger`         | `#dc2626`                                                                       | Error states, destructive actions         |
| `--success`        | `#10b981`                                                                       | Success messages, confirmations           |
| `--shadow`         | `0 12px 40px rgba(78, 133, 255, 0.1)`                                           | Card and modal shadows                    |
| `--ambient-a`      | `rgba(78, 133, 255, 0.08)`                                                      | Ambient glow effect (blue)                |
| `--ambient-b`      | `rgba(30, 214, 164, 0.06)`                                                      | Ambient glow effect (green)               |
| `--backdrop`       | `rgba(255, 255, 255, 0.8)`                                                      | Modal backdrop overlay                    |
| `--modal-bg`       | `linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 255, 0.98))` | Modal background gradient                 |

### Token Usage Guidelines

- **Backgrounds**: Use `--page-bg` for main content, `--surface` for cards, `--surface-soft` for inputs/hover states
- **Text**: Use `--text` for primary content, `--muted` for secondary text and labels
- **Borders**: Use `--line` for standard borders, `--line-strong` for emphasized borders
- **Actions**: Use `--accent` for primary actions/links, `--accent-strong` for success states, `--danger` for destructive actions
- **Shadows**: Use the predefined `--shadow` token; don't create custom shadows

---

## Iconography

To keep the bundle size small and ensure theme consistency, Callora uses a custom, lightweight SVG icon set instead of external libraries.

### Guidelines for Icons

- **Theme Awareness**: All custom SVG icons must use `fill="none" stroke="currentColor"` so that they automatically adapt to theme switches.
- **Stroke Style**: Keep the stroke width consistent at `1.6px` across all icons.
- **Allowed Sizes**: Custom SVG icons must be used in **16px** (`size={16}`) or **20px** (`size={20}`) sizes only. No other sizes are allowed to prevent blurriness and maintain visual alignment.
- **Accessibility**: All icons must have `aria-hidden="true"` when decorative (default behaviour) or carry a descriptive `aria-label` when used standalone.
- **Barrel Export**: Export new icons as named exports in `src/components/icons/index.tsx`.

### Available Icons

- `TagIcon` (16px/20px) - Represents category tags or categories.
- `CheckIcon` (16px/20px) - Represents successful statuses, features list items, or checkmarks.
- `WarningIcon` (16px/20px) - Represents validation errors, price range warnings, or alert messages.
- `BoltIcon` (16px/20px) - Represents system uptime, fast status, or performance.
- `ClockIcon` (16px/20px) - Represents latency, response times, or duration.

---

## Component Library

All shared components are located in `src/components/`. Use these components instead of building custom UI elements.

### ApiCard

Displays API information in a card format for marketplace listings.

**Props:**

- `api: any` - API object containing name, description, provider, tags, rating, ratingDistribution, and footer stats (`pricePerCall`, `avgLatencyMs`, `uptimePercent`)
- `onViewDetails?: (api: any) => void` - Callback when "View Details" is clicked

**Variants:**

- `ApiCard` - Standard card with hover effects
- `ApiCardSkeleton` - Loading state with skeleton placeholders

**Visual Spec:**

- Min-height: 220px
- Padding: 12px
- Border: 1px solid with hover state
- Hover: Lift effect (translateY -4px), enhanced shadow, accent border
- Background: Uses `--surface-soft` token
- Tags: Reusable clickable chips with pill styling, token-based colors, and active-state highlighting
- Footer: Three-column micro-stat row with a muted label above a prominent value for price, latency, and uptime
- Numeric values: Use tabular numerals for easier comparison across marketplace rows
- Missing stats: Render a muted em dash so card heights remain consistent

**States:**

- Default: Subtle border, no shadow
- Hover: Accent border (#4666ff), shadow, lift effect. Rating display shows a pop-up distribution histogram on hover or long-press.
- Focus: Keyboard accessible with tabIndex=0, Enter key triggers onViewDetails
- Tag active: Matching tag chip uses the accent token and `aria-pressed=true`
- Loading: Skeleton variant with placeholder elements

**Accessibility:**

- `tabIndex={0}` for keyboard navigation
- `onKeyDown` handles Enter key
- Tag chips are real `<button>` elements with `aria-pressed`
- Tag activation does not trigger card navigation
- Semantic `<article>` element

**Usage Example:**

```tsx
<ApiCard api={apiData} onViewDetails={(api) => navigate(`/api/${api.id}`)} />
```

---

### UsageGauge

Summarizes consumed API budget or request allowance on the dashboard with both a visual progress bar and complete assistive text.

**Props:**

- `label?: string` - Visible and accessible name for the tracked usage metric
- `used: number` - Consumed amount; negative and non-finite values are treated as 0
- `limit: number` - Maximum allowance; values less than or equal to 0 render the “No limit configured” state
- `unit?: string` - Unit displayed in visible and assistive text, defaults to `USDC`
- `warningThreshold?: number` - Percentage at which the visible and announced state becomes “Approaching limit”, defaults to 75
- `criticalThreshold?: number` - Percentage at which the state becomes “Critical usage”, defaults to 90

**Visual Spec:**

- Container uses `--surface-soft`, `--line`, and `--radius-lg`
- Fill uses `--accent` to `--accent-strong` gradient for normal usage
- Warning and critical states use `--accent-strong`; exhausted state uses `--danger`
- Percentage uses tabular numerals and scales responsively with `clamp()`

**Accessibility:**

- Uses `role="progressbar"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, and `aria-valuetext`
- `aria-valuetext` includes the usage state, consumed amount, limit, remaining allowance, and percentage used
- A visually hidden description mirrors the announced status for screen readers
- Color is not the only indicator; visible state text is always rendered

---

### Breadcrumb

Navigation breadcrumb showing page hierarchy.

**Props:**

- `items: Array<{ label: string; href: string; isCurrent?: boolean }>` - Array of breadcrumb items

**Visual Spec:**

- Font size: 0.875rem
- Spacing: 8px gap between items
- Separator: "→" arrow (aria-hidden)
- Current page: Bold, `--text` color
- Links: `--accent` color, no underline
- Padding-left: 32px

**States:**

- Default: Muted separator, accent links
- Focus: Custom outline (2px solid `--accent`) on links
- Current: Non-clickable, bold text

**Accessibility:**

- `aria-label="breadcrumb"` on nav
- `aria-current="page"` on current item
- Collapsed middle crumbs open from a real button with `aria-expanded` and `aria-controls`
- Keyboard navigation supports Enter/Space on links and buttons, Arrow Up/Down, Home, End, and Escape in the collapsed crumbs menu
- Focus moves into the collapsed menu when opened and returns to the trigger when closed with Escape

**Usage Example:**

```tsx
<Breadcrumb
  items={[
    { label: "Home", href: "/" },
    { label: "Marketplace", href: "/marketplace" },
    { label: "API Details", isCurrent: true },
  ]}
/>
```

---

### CodeExample

Tabbed code snippet display with copy-to-clipboard functionality.

**Props:**

- `snippets: Record<string, string>` - Object mapping language names to code strings
- `defaultLanguage?: string` - Initial active tab (defaults to first key)

**Visual Spec:**

- Container: `preview-card` class, bordered
- Header: Flex layout, tabs on left, copy button on right
- Tabs: Uppercase, 11px font, 4px padding, rounded (4px)
- Active tab: `--bg-highlight` background, bordered
- Code area: 16px padding, monospace font, 13px size
- Copy button: Ghost button style, 75px min-width

**States:**

- Default: Shows code for active language
- Tab switch: Instant, no animation
- Copy: Button shows "Copied!" with checkmark for 1.5s
- Focus: Standard focus ring on interactive elements

**Accessibility:**

- `role="tablist"` on tab container
- `role="tab"` and `aria-selected` on tabs
- `aria-label` on copy button
- Keyboard navigation between tabs

**Usage Example:**

```tsx
<CodeExample
  snippets={{
    bash: "curl https://api.callora.com/v1/endpoint",
    javascript: "fetch('https://api.callora.com/v1/endpoint')",
  }}
  defaultLanguage="bash"
/>
```

---

### EmptyState

Displayed when no results are found (e.g., empty search results, filtered marketplace, network errors).
Enhanced in v7 with custom line-art SVG illustrations per variant, design-token theming, and a compact
size tailored specifically for inline use inside FiltersSidebar.

**Props:**

| Prop              | Type                                     | Default     | Description                                                               |
| ----------------- | ---------------------------------------- | ----------- | ------------------------------------------------------------------------- |
| `variant?`        | `"empty" \| "filtered" \| "error"`       | `"empty"`   | Which semantic state to render.                                           |
| `size?`           | `"default" \| "compact"`                 | `"default"` | Full-size (marketplace results) vs condensed (FiltersSidebar inline).     |
| `title?`          | `string`                                 | per variant | Override the default heading.                                             |
| `message?`        | `string`                                 | per variant | Override the default subtitle.                                            |
| `onClearFilters?` | `() => void`                             | —           | Shown only when `variant === "filtered"`. Renders the Clear CTA.          |
| `onRetry?`        | `() => void \| Promise<void>`            | —           | Shown only when `variant === "error"`. Handles async loading + aria-busy. |
| `action?`         | `{ label: string; onClick: () => void }` | —           | Optional custom CTA button rendered before any variant-specific actions.  |

**Visual Spec (v7):**

- **Illustrations** are custom line-art SVGs, one per variant:
  - `empty`: Open crate/box with subtle accent sparkles → "nothing to show yet"
  - `filtered`: Funnel shape + magnifier-with-slash focal motif, accent tag pills → "filters exclude everything"
  - `error`: Warning triangle with accent-marked exclamation caret, dashed baseline → "something went wrong"
- All strokes use `var(--muted)` (primary) and `var(--accent)` (subordinate accents). **No hardcoded hex.**
- Stroke caps/joins are `round` for a modern, friendly feel.
- Illustrations are wrapped in a circular container:
  - `default`: 80px circle, `--surface-soft` bg, `--line` border
  - `compact`: 56px circle, `--surface` bg, `--line` border
- Layout:
  - `default`: 48px/32px padding, min-height 300px, flex column centered
  - `compact`: 16px/12px padding, `--surface-soft` bg, 10px radius, `--line` border
- Type scale:
  - `default`: `h2` heading, clamp(1.375rem, 2vw, 1.625rem), body 0.9375rem
  - `compact`: `h3` heading, 0.9375rem semibold, body 0.8125rem, max-width 240px
- CTAs:
  - `default`: Primary button, min-height 44px, min-width 160px
  - `compact`: Ghost button, min-height 36px, label "Clear filters" vs "Clear all filters"

**Default copy per variant:**

| Variant  | Default title         | Default message (default)                           | Default message (compact)                 |
| -------- | --------------------- | --------------------------------------------------- | ----------------------------------------- |
| empty    | "No APIs available"   | "Check back soon for new integrations."             | same (compact not typical)                |
| filtered | "No results found"    | "Your filters are too narrow. Try adjusting them."  | "Adjust filters or clear to see results." |
| error    | "Failed to load APIs" | "We encountered an error fetching the marketplace…" | "Error loading results. Please retry."    |

**States:**

- Static illustration, interactive CTAs only.
- Error retry is async: button disables + `aria-busy="true"` + label "Retrying…" while the promise is pending.
- Default-size error additionally renders an ExternalLink to `https://status.callora.io`.

**Accessibility (WCAG 2.1 AA):**

- **1.1.1 Non-text Content:** Illustration wrapper and nested SVG both carry `aria-hidden="true"`. Meaning is conveyed exclusively by the heading + message text.
- **1.3.1 Info and Relationships:** Semantic `h2` (default) / `h3` (compact) heading above a paragraph.
- **1.4.1 Use of Color:** `var(--accent)` strokes are decorative only; the variant meaning is unambiguous from the title/message even if accent color is invisible.
- **1.4.3 Contrast (Minimum):** All text uses `--text` / `--muted` tokens, which are calibrated to meet 4.5:1 in both light and dark themes.
- **1.4.12 Text Spacing:** Uses `line-height` ≥ 1.3; no height constraints on text blocks.
- **2.5.5 Target Size:** Buttons are minimum 36px (compact) / 44px (default) tall.
- **4.1.3 Status Messages:** Filtered variant in FiltersSidebar is wrapped in `role="status"` `aria-live="polite"` so zero-results events are announced when the count transitions from ≥1 to 0.
- **Design-token & dark-mode consistency:** Zero hardcoded hex colors anywhere — every stroke, fill, bg, and border references a `var(--token)` so zero visual regressions on theme toggle.

**Responsive Behavior:**

- `size="default"` is used in result-area containers (MarketplacePage main grid, Dashboard wide panels). Illustration scales with the flex container; heading uses `clamp()` for viewport-aware sizing.
- `size="compact"` is used inline in FiltersSidebar (both desktop sidebar and mobile bottom sheet). The 56px illustration fits comfortably inside a ~280px column without crowding the chip-style filter controls.
- Both sizes maintain locked dimensions for illustration wrapper so switching variants never causes layout shift.

**Usage Example:**

```tsx
{
  /* Marketplace results area */
}
{
  filteredApis.length === 0 && Object.keys(activeFilters).length === 0 && (
    <EmptyState variant="empty" />
  );
}
{
  filteredApis.length === 0 && Object.keys(activeFilters).length > 0 && (
    <EmptyState variant="filtered" onClearFilters={resetFilters} />
  );
}
{
  fetchError && <EmptyState variant="error" onRetry={refetch} />;
}

{
  /* FiltersSidebar inline zero-results notice */
}
{
  resultCount === 0 && hasActiveFilters && (
    <EmptyState
      variant="filtered"
      size="compact"
      onClearFilters={clearFilters}
    />
  );
}
```

---

### TagChip

Reusable chip button for marketplace tag filtering.

**Props:**

- `tag: string` - Visible tag label and filter value
- `active?: boolean` - Whether the chip reflects the current active filter
- `onClick?: (tag: string) => void` - Callback invoked when the chip is selected

**Visual Spec:**

- Pill shape with full radius (`999px`)
- Uses `--surface-soft`, `--line`, `--muted`, and `--accent` design tokens
- Minimum height: 32px for touch accessibility
- Active state: Accent-filled pill with white text

**Accessibility:**

- Semantic `<button type="button">`
- `aria-pressed` communicates toggle state
- Keyboard activation is supported without bubbling into parent card navigation

---

### EndpointGroupHover

Interactive documentation helper that previews endpoint groups on hover and keyboard focus.

**Props:**

- `groups: EndpointGroupPreview[]` - Group metadata including label, supported methods, counts, and preview endpoints

**Visual Spec:**

- Two-column layout on desktop: group triggers on the left, preview card on the right
- Trigger buttons: 14px radius, token-based border/background, minimum 52px height
- Preview card: `preview-card` styling with group summary, method badges, and up to three endpoint rows
- Responsive: collapses to a single column on smaller screens

**States:**

- Default: Empty helper card prompts the user to hover or focus a group
- Hover / Focus: Matching group trigger highlights and reveals the preview card
- Escape: Clears the active preview for keyboard users

**Accessibility:**

- Uses real `<button type="button">` triggers
- Keyboard focus reveals the same preview shown on hover
- `aria-describedby` links the active trigger to its preview card
- Preview helper text remains available when no group is active

---

### FiltersSidebar

Sidebar for filtering marketplace results. Rendered inside the desktop layout and also embedded inside the `FiltersBottomSheet` on mobile.

Enhanced in v7 with an inline, context-aware **zero-results EmptyState** that appears between the Favorites section and the Clear button whenever the active filters narrow the result set to 0.

**Props:**

| Prop                   | Type                          | Default | Description                                                                                               |
| ---------------------- | ----------------------------- | ------- | --------------------------------------------------------------------------------------------------------- |
| `selectedCategories`   | `Set<string>`                 | (req)   | Currently selected category checkboxes.                                                                   |
| `toggleCategory`       | `(c: string) => void`         | (req)   | Toggle a category checkbox.                                                                               |
| `minPrice`             | `number \| null`              | (req)   | Minimum price filter value.                                                                               |
| `maxPrice`             | `number \| null`              | (req)   | Maximum price filter value.                                                                               |
| `setMinPrice`          | `(v: number \| null) => void` | (req)   | Update minimum price (pass `null` to clear).                                                              |
| `setMaxPrice`          | `(v: number \| null) => void` | (req)   | Update maximum price (pass `null` to clear).                                                              |
| `popularity`           | `string`                      | (req)   | Popularity sort: `"any"` \| `"mostUsed"` \| `"newest"`.                                                   |
| `setPopularity`        | `(p: string) => void`         | (req)   | Update popularity sort.                                                                                   |
| `clearFilters`         | `() => void`                  | (req)   | Reset every filter to its default/empty state.                                                            |
| `favoritesOnly?`       | `boolean`                     | `false` | Whether the "Favorites only" toggle is checked.                                                           |
| `toggleFavoritesOnly?` | `() => void`                  | no-op   | Toggle the `favoritesOnly` state.                                                                         |
| `resultCount?`         | `number`                      | —       | **(v7)** Live count of results after filtering. When `0` + active filters, renders the inline EmptyState. |

**Visual Spec:**

- Layout: Three collapsible `FilterGroup` sections (Categories, Price range, Popularity) plus a Favorites fieldset, the **inline zero-results EmptyState (v7)**, and a Clear button.
- Each `FilterGroup` persists its collapsed state to `localStorage` via `usePersistedState`.
- Price range: Two `<input type="number">` fields with a `WarningIcon` + error message when `min > max`.
- Popularity: Accessible `Dropdown` component.
- **Zero-results inline block (v7):** Wrapped in a `12px` padding-top + `1px solid var(--line)` top-border separator so it visually groups with "results feedback" rather than the Favorites controls above. Contains:
  - `<EmptyState variant="filtered" size="compact" onClearFilters={clearFilters} />`
  - Wrapper carries `role="status"` + `aria-live="polite"` for assistive-tech announcements.
- Clear button: Ghost button style, always present at the bottom.

**States:**

- Default: All filter sections expanded.
- Collapsed: Section header shows rotated chevron; panel is `hidden`.
- Price error: Both price inputs gain `filter-input--invalid` class; alert paragraph appears with `role="alert"`.
- **Zero-results (v7):** When `resultCount === 0` AND at least one filter is active (categories, price bounds, non-any popularity, or favorites-only), the inline EmptyState mounts with a token-based top-border separator above it.
- Focused: Standard focus ring on all inputs and buttons.

**Responsive Behavior:**

- **Desktop:** Rendered inside `<aside class="filters-sidebar">` as a persistent left rail. Zero-results separator and EmptyState render inline.
- **Mobile (≤ 980px):** The `<aside>` is still in the DOM (for CSS-driven hidden toggle visibility). Separately, `.mobile-filters-toggle` opens `role="dialog"` bottom sheet containing `{content}` — the same JSX, so the zero-results block and its separator render identically inside the sheet. Tests verify both paths.

**Accessibility (WCAG 2.1 AA):**

- Semantic `<aside>` element.
- All form controls have associated `<label>` elements.
- `FilterGroup` uses `aria-expanded` and `aria-controls` on the toggle button; `id`/`aria-controls` pairs link headers to panels.
- Price validation error uses `role="alert"` and `aria-invalid` on the affected inputs.
- **Zero-results announcement (v7):** Wrapper `role="status" aria-live="polite"` ensures screen readers announce the narrowing-to-zero event when it happens during filter editing, without stealing focus.
- Keyboard navigation through checkboxes and inputs; ESC closes the mobile sheet.
- Nested `EmptyState` illustration is fully `aria-hidden` per WCAG 1.1.1 — title + message + CTA carry all meaning.
- All colors reference `var(--token)` (no hardcoded hex) for consistent light/dark theming.

**Usage Example:**

```tsx
<FiltersSidebar
  selectedCategories={selectedCategories}
  toggleCategory={toggleCategory}
  minPrice={minPrice}
  maxPrice={maxPrice}
  setMinPrice={setMinPrice}
  setMaxPrice={setMaxPrice}
  popularity={popularity}
  setPopularity={setPopularity}
  clearFilters={clearFilters}
  favoritesOnly={favoritesOnly}
  toggleFavoritesOnly={() => setFavoritesOnly(!favoritesOnly)}
  resultCount={filteredApis.length}  {/* v7: enables inline zero-results illustration */}
/>
```

---

### FiltersBottomSheet

Mobile-only bottom-sheet that wraps `FiltersSidebar`. Shown when the user taps the "Filters" trigger button on viewports ≤ 980 px. Rendered by `MarketplacePage` and controlled via `showFiltersMobile` state.

**Props:**

- `open: boolean` - Whether the sheet is visible
- `onClose: () => void` - Callback to close the sheet
- `resultCount: number` - Live count displayed in the footer CTA ("Show N results")
- `selectedCategories: Set<string>` — Passed through to `FiltersSidebar`
- `toggleCategory: (c: string) => void` — Passed through
- `minPrice / maxPrice / setMinPrice / setMaxPrice` — Passed through
- `popularity / setPopularity` — Passed through
- `clearFilters: () => void` — Passed through
- `favoritesOnly: boolean` — Passed through
- `toggleFavoritesOnly: () => void` — Passed through
- `triggerRef: React.RefObject<HTMLButtonElement>` - Ref to the trigger button; focus is restored to it when the sheet closes

**Snap points:**

- `"half"` (default on open) → `50vh`
- `"full"` → `92vh`
- Drag the handle area down > 60 px from `"full"` → snaps to `"half"`; drag down from `"half"` → dismisses
- Drag up > 60 px → snaps to `"full"`
- Spring transition: `280ms cubic-bezier(0.32, 0.72, 0, 1)`; disabled when `prefers-reduced-motion: reduce`

**CSS classes (index.css):**

- `.bottom-sheet__backdrop` — fixed overlay; click to close
- `.bottom-sheet` — the sheet panel; height driven by snap state
- `.bottom-sheet--half` / `.bottom-sheet--full` — semantic modifier classes
- `.bottom-sheet__handle-area` — 44 px-tall touch target for dragging
- `.bottom-sheet__handle` — visible pill indicator
- `.bottom-sheet__header` — title row with close button
- `.bottom-sheet__body` — scrollable filter content area
- `.bottom-sheet__footer` — sticky footer with the "Show N results" CTA
- `@keyframes bottom-sheet-in` — slide-up entry animation (no-preference motion only)

**Accessibility:**

- `role="dialog"` with `aria-modal="true"` and `aria-label="Filters"`
- Focus trap: Tab/Shift+Tab cycle is contained inside the sheet while open
- ESC key closes the sheet
- Focus is automatically moved into the sheet on open and restored to `triggerRef` on close
- `document.body.overflow` is locked while open to prevent background scroll
- Handle area is `aria-hidden`; close button has `aria-label="Close filters"`

**Usage Example:**

```tsx
<FiltersBottomSheet
  open={showFiltersMobile}
  onClose={() => setShowFiltersMobile(false)}
  resultCount={filtered.length}
  selectedCategories={selectedCategories}
  toggleCategory={toggleCategory}
  minPrice={minPrice}
  maxPrice={maxPrice}
  setMinPrice={setMinPrice}
  setMaxPrice={setMaxPrice}
  popularity={popularity}
  setPopularity={setPopularity}
  clearFilters={clearFilters}
  favoritesOnly={favoritesOnly}
  toggleFavoritesOnly={() => setFavoritesOnly(!favoritesOnly)}
  triggerRef={filtersTriggerRef}
/>
```

---

### NotFound

404 error page with search functionality.

**Props:**

- `onGoHome: () => void` - Callback to navigate to home

**Visual Spec:**

- Layout: Centered, `surface` class, `placeholder-card` class
- Error code: Large "404" text (clamp 4rem to 8rem)
- Heading: "Page Not Found"
- Actions: Primary and secondary buttons
- Search: Input with search button
- Links: Navigation links to main sections

**States:**

- Default: Shows error message and navigation options
- Search: Shows helper message if no match found
- Focus: Standard focus ring on all interactive elements

**Accessibility:**

- `aria-labelledby="not-found-title"` on section
- `role="search"` on search form
- `role="status"` and `aria-live="polite"` on search feedback
- Semantic heading structure

**Usage Example:**

```tsx
<NotFound onGoHome={() => navigate("/")} />
```

---

### RatingHistogram

Displays a tooltip with a 5-star rating distribution breakdown upon hovering or long-pressing the wrapped element.

**Props:**

- `rating: number` - The aggregate average rating (out of 5).
- `distribution?: Record<number, number>` - Optional object containing the count of reviews for each star (1-5). If omitted, a mock distribution is dynamically generated based on the rating.
- `children?: React.ReactNode` - The trigger element (e.g. text or icon) that the user hovers or long-presses.

**Visual Spec:**

- Layout: Overlay tooltip (`role="tooltip"`) anchored below the trigger element.
- Header: Large display of the average rating next to "out of 5".
- Rows: Flex layout for 5 to 1 stars, showing star label, progress bar, and raw count.
- Progress bar: 8px height, `var(--surface-soft)` background, with a `var(--accent)` filled area based on percentage of total reviews.

**States:**

- Hidden (Default): Tooltip is not rendered.
- Hovered (Mouse) / Long-press (Touch): Tooltip becomes visible after a short delay on touch (400ms) or instantly on mouse hover.

**Accessibility:**

- Tooltip is marked with `role="tooltip"`.
- Each row uses `aria-label` to announce the star level and number of reviews.
- Trigger handles both mouse events (`onMouseEnter`, `onMouseLeave`) and touch events (`onTouchStart`, `onTouchEnd`, `onTouchCancel`).
- Click propagation is stopped within the tooltip to prevent unintended interactions if wrapped inside a button or clickable card.

**Usage Example:**

```tsx
<RatingHistogram
  rating={4.5}
  distribution={{ 5: 100, 4: 50, 3: 10, 2: 5, 1: 0 }}
>
  <span>⭐ 4.5</span>
</RatingHistogram>
```

---

### ApiDetailStickyTOC

Sticky right-rail Table of Contents for the API Detail documentation tab.
Highlights the active section as the user scrolls using IntersectionObserver.

**Props:**

- `sections: TocSection[]` — Array of `{ id: string; label: string }` objects.
  Each `id` must match the `id` attribute of a heading element on the page.

**Visual Spec:**

- Width: 200px, positioned sticky at `top: 80px`
- Left border: `2px solid var(--line)` as a visual rail
- Heading: 11px, uppercase, `var(--muted)`
- Inactive links: `var(--muted)`, 13px, normal weight
- Active link: `var(--accent-strong)`, 600 weight
- Hover/focus: `var(--text)`
- Hidden below 1100px viewport width via CSS

**States:**

- Default: All links in muted color
- Active (scroll-tracked): Matching link uses `var(--accent-strong)` and bold weight
- Hover/Focus: Link brightens to `var(--text)`

**Accessibility:**

- `<nav aria-label="On this page">` landmark
- `aria-current="location"` on the active link
- All links are keyboard-navigable anchor links
- Hidden from print output via `.no-print`

**Usage Example:**

```tsx
const TOC: TocSection[] = [
  { id: "toc-endpoints", label: "Endpoints" },
  { id: "toc-parameters", label: "Parameters" },
  { id: "toc-implementation", label: "Implementation" },
];

<ApiDetailStickyTOC sections={TOC} />;
```

---

### SearchBar

Search input with clear button and keyboard shortcuts.

**Props:**

- `value: string` - Current search value
- `onChange: (v: string) => void` - Update search value
- `placeholder?: string` - Input placeholder (default: "Search APIs, providers, tags...")
- `onSearch?: () => void` - Callback on Enter key

**Visual Spec:**

- Layout: Flex container, 8px gap
- Input wrapper: 8px padding, 8px border-radius, `--surface-soft` background
- Icon: 18x18px search icon
- Input: Transparent background, no border
- Clear button: 16x16px X icon, appears when value exists

**States:**

- Default: Transparent border
- Focused: 2px solid `--primary` border and outline
- Has value: Clear button visible
- Hover: Clear button color changes to `--text`

**Accessibility:**

- `aria-label="Search APIs"` on input
- `aria-label="Clear search"` on clear button
- Keyboard shortcuts: Escape clears, Enter searches
- `role="search"` on container

**Usage Example:**

```tsx
<SearchBar
  value={searchQuery}
  onChange={setSearchQuery}
  onSearch={handleSearch}
/>
```

---

### ServerError

Server error display with retry functionality.

**Props:**

- `onRetry?: () => void | Promise<void>` - Retry callback (optional)
- `requestId?: string` - Request ID for support (displayed masked)
- `title?: string` - Error heading (default: "Something went wrong on our end")
- `description?: string` - Error message (default: standard copy)

**Visual Spec:**

- Layout: Centered, max-width 400px, 48px padding
- Icon: 80x80px circle with warning icon
- Heading: clamp 1.5rem to 1.8rem, 600 weight
- Retry button: Primary button, 140px min-width, 48px min-height
- Request ID: Monospace font, copy button, separator line

**States:**

- Default: Shows error message
- Retrying: Button shows "Retrying…", disabled, `aria-busy`
- Copied: Request ID button shows "Copied!" for 2s
- Focus: Retry button auto-focused on mount if onRetry provided

**Accessibility:**

- `role="alert"` on section
- `aria-busy` on retry button during retry
- `aria-live="polite"` and `aria-atomic` for copy feedback (screen reader only)
- `aria-label` on copy button
- Focus management on mount

**Usage Example:**

```tsx
<ServerError
  onRetry={fetchData}
  requestId="req_abc123"
  title="Connection failed"
  description="Unable to reach the server. Please check your connection."
/>
```

---

### Skeleton

Loading placeholder for content.

**Props:**

- `width?: string | number` - Skeleton width
- `height?: string | number` - Skeleton height
- `borderRadius?: string | number` - Border radius
- `style?: CSSProperties` - Additional inline styles
- `className?: string` - Additional CSS classes

**Visual Spec:**

- Class: `skeleton` (defined in CSS)
- Animation: Shimmer effect (defined in CSS)
- Background: Animated gradient

**States:**

- Static (no interactive states)

**Accessibility:**

- `aria-hidden` should be set by parent if used as loading indicator

**Usage Example:**

```tsx
<Skeleton width={200} height={20} borderRadius={4} />
```

---

## CSS Classes

The following utility classes are defined in `src/index.css` and should be used instead of custom styles:

### Button Classes

- `.primary-button` - Primary action button with gradient background
- `.secondary-button` - Secondary action button with border
- `.ghost-button` - Minimal button with hover effect
- `.close-button` - Dismiss/close action button
- `.danger-button` - Destructive action button

### Layout Classes

- `.surface` - Card/panel with border, radius, shadow, backdrop blur
- `.app-shell` - Main app container with padding
- `.hero-grid` - Two-column hero layout
- `.modal-grid` - Two-column modal layout

### Typography Classes

- `.brand` - Large brand heading
- `.eyebrow` - Small uppercase label
- `.helper-text` - Secondary/muted text

### Link Classes

- `.link-body` - Inline body text links. Enforces a 1px default underline (`text-decoration-thickness: 1px`) to prevent dark-mode bleed, and defines a tokenized `:visited` state using the `--visited` design token.
- `.link-nav` - Structural navigation links (headers, footers, breadcrumbs). Retains hover and focus states without standard text decoration. Includes conditional `:visited` styles targeted at documentation and support destinations.

### State Classes

- `.not-found` - 404 page container
- `.server-error` - Error page container
- `.placeholder-card` - Generic placeholder container

---

## Accessibility Guidelines

### Focus Management

All keyboard-focus styling is centralized in a single CSS cascade layer named
**`focus`**, declared in `src/index.css` as `@layer focus { … }`.

- **One ring everywhere.** Buttons, links, inputs, selects, textareas, checkboxes
  and the `.input-shell` composite share one indicator: `2px solid var(--accent)`
  at `outline-offset: 3px`. `var(--accent)` is theme-aware, so the ring meets WCAG
  2.4.7 / 1.4.11 (≥ 3:1) in both light and dark themes.
- **Keyboard only.** The ring is restored exclusively via `:focus-visible`, so
  mouse/pointer clicks never show a ring. Never style bare `:focus` for rings, and
  never set inline `outline: none` on a control — let the layer handle it.
- **Overriding intentionally.** Because layered rules rank below unlayered ones
  regardless of specificity, a component that needs a bespoke focus treatment
  (e.g. `.api-marketplace-card`, the danger/invalid input state) simply declares an
  ordinary unlayered `:focus-visible` rule, which wins without specificity hacks.
- **Never remove focus styles entirely.**

### Keyboard Navigation

- All buttons and links must be keyboard accessible
- Use semantic HTML elements (`<button>`, `<a>`, `<input>`)
- Provide keyboard shortcuts where appropriate (e.g., Escape to close modals)
- Ensure tab order follows logical reading order

### ARIA Attributes

- Use `aria-label` for icon-only buttons
- Use `aria-current="page"` for current navigation items
- Use `aria-live="polite"` for dynamic content updates
- Use `role` attributes when semantic HTML isn't sufficient
- Use `aria-busy` for loading states

### Color Contrast

- All text must meet WCAG AA contrast ratios (4.5:1 for normal text, 3:1 for large text)
- The design tokens are pre-configured to meet these standards
- Never override token colors with custom values that may violate contrast requirements

### Reduced Motion

- Theme transitions are wrapped in `@media (prefers-reduced-motion: no-preference)`
- Respect user's motion preferences
- Avoid unnecessary animations

---

## Best Practices

### When Adding New UI

1. **Check existing components first** - Reuse before creating new
2. **Use design tokens** - Never hardcode colors, spacing, or shadows
3. **Follow the component patterns** - Match existing prop interfaces and styling
4. **Test in both themes** - Verify appearance in light and dark modes
5. **Test accessibility** - Verify keyboard navigation and screen reader compatibility
6. **Document your component** - Add this file with props, states, and accessibility notes

### When Modifying Existing Components

1. **Preserve token usage** - Don't replace tokens with inline values
2. **Maintain accessibility** - Keep ARIA attributes and keyboard support
3. **Update documentation** - Keep this file in sync with your changes
4. **Test regressions** - Verify existing functionality still works

### Code Review Checklist

- [ ] No hardcoded hex colors or inline styles
- [ ] All colors use CSS custom properties (var(--token-name))
- [ ] Component uses existing CSS classes where applicable
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Focus states are visible
- [ ] ARIA attributes are present where needed
- [ ] Works in both light and dark themes
- [ ] Respects reduced motion preference
- [ ] Component is documented in this guide

---

## Keeping This Document in Sync

When you modify design tokens or components:

1. Update the relevant section in this document
2. Cross-check documented values against `src/index.css`
3. Verify component props match the implementation
4. Test the documented examples

This document should be treated as part of the codebase - keep it accurate and up-to-date.
