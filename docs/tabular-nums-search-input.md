# Tabular Numerals in SearchInput (GrantFox FWC26)

## Summary

`font-variant-numeric: tabular-nums` is applied to every amount and count
displayed in the `SearchInput` component. This ensures digits occupy a fixed,
equal-width cell so numeric values (result counts, status chip counts, monetary
amounts) do not shift surrounding layout when values update — for example, "1"
and "999" take the same horizontal space as a column.

This is part of the GrantFox FWC26 campaign (Stellar Wave) UI/UX requirement
to align digits vertically across both light and dark themes.

---

## Files changed

| File | Change |
|------|--------|
| `src/pages/SearchInput.tsx` | Applied `font-variant-numeric: tabular-nums` via inline styles and `numeric-tabular tabular-nums` CSS classes to the container, input field, result count badge, amount badge, and all status chip count spans. |
| `src/styles/typography.css` | Contains the `.numeric-tabular` / `.tabular-nums` utility classes that provide the CSS property at the class level (imported globally via `main.tsx`). |
| `src/pages/SearchInput.test.tsx` | Added focused test suite `"Tabular-nums numeric displays (#740 / b#063)"` covering all numeric display elements. |

---

## Where tabular-nums applies in SearchInput

| Element | Mechanism |
|---------|-----------|
| `.search-input-container` wrapper | `className="numeric-tabular tabular-nums"` + `style={{ fontVariantNumeric: 'tabular-nums' }}` |
| `<input>` text field | `className="search-input-field tabular-nums numeric-tabular"` + inline style |
| `search-amount-display` span | `className="search-input-amount tabular-nums numeric-tabular"` + inline style |
| `search-result-count` span | `className="search-input-result-count tabular-nums numeric-tabular"` + inline style |
| Each status filter chip `<button>` | `className="search-status-chip numeric-tabular tabular-nums …"` + inline style |
| Per-chip count span `(.search-status-chip-count)` | `className="search-status-chip-count numeric-tabular tabular-nums"` + inline style |

The container-level `fontVariantNumeric: 'tabular-nums'` provides a CSS cascade
fallback so any future numeric child added without an explicit class still
renders with tabular numerals.

---

## Implementation approach

Two complementary layers ensure consistent coverage:

1. **Inline `style={{ fontVariantNumeric: 'tabular-nums' }}`** — applied
   directly to each element that renders a number. This is the highest-specificity
   guarantee and works even if the CSS file is not loaded.

2. **CSS utility classes `numeric-tabular` / `tabular-nums`** — defined in
   `src/styles/typography.css` and imported globally. The canonical class is
   `.numeric-tabular`; `.tabular-nums` is kept as an alias for backwards
   compatibility with existing code.

This two-layer approach matches the pattern established in `ApiCard`,
`ApiDetailPage`, `ApiUsage`, and `MarketplacePage`.

---

## CSS utility

Defined in `src/styles/typography.css`, imported globally via `src/main.tsx`:

```css
.numeric-tabular,
.tabular-nums {
  font-variant-numeric: tabular-nums;
}
```

Use `.numeric-tabular` for new code (canonical name). `.tabular-nums` is a
backwards-compatible alias only.

---

## Props that render numeric values

| Prop | Rendered as | Example output |
|------|-------------|----------------|
| `resultCount?: number` | `"N result(s)"` badge | `24 results` |
| `totalCount?: number` | Drives `"all"` chip count | `(48)` |
| `amount?: number` | Dollar-formatted amount badge | `$1,250` |
| `statusCounts?: Partial<Record<SearchStatusFilter, number>>` | Per-chip count `(N)` | `(36)` next to "Operational" |

---

## Tests

Test suite `"Tabular-nums numeric displays (#740 / b#063)"` in
`src/pages/SearchInput.test.tsx` verifies:

| Test | What it checks |
|------|----------------|
| `applies tabular-nums and numeric-tabular CSS classes to container and status chips` | `.search-input-container` has both classes; each status chip button has both classes and the inline style. |
| `renders numeric status counts with tabular-nums formatting when statusCounts is provided` | `statusCounts` prop causes `(N)` spans to render with `tabular-nums` class and inline style. |
| `renders resultCount readout with tabular-nums styling` | `resultCount` badge has correct text, classes, and inline style. |
| `renders amount display with tabular-nums styling` | `amount` badge has correct text (`$1,250`), classes, and inline style. |

Run with:

```bash
npx vitest run src/pages/SearchInput.test.tsx
```

All 14 tests (including 4 tabular-nums focused tests) pass.

---

## Accessibility notes

`font-variant-numeric: tabular-nums` is a font rendering hint only. It does
not affect content, semantics, or ARIA attributes, so there is no WCAG impact.
The visual benefit is that columns of numbers stay horizontally stable as
values change, reducing cognitive load for users scanning live-updating counts.

The status chips remain fully accessible:
- `role="button"` with `aria-pressed` for toggle state
- `aria-label` includes the count when `statusCounts` is provided
- `aria-description` explains the colour-blind-safe pattern texture used on each chip

---

## Browser support

`font-variant-numeric: tabular-nums` is supported in all modern browsers
(Chrome 21+, Firefox 34+, Safari 9.1+, Edge 79+). On browsers that do not
support it the property is silently ignored and proportional numerals are used
— no regression in layout or semantics.

---

## Related

- `docs/tabular-nums-marketplace.md` — same FWC26 change applied to `MarketplacePage`
- `src/styles/typography.css` — shared CSS utility definitions
- `src/pages/SearchInput.tsx` — component source
