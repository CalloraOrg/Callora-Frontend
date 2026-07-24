import React, { useId } from 'react';
import './DateRangePicker.css';

/**
 * Supported date range preset options.
 */
export type DateRangePreset = '24h' | '7d' | '30d' | 'custom';

/**
 * Date range object containing the selected preset and optional custom start and end dates.
 */
export interface DateRange {
  preset: DateRangePreset;
  from?: Date;
  to?: Date;
}

/**
 * Props for the DateRangePicker component.
 */
export interface DateRangePickerProps {
  /** Currently selected date range object */
  selectedRange: DateRange;
  /** Callback fired when the selected preset or custom dates change */
  onChange: (range: DateRange) => void;
  /** Accessible label for the picker (defaults to "Time range") */
  label?: string;
  /** Optional minimum selectable date */
  minDate?: Date;
  /** Optional maximum selectable date */
  maxDate?: Date;
  /** Disable the entire date range picker */
  disabled?: boolean;
  /** Additional CSS class name for the wrapper element */
  className?: string;
  /** Unique ID prefix for accessibility associations */
  id?: string;
}

/**
 * Helper to format a Date object into a YYYY-MM-DD string for HTML date inputs.
 */
const formatDateForInput = (date?: Date): string => {
  if (!date || isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Helper to parse a YYYY-MM-DD string into a Date object at start of day.
 */
const parseInputToDate = (value: string): Date | undefined => {
  if (!value) return undefined;
  const parts = value.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return undefined;
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return isNaN(date.getTime()) ? undefined : date;
};

/**
 * Accessible custom date range picker component.
 * Supports quick presets ('24h', '7d', '30d') and a custom date range with start/end date selectors.
 * Fully keyboard operable, responsive, and WCAG 2.1 AA compliant.
 */
export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  selectedRange,
  onChange,
  label = 'Time range',
  minDate,
  maxDate,
  disabled = false,
  className = '',
  id: customId,
}) => {
  const generatedId = useId();
  const baseId = customId || `date-range-picker-${generatedId}`;
  const radioGroupName = `${baseId}-preset-group`;
  const fromInputId = `${baseId}-from`;
  const toInputId = `${baseId}-to`;
  const errorId = `${baseId}-error`;

  const presets: { label: string; value: DateRangePreset }[] = [
    { label: '24h', value: '24h' },
    { label: '7d', value: '7d' },
    { label: '30d', value: '30d' },
    { label: 'Custom', value: 'custom' },
  ];

  const handlePresetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const preset = e.target.value as DateRangePreset;
    if (disabled) return;

    if (preset !== 'custom') {
      const now = new Date();
      let from: Date;
      if (preset === '24h') {
        from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      } else if (preset === '7d') {
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else {
        // 30d
        from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      onChange({ preset, from, to: now });
    } else {
      // Retain existing custom from/to if present, otherwise set sensible defaults
      const now = new Date();
      const defaultFrom = selectedRange.from || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const defaultTo = selectedRange.to || now;
      onChange({ preset: 'custom', from: defaultFrom, to: defaultTo });
    }
  };

  const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const newFrom = parseInputToDate(e.target.value);
    onChange({ preset: 'custom', from: newFrom, to: selectedRange.to });
  };

  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const newTo = parseInputToDate(e.target.value);
    onChange({ preset: 'custom', from: selectedRange.from, to: newTo });
  };

  // Validation: Check if from date is after to date
  const isInvalidRange = Boolean(
    selectedRange.preset === 'custom' &&
      selectedRange.from &&
      selectedRange.to &&
      selectedRange.from.getTime() > selectedRange.to.getTime()
  );

  const formattedMinDate = formatDateForInput(minDate);
  const formattedMaxDate = formatDateForInput(maxDate);

  return (
    <fieldset
      className={`date-range-picker ${className}`.trim()}
      aria-label={label}
      disabled={disabled}
    >
      <legend className="sr-only">{label}</legend>
      <div
        className="date-range-presets"
        role="radiogroup"
        aria-label={`${label} presets`}
      >
        {presets.map((preset) => {
          const isChecked = selectedRange.preset === preset.value;
          const optionId = `${baseId}-preset-${preset.value}`;
          return (
            <div key={preset.value} className="date-range-preset-option">
              <input
                type="radio"
                id={optionId}
                name={radioGroupName}
                value={preset.value}
                checked={isChecked}
                onChange={handlePresetChange}
                disabled={disabled}
                className="date-range-preset-input"
              />
              <label htmlFor={optionId} className="date-range-preset-pill">
                {preset.label}
              </label>
            </div>
          );
        })}
      </div>

      {selectedRange.preset === 'custom' && (
        <div className="date-range-custom">
          <div className="date-range-field">
            <label htmlFor={fromInputId} className="date-range-field-label">
              From
            </label>
            <input
              type="date"
              id={fromInputId}
              value={formatDateForInput(selectedRange.from)}
              min={formattedMinDate || undefined}
              max={formatDateForInput(selectedRange.to) || formattedMaxDate || undefined}
              onChange={handleFromChange}
              disabled={disabled}
              aria-invalid={isInvalidRange}
              aria-describedby={isInvalidRange ? errorId : undefined}
              className="date-range-input"
            />
          </div>
          <div className="date-range-field">
            <label htmlFor={toInputId} className="date-range-field-label">
              To
            </label>
            <input
              type="date"
              id={toInputId}
              value={formatDateForInput(selectedRange.to)}
              min={formatDateForInput(selectedRange.from) || formattedMinDate || undefined}
              max={formattedMaxDate || undefined}
              onChange={handleToChange}
              disabled={disabled}
              aria-invalid={isInvalidRange}
              aria-describedby={isInvalidRange ? errorId : undefined}
              className="date-range-input"
            />
          </div>
        </div>
      )}

      {isInvalidRange && (
        <div id={errorId} className="date-range-error" role="alert">
          <span aria-hidden="true">⚠️</span> Start date cannot be after end date.
        </div>
      )}
    </fieldset>
  );
};

export default DateRangePicker;
