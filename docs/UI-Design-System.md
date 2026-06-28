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

| Token | Value | Purpose |
|-------|-------|---------|
| `--font-family` | `'Space Grotesk', 'Segoe UI', sans-serif` | Primary typeface for all text |
| `--radius-xl` | `28px` | Extra-large border radius (cards, modals) |
| `--radius-lg` | `20px` | Large border radius (sections, panels) |
| `--radius-md` | `16px` | Medium border radius (buttons, inputs) |
| `--transition-speed` | `240ms` | Standard animation duration |
| `--focus-ring` | `0 0 0 3px rgba(78, 133, 255, 0.55)` | Focus indicator for keyboard navigation |
| `--focus-ring-offset` | `0 0 0 5px rgba(78, 133, 255, 0.55)` | Extended focus ring for better visibility |

### Color Tokens

#### Dark Theme Values

| Token | Value | Usage |
|-------|-------|-------|
| `--page-bg` | `#0b1020` | Main page background |
| `--surface` | `rgba(14, 20, 39, 0.86)` | Card/panel backgrounds with transparency |
| `--surface-strong` | `rgba(17, 24, 46, 0.96)` | High-opacity surfaces (modals, overlays) |
| `--surface-soft` | `rgba(255, 255, 255, 0.04)` | Subtle backgrounds (hover states, inputs) |
| `--line` | `rgba(169, 184, 255, 0.16)` | Standard borders and dividers |
| `--line-strong` | `rgba(169, 184, 255, 0.28)` | Emphasized borders |
| `--text` | `#f3f5fb` | Primary text color |
| `--muted` | `#93a0bf` | Secondary text, labels, metadata |
| `--accent` | `#4e85ff` | Primary brand color, links, active states |
| `--accent-strong` | `#1ed6a4` | Success states, highlights, CTAs |
| `--danger` | `#ff7d8d` | Error states, destructive actions |
| `--success` | `#73f2bb` | Success messages, confirmations |
| `--shadow` | `0 24px 80px rgba(3, 8, 22, 0.45)` | Card and modal shadows |
| `--ambient-a` | `rgba(78, 133, 255, 0.22)` | Ambient glow effect (blue) |
| `--ambient-b` | `rgba(30, 214, 164, 0.18)` | Ambient glow effect (green) |
| `--backdrop` | `rgba(4, 8, 18, 0.76)` | Modal backdrop overlay |
| `--modal-bg` | `linear-gradient(180deg, rgba(20, 27, 50, 0.98), rgba(12, 18, 34, 0.98))` | Modal background gradient |

#### Light Theme Values

| Token | Value | Usage |
|-------|-------|-------|
| `--page-bg` | `#f5f7fa` | Main page background |
| `--surface` | `#ffffff` | Card/panel backgrounds |
| `--surface-strong` | `rgba(255, 255, 255, 0.92)` | High-opacity surfaces |
| `--surface-soft` | `rgba(0, 0, 0, 0.06)` | Subtle backgrounds |
| `--line` | `rgba(0, 0, 0, 0.8)` | Standard borders and dividers |
| `--line-strong` | `rgba(0, 0, 0, 0.12)` | Emphasized borders |
| `--text` | `#1a2332` | Primary text color |
| `--muted` | `#64748b` | Secondary text, labels, metadata |
| `--accent` | `#2563eb` | Primary brand color, links, active states |
| `--accent-strong` | `#059669` | Success states, highlights, CTAs |
| `--danger` | `#dc2626` | Error states, destructive actions |
| `--success` | `#10b981` | Success messages, confirmations |
| `--shadow` | `0 12px 40px rgba(78, 133, 255, 0.1)` | Card and modal shadows |
| `--ambient-a` | `rgba(78, 133, 255, 0.08)` | Ambient glow effect (blue) |
| `--ambient-b` | `rgba(30, 214, 164, 0.06)` | Ambient glow effect (green) |
| `--backdrop` | `rgba(255, 255, 255, 0.8)` | Modal backdrop overlay |
| `--modal-bg` | `linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 255, 0.98))` | Modal background gradient |

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
<ApiCard 
  api={apiData} 
  onViewDetails={(api) => navigate(`/api/${api.id}`)} 
/>
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
- Keyboard navigation with Enter/Space
- Custom focus management (onFocus/onBlur)

**Usage Example:**
```tsx
<Breadcrumb 
  items={[
    { label: "Home", href: "/" },
    { label: "Marketplace", href: "/marketplace" },
    { label: "API Details", isCurrent: true }
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
    javascript: "fetch('https://api.callora.com/v1/endpoint')"
  }}
  defaultLanguage="bash"
/>
```

---

### EmptyState

Displayed when no results are found (e.g., empty search results).

**Props:**
- `title?: string` - Heading text (default: "No APIs found")
- `message?: string` - Subtitle text (default: "Try adjusting your filters")

**Visual Spec:**
- Layout: Centered, 32px padding
- Icon: 160px width, SVG illustration with low opacity
- Heading: `h3` element, no margin
- Message: `--muted` color, 8px top margin

**States:**
- Static (no interactive states)

**Accessibility:**
- Semantic heading structure
- Uses `--muted` token for secondary text

**Usage Example:**
```tsx
<EmptyState 
  title="No results found" 
  message="Try different search terms" 
/>
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

Sidebar for filtering marketplace results.

**Props:**
- `selectedCategories: Set<string>` - Currently selected categories
- `toggleCategory: (c: string) => void` - Toggle category selection
- `minPrice: number | null` - Minimum price filter
- `maxPrice: number | null` - Maximum price filter
- `setMinPrice: (v: number | null) => void` - Set minimum price
- `setMaxPrice: (v: number | null) => void` - Set maximum price
- `popularity: string` - Popularity sort option
- `setPopularity: (p: string) => void` - Set popularity sort
- `clearFilters: () => void` - Reset all filters

**Visual Spec:**
- Layout: Vertical sections with 12px margin
- Categories: Checkbox list, 8px gap
- Price range: Two number inputs side-by-side
- Popularity: Select dropdown
- Clear button: Ghost button style

**States:**
- Default: All filters visible
- Checked: Checkbox shows selected state
- Focused: Standard focus ring on inputs

**Accessibility:**
- Semantic `<aside>` element
- Labels for all form controls
- Keyboard navigation through checkboxes

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
<RatingHistogram rating={4.5} distribution={{ 5: 100, 4: 50, 3: 10, 2: 5, 1: 0 }}>
  <span>⭐ 4.5</span>
</RatingHistogram>
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
