# Tabular Numerals in MarketplacePage (GrantFox FWC26)

## What changed

`font-variant-numeric: tabular-nums` is now applied to every amount and count
displayed in the Marketplace page. This causes each digit to occupy a fixed,
equal-width cell (the same width as the widest glyph, typically "0") so digit
columns stay visually aligned even when values change — e.g., "1" and "9" no
longer shift surrounding text when the result count updates.

## Files modified

| File | Change |
|------|--------|
| `src/styles/typography.css` | Added `.marketplace-count` and `.marketplace-filter-badge` container rules so tabular-nums cascades to all descendants. |
| `src/pages/MarketplacePage.tsx` | Added `numeric-tabular` class to the `<span>` that renders the active-filter badge count (`activeFilterCount`). |
| `src/main.tsx` | Removed a duplicate `import "./styles/typography.css"` (no functional change). |

## Approach

The implementation uses two complementary layers:

1. **Span-level class** (canonical) — individual `<span className="numeric-tabular">` wrappers around each standalone numeric value inside `.marketplace-count`. This is the primary mechanism. It mirrors the pattern used in `ApiCard`, `ApiDetailPage`, and `ApiUsage`.

2. **Container-level CSS rule** (belt-and-suspenders) — `.marketplace-count { font-variant-numeric: tabular-nums; }` in `typography.css`. Any future numeric child that is added without the explicit class will still inherit the correct rendering.

3. **Filter badge** — `<span class="marketplace-filter-badge numeric-tabular">` ensures the digit inside the orange pill button (shown on mobile when filters are active) also uses tabular numerals.

## CSS utility classes

Defined in `src/styles/typography.css` and imported globally via `main.tsx`:

```css
.numeric-tabular,
.tabular-nums {
  font-variant-numeric: tabular-nums;
}
```

Use `.numeric-tabular` for new code (canonical). `.tabular-nums` is kept as a backwards-compatible alias.

## Where tabular-nums applies in the Marketplace

| Element | Mechanism |
|---------|-----------|
| `startItem` (page range start) | `<span class="numeric-tabular">` |
| `endItem` (page range end) | `<span class="numeric-tabular">` |
| `filtered.length` (total match count) | `<span class="numeric-tabular">` |
| "0 of 0" empty state | `<span class="numeric-tabular">` |
| `activeFilterCount` badge | `<span class="marketplace-filter-badge numeric-tabular">` |
| Any future numeric child of `.marketplace-count` | Inherited via container CSS rule |

## Tests

New test suite `"MarketplacePage tabular-nums (FWC26)"` in
`src/pages/MarketplacePage.test.tsx` covers:

- Count bar: every visible digit is wrapped in `.numeric-tabular`
- Count bar: all `.numeric-tabular` spans contain only digit characters
- Count bar: two "0" spans when no search results
- Count bar: `.marketplace-count` container exists (verifying the inheritance target)
- Filter badge: carries `.numeric-tabular` class when active
- Filter badge: `aria-label` attribute is present and descriptive

## Accessibility

`font-variant-numeric: tabular-nums` is a font rendering hint only — it does
not change content, semantics, or ARIA attributes. No WCAG impact. The
`aria-label` on the filter badge already conveyed the count as a complete
sentence (e.g., "2 active filters") before this change; that label is
unchanged.

## Browser support

`font-variant-numeric: tabular-nums` has full support in all modern browsers
(Chrome 21+, Firefox 34+, Safari 9.1+, Edge 79+). No polyfill is needed.
On browsers that do not support it, the property is silently ignored and the
original proportional numerals are used — no visible regression.
