# FiltersSidebar — Mobile Bottom Sheet

Summary
- Adds a mobile bottom-sheet dialog for `FiltersSidebar` to improve UX on small screens.

Behavior
- The sidebar now exposes a mobile toggle (`.mobile-filters-toggle`) which opens a bottom-sheet dialog (`role="dialog"`, `aria-modal="true"`, `id="filters-sheet"`).
- The same filter controls (Categories, Price range, Popularity, Favorites, Clear) are rendered inside the dialog on mobile and in-place on larger viewports.
- When the sheet opens it focuses the Close button and closes on `Escape` or backdrop click.

Accessibility
- Dialog uses `role="dialog"` and `aria-modal="true"` with an accessible label.
- Each filter group is wrapped with `FilterGroup` which exposes an accessible header button and an associated panel with `aria-controls` and `hidden` toggling.
- Price inputs include `aria-label` attributes and an inline validation alert (role="alert") when min &gt; max.

API / Visible changes
- `FiltersSidebar` props remain the same. No runtime API changes required.
- New CSS hook classes available for styling:
  - `.mobile-filters-toggle` — the mobile toggle button
  - `.filters-sheet-overlay` — overlay/backdrop
  - `.filters-sheet` — sheet container

Testing
- Focused unit tests added in `src/components/FiltersSidebar.test.tsx` covering the mobile sheet open/close flow, price validation, collapse persistence, and clear action.

Notes
- The component renders the same content twice (sheet + sidebar) when the sheet is open; the app's CSS should control visibility for the toggle at different breakpoints. Tests handle the presence of both copies by scoping queries to the dialog when necessary.

If you want, I can also:
- Add CSS styles in `styles/` to provide a default bottom-sheet appearance.
- Create a PR with these changes and the test output attached.
