# PricingTable — Keyboard Shortcut Hint Chip

Implements issue **#944** (`b#090`, GrantFox FWC26 campaign): show a subtle
keyboard shortcut hint chip on `PricingTable` for the primary action.

## Summary of Changes

The recommended pricing tier's primary action (its CTA button) now advertises
the `S` shortcut with a subtle chip rendered directly beneath the button, in
both the desktop grid and the mobile card layout.

| Area | Change |
| --- | --- |
| `src/pages/PricingTable.tsx` | Unchanged — re-exports `PricingTierTable`, which holds the implementation. |
| `src/components/PricingTierTable.tsx` | Hint now uses `KbdHint` with `variant="chip"`; recommended CTA gained `aria-keyshortcuts="s"`; shortcut handler ignores modifier combos. |
| `src/components/KbdHint.tsx` | Unchanged — the existing `chip` variant is reused as-is. |
| `src/index.css` | Added `.pricing-tier-card__kbd-hint` placement + responsive rules. |
| `src/styles/contrast.css` | Added `prefers-contrast: more` overrides for `.kbd-hint--chip`. |

### Before / after

The hint previously rendered via `KbdHint`'s **default** variant, which is a
right-aligned `<aside>` list intended for sidebars, and passed an unsupported
`style` prop (a TypeScript error). It is now the intended compact chip:

```diff
-<KbdHint shortcuts={PRIMARY_SHORTCUT} style={{ padding: 0 }} />
+<KbdHint
+  shortcuts={PRIMARY_SHORTCUT}
+  variant="chip"
+  label="Keyboard shortcut to select the recommended plan"
+/>
```

## Visible Behaviour

- A pill reading `S  Select recommended plan` appears under the recommended
  tier's CTA button — and **only** that tier's button.
- Pressing <kbd>S</kbd> (or <kbd>Shift</kbd>+<kbd>S</kbd>) invokes
  `onSelectTier` with the recommended tier, matching the CTA click.
- The shortcut is inert while focus is in an `<input>`, `<textarea>`, or any
  `contenteditable` element.
- Modified presses (<kbd>Ctrl</kbd>/<kbd>Cmd</kbd>/<kbd>Alt</kbd> + <kbd>S</kbd>)
  are ignored, so browser shortcuts such as "Save page" keep working.
- If no tier sets `isRecommended`, no chip and no shortcut are exposed.

## API

No breaking changes. `PricingTierTable` props are unchanged:

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `tiers` | `PricingTier[]` | — | Tiers to render. The tier with `isRecommended: true` receives the shortcut chip. |
| `onSelectTier` | `(tier: PricingTier) => void` | `undefined` | Fired on CTA click, and on <kbd>S</kbd> for the recommended tier. |

The chip is internal — it is driven by the `PRIMARY_SHORTCUT` constant in
`PricingTierTable.tsx` and is not configurable via props.

## Styling & Design Tokens

Placement lives in `src/index.css`:

```css
.pricing-tier-card__kbd-hint {
  display: flex;
  justify-content: center;
  margin-top: var(--mkt-space-md);
}
```

Colour and shape come entirely from the shared `.kbd-hint--chip` rules, so the
chip inherits `--surface-soft`, `--surface-strong`, `--line`, `--line-strong`,
and `--muted`. Because every value is a design token, **dark mode needs no
extra rules** — the chip follows the active theme automatically.

### Responsive

| Breakpoint | Behaviour |
| --- | --- |
| > 768 px | Desktop grid; chip centred under the full-width CTA. |
| ≤ 768 px | Mobile card layout (`.pricing-tiers-mobile`); chip still centred under the CTA. |
| ≤ 480 px | Tighter `margin-top`, smaller chip padding and font size to preserve vertical rhythm. |

## Accessibility (WCAG 2.1 AA)

- **1.4.3 Contrast / 1.4.11 Non-text Contrast** — chip text uses `--muted` on
  `--surface-soft` with a tokenised border. Under `prefers-contrast: more`,
  `src/styles/contrast.css` promotes the text to `--text` and thickens both the
  chip and key-cap borders.
- **1.3.1 Info and Relationships** — the key is marked up as a real `<kbd>`
  element, and the chip's text ("S Select recommended plan") is plain visible
  text read in DOM order right after the button it describes.
  Note: `KbdHint` also sets `aria-label` on its container, but for the `chip`
  variant that container is a `<span>` (`role=generic`), and ARIA prohibits
  naming on generic roles — so that label is **not** exposed to assistive tech.
  It is harmless, and the accessible information comes from the visible text
  plus `aria-keyshortcuts` below; do not rely on the `aria-label` alone.
- **4.1.2 Name, Role, Value** — the recommended CTA exposes
  `aria-keyshortcuts="s"` (lowercase, per the WAI-ARIA attribute's key-name
  grammar), so assistive tech announces the shortcut on the control itself
  rather than relying on adjacent text.
- **1.4.4 Resize Text / 1.4.10 Reflow** — chip sizing uses relative `rem` font
  sizes and wraps inside the card at 320 px.
- **Listener hygiene** — the `keydown` listener is removed on unmount (covered
  by a test).

### Known deviation: 2.1.4 Character Key Shortcuts

The <kbd>S</kbd> shortcut is a single-character shortcut bound at the `window`
level, which SC 2.1.4 (Level A) asks to be remappable, switchable off, or
active only on focus. Today it is only suppressed while a form field is
focused. This matches the existing repo-wide convention for single-key
shortcuts (`/`, `c`, `u`, `?`), so it was left consistent rather than changed
unilaterally here — see the note in the pull request. A repo-wide fix (a
shortcuts preference, or scoping handlers to focus) should be tracked
separately.

## Tests

`src/components/PricingTierTable.test.tsx` — the `shortcut hint chip` suite
covers: chip variant (not the `<aside>` list), accessible label, chip present
only on the recommended tier, absence when nothing is recommended,
`aria-keyshortcuts` placement, the mobile layout, modifier-key rejection,
uppercase `S`, and listener cleanup on unmount.

```bash
npx vitest run src/components/PricingTierTable.test.tsx
```
