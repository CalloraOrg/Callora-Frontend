# Dropdown

`src/components/Dropdown.tsx`

A fully-accessible, keyboard-navigable dropdown implementing the
[WAI-ARIA 1.2 Combobox / Listbox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/).

---

## Why a custom Dropdown?

Native `<select>` elements are not stylable across browsers and do not expose the
listbox as a focusable, arrow-navigable surface. The `Dropdown` primitive fills
that gap while keeping every accessibility requirement intact.

---

## Keyboard behaviour

| Key | Action |
|-----|--------|
| `Space` / `Enter` / `↓` / `↑` on trigger | Opens the listbox |
| `↓` (ArrowDown) | Moves active focus to the **next** enabled option (wraps to first) |
| `↑` (ArrowUp) | Moves active focus to the **previous** enabled option (wraps to last) |
| `Home` | Moves active focus to the **first** enabled option |
| `End` | Moves active focus to the **last** enabled option |
| `Enter` | **Commits** the focused option and closes the listbox |
| `Escape` | Closes the listbox **without** selecting; returns focus to trigger |
| `Tab` | Closes the listbox (natural browser focus move) |

Disabled options are **skipped** during keyboard navigation.

---

## ARIA mapping

| Element | Role | Key attributes |
|---------|------|----------------|
| Trigger `<button>` | `combobox` | `aria-haspopup="listbox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, `aria-label`, `aria-disabled` |
| List `<ul>` | `listbox` | `aria-label` |
| Each option `<li>` | `option` | `aria-selected`, `aria-disabled`, `id` |

---

## API

```tsx
import { Dropdown, type DropdownOption, type DropdownProps } from "./Dropdown";
```

### `DropdownOption<T>`

```ts
interface DropdownOption<T extends string = string> {
  value: T;       // machine-readable value
  label: string;  // human-readable display text
  disabled?: boolean;
}
```

### `DropdownProps<T>`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `T` | ✅ | Currently selected value |
| `options` | `DropdownOption<T>[]` | ✅ | List of selectable options |
| `onChange` | `(value: T) => void` | ✅ | Called on commit |
| `label` | `string` | ✅ | Accessible label for the listbox (read by screen readers) |
| `visibleLabel` | `string \| null` | | Rendered text label before the trigger. Pass `null` to omit entirely |
| `id` | `string` | | HTML `id` for the trigger button |
| `className` | `string` | | Extra class name on the root wrapper |
| `disabled` | `boolean` | | Disables the entire widget (`false` by default) |
| `placeholder` | `string` | | Trigger text when no option matches `value` (`"Select…"` default) |

---

## Usage examples

### Basic usage

```tsx
import { Dropdown } from "./Dropdown";

const OPTIONS = [
  { value: "popularity", label: "Popularity" },
  { value: "newest",     label: "Newest" },
];

<Dropdown
  value={sort}
  options={OPTIONS}
  onChange={setSort}
  label="Sort results"
  visibleLabel="Sort by"
/>
```

### With disabled option

```tsx
<Dropdown
  value={tier}
  options={[
    { value: "free",  label: "Free" },
    { value: "pro",   label: "Pro", disabled: true },
    { value: "team",  label: "Team" },
  ]}
  onChange={setTier}
  label="Select plan"
/>
```

### No visible label (icon-driven trigger context)

```tsx
<Dropdown
  value={lang}
  options={LANGUAGES}
  onChange={setLang}
  label="Select language"
  visibleLabel={null}
/>
```

---

## Consumers

| Component | Usage |
|-----------|-------|
| `SortDropdown.tsx` | Wraps `Dropdown` for marketplace sort |
| `FiltersSidebar.tsx` | Popularity filter (replaces plain `<select>`) |

---

## Tests

`src/components/Dropdown.test.tsx` — 22 focused tests covering:

- ARIA attribute correctness (`role`, `aria-haspopup`, `aria-expanded`,
  `aria-controls`, `aria-activedescendant`, `aria-selected`, `aria-disabled`)
- Open / close via click and keyboard
- Mouse selection and disabled-option guard
- Full arrow-key navigation with boundary wrapping
- `Home` / `End` keys
- `Enter` commit, `Escape` cancel
- Disabled-option skipping during keyboard navigation
- Outside-click closure
- Fully-disabled widget

Run with:

```bash
npx vitest run src/components/Dropdown.test.tsx
```

---

## Design tokens used

| Token | Purpose |
|-------|---------|
| `--surface-soft` | Trigger background |
| `--surface-strong` | Listbox background |
| `--line` | Trigger border (closed) |
| `--line-strong` | Listbox border |
| `--accent` | Focus ring, active option highlight, selected text |
| `--text` | Option text |
| `--muted` | Visible label text |
| `--shadow` | Listbox drop-shadow |
| `--radius-md` | Trigger border-radius |
