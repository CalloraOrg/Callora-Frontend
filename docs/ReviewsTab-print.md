# ReviewsTab Print Support

Campaign: **GrantFox FWC26**
Ticket type: UI/UX
Status: Shipped

---

## What this change does

When a user prints the API Detail page while viewing the **Reviews** tab, the print output now:

1. **Hides chrome controls** — the "Sort by" dropdown and "Write a Review" button are suppressed with `display: none !important` via the existing `.no-print` mechanism. Neither element is meaningful on paper.
2. **Expands all review cards** — every `.preview-card` inside the reviews section is forced to `display: block`, `max-height: none`, `overflow: visible` so no review body text is clipped.
3. **Expands collapsible regions** — any element using `aria-hidden="true"`, `[hidden]`, or `<details>` that may exist inside the reviews panel is forced open so nothing is silently omitted from the printed page.
4. **Single-column layout** — the `.reviews-list` grid is forced to `grid-template-columns: 1fr` for predictable paper width usage.
5. **Page-break avoidance** — each review card carries `break-inside: avoid` so a card is not split across page boundaries.

The **light-theme override** and general **chrome hiding** (`topbar`, tabs, sidebar, hero CTAs) are handled by the existing `@media print` block already present in `index.css` and are unaffected by this change.

---

## Files changed

| File | Change |
|---|---|
| `src/pages/ApiDetailPage.tsx` | Added `reviews-sort-controls no-print` class to the sort-by row; added `no-print` to the Write a Review button; added `data-reviews-section` attribute to the reviews `<section>`; added `reviews-list` class to the review cards grid |
| `src/index.css` | Extended the existing `@media print` block with ReviewsTab-specific rules under `[data-reviews-section]` |
| `src/pages/ReviewsTab.print.test.ts` | New file — 13 contract tests covering markup and CSS |

No new files were added to `src/styles/`. The existing project contract (`src/print.test.ts`) asserts that `main.tsx` must not import a `print.css` file; all print styles live in `src/index.css`.

---

## How it works

### Markup anchors (ApiDetailPage.tsx)

```tsx
{/* Section anchor — CSS scopes to this */}
<section
  id="panel-reviews"
  role="tabpanel"
  aria-labelledby="tab-reviews"
  tabIndex={0}
  data-reviews-section   {/* ← new */}
>
  <div className="api-detail-reviews-header">
    <h3>Developer Feedback</h3>
    {/* Hidden on print — interaction not possible on paper */}
    <button className="secondary-button no-print">Write a Review</button>
  </div>

  {/* ... rating histogram (visible on print) ... */}

  {/* Hidden on print — sort order irrelevant on paper */}
  <div className="reviews-sort-controls no-print">
    <label htmlFor="review-sort">Sort by</label>
    <select id="review-sort">…</select>
  </div>

  {/* Print-expanded grid */}
  <div className="reviews-list">
    {sortedReviews.map(…)}
  </div>
</section>
```

### CSS rules (index.css, inside `@media print`)

```css
/* ── ReviewsTab: hide chrome, expand collapsibles (FWC26) ──── */

/* Expand every review card */
[data-reviews-section] .preview-card {
  display: block !important;
  overflow: visible !important;
  max-height: none !important;
  height: auto !important;
}

/* Expand aria-hidden collapsible regions */
[data-reviews-section] [aria-hidden="true"] {
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  max-height: none !important;
  height: auto !important;
  overflow: visible !important;
}

/* Expand <details> elements */
[data-reviews-section] details { display: block !important; }
[data-reviews-section] details > * { display: block !important; }

/* Expand [hidden] elements */
[data-reviews-section] [hidden] { display: block !important; }

/* Rating histogram — no overflow clip */
[data-reviews-section] .rating-histogram,
[data-reviews-section] .rating-histogram__bar-track,
[data-reviews-section] .rating-histogram__bar-fill {
  overflow: visible !important;
  max-width: 100% !important;
}

/* Single-column list */
[data-reviews-section] .reviews-list {
  display: grid !important;
  grid-template-columns: 1fr !important;
  gap: 16px !important;
}

/* Avoid splitting a review card across a page break */
[data-reviews-section] .preview-card {
  break-inside: avoid !important;
  page-break-inside: avoid !important;
}
```

> **Why `[data-reviews-section]` as the scope selector?**
> A data-attribute selector is immune to CSS specificity collisions from class-based resets elsewhere in the `@media print` block. It also serves as clear self-documentation in the markup.

---

## Testing

Run the focused test suite:

```bash
npm test -- --run src/pages/ReviewsTab.print.test.ts
```

All 13 tests should pass. The existing `src/print.test.ts` (10 tests) also continues to pass.

### What the tests cover

| Test group | Tests |
|---|---|
| **Markup: no-print chrome** | Sort controls wrapper has `reviews-sort-controls no-print`; Write a Review button has `no-print`; section has `data-reviews-section`; grid has `reviews-list` |
| **CSS: expansion rules** | Review cards expand (`display: block`, `max-height: none`); `aria-hidden` regions expand; `<details>` expand; `[hidden]` expand; single-column layout; page-break avoidance; rules are inside `@media print` |
| **Import guard** | `main.tsx` does not import a `print.css` file |

---

## Accessibility notes

- The `data-reviews-section` attribute is not exposed in the accessibility tree and has no effect on screen reader behaviour.
- The `no-print` class uses `display: none !important` only inside `@media print`, so all controls remain fully keyboard-accessible in the normal viewing context.
- The single-column print layout maintains left-to-right reading order without requiring any additional ARIA markup.

---

## Design token compliance

All `@media print` rules use absolute values (`#f5f7fa`, `#1a2332`, `1fr`, etc.) because the intent is to override any token-based dark theme and force a legible light appearance. This matches the pattern established by the existing print block above. No tokens are used in print context — this is intentional and consistent with the rest of the file.

---

## Browser notes

`break-inside: avoid` / `page-break-inside: avoid` is supported by all modern browsers. `max-height: none` overrides any inline-style or class-based collapse pattern that sets a pixel height. If a future collapsible inside the reviews section uses a CSS `transition` on `height`, the `height: auto !important` rule will override it since `@media print` transitions are ignored by all major browsers.
