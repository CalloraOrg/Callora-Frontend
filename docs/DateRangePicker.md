# DateRangePicker

`src/components/DateRangePicker.tsx`

An accessible, responsive custom date range picker component supporting quick time presets (`24h`, `7d`, `30d`) and custom date selection without third-party dependencies.

---

## Why a custom DateRangePicker?

Standard date range pickers often rely on heavy external dependencies or lack out-of-the-box WCAG 2.1 AA compliance, design-token consistency, and dark-mode support. `DateRangePicker` provides standard date ranges and custom range inputs adhering strictly to Callora's UI design system.

---

## Accessibility & Keyboard behaviour

- **Fieldset & Legend**: Wraps presets and custom controls in a semantic `<fieldset>` and `<legend>` for screen reader context.
- **Radio Group Pattern**: Presets are grouped with `role="radiogroup"` and accessible via standard keyboard navigation (`Tab`, `Space`, `Arrow` keys).
- **Native Date Inputs**: Uses HTML5 `<input type="date">` for native mobile/desktop browser picker accessibility and platform ergonomics.
- **Validation Announcements**: Dynamically sets `aria-invalid="true"` and announces validation errors (such as start date after end date) using `role="alert"`.
- **Focus Indicators**: Includes high-contrast focus indicators using the `--focus-ring` design token.

---

## ARIA mapping

| Element | Role / Tag | Key attributes |
|---------|------------|----------------|
| Root Container | `<fieldset>` | `aria-label`, `disabled` |
| Presets Group | `role="radiogroup"` | `aria-label` |
| Preset Input | `<input type="radio">` | `name`, `value`, `checked`, `id` |
| Custom Date Input | `<input type="date">` | `id`, `value`, `min`, `max`, `aria-invalid`, `aria-describedby` |
| Error Message | `role="alert"` | `id` |

---

## API

```tsx
import DateRangePicker, {
  type DateRange,
  type DateRangePickerProps,
  type DateRangePreset,
} from './DateRangePicker';
```

### `DateRangePreset`

```ts
type DateRangePreset = '24h' | '7d' | '30d' | 'custom';
```

### `DateRange`

```ts
interface DateRange {
  preset: DateRangePreset;
  from?: Date;
  to?: Date;
}
```

### `DateRangePickerProps`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `selectedRange` | `DateRange` | ✅ | Currently selected range state |
| `onChange` | `(range: DateRange) => void` | ✅ | Callback fired when selection or dates change |
| `label` | `string` | `"Time range"` | Accessible label for the picker control |
| `minDate` | `Date` | `undefined` | Minimum selectable date constraint |
| `maxDate` | `Date` | `undefined` | Maximum selectable date constraint |
| `disabled` | `boolean` | `false` | Disables all interactions |
| `className` | `string` | `""` | Additional CSS class for container wrapper |
| `id` | `string` | `auto-generated` | Base ID prefix for element accessibility attributes |

---

## Usage Examples

### Basic Usage with Presets

```tsx
import { useState } from 'react';
import DateRangePicker, { DateRange } from './components/DateRangePicker';

export const AnalyticsHeader = () => {
  const [range, setRange] = useState<DateRange>({ preset: '7d' });

  return (
    <DateRangePicker
      selectedRange={range}
      onChange={setRange}
      label="Filter analytics by date"
    />
  );
};
```

### With Custom Date Boundaries

```tsx
<DateRangePicker
  selectedRange={range}
  onChange={setRange}
  minDate={new Date(2025, 0, 1)}
  maxDate={new Date()}
/>
```

---

## Design tokens used

| Token | Purpose |
|-------|---------|
| `--surface-soft` | Preset container background |
| `--surface-strong` | Input background |
| `--line` | Input & container borders |
| `--text` | Primary text color |
| `--muted` | Field labels & unselected preset text |
| `--accent` | Selected preset pill background & focus border |
| `--danger` | Error border & text color |
| `--focus-ring` | High-contrast keyboard focus indicators |
| `--radius-md` | Container border radius |
