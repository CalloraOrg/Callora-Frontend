import React, { useState } from 'react';

/**
 * Props for the DateRangePicker component.
 */
interface DateRange {
  preset: string; // '24h' | '7d' | '30d' | 'custom'
  from?: Date;
  to?: Date;
}

interface DateRangePickerProps {
  selectedRange: DateRange;
  onChange: (range: DateRange) => void;
}

/**
 * Accessible date range picker with preset options and a custom range.
 * - Presets are rendered as a radio group with `aria-label="Time range"`.
 * - Selecting "Custom" reveals two native date inputs that are fully keyboard operable.
 * - No third‑party date‑picker libraries are used.
 */
const DateRangePicker: React.FC<DateRangePickerProps> = ({ selectedRange, onChange }) => {
  const presets = [
    { label: '24h', value: '24h' },
    { label: '7d', value: '7d' },
    { label: '30d', value: '30d' },
    { label: 'Custom', value: 'custom' },
  ];

  const handlePresetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const preset = e.target.value;
    if (preset !== 'custom') {
      onChange({ preset });
    } else {
      onChange({ preset, from: selectedRange.from, to: selectedRange.to });
    }
  };

  const today = new Date();
  const maxDate = today.toISOString().split('T')[0];
  const minDate = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const from = new Date(e.target.value);
    onChange({ preset: 'custom', from, to: selectedRange.to });
  };

  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const to = new Date(e.target.value);
    onChange({ preset: 'custom', from: selectedRange.from, to });
  };

  return (
    <fieldset className="date-range-picker" aria-label="Time range" style={{ marginBottom: '1rem' }}>
      <legend className="sr-only">Select time range</legend>
      <div className="presets" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        {presets.map(p => (
          <label key={p.value} style={{ cursor: 'pointer' }}>
            <input
              type="radio"
              name="date-range-preset"
              value={p.value}
              checked={selectedRange.preset === p.value}
              onChange={handlePresetChange}
            />
            {p.label}
          </label>
        ))}
      </div>
      {selectedRange.preset === 'custom' && (
        <div className="custom-range" style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label>
            From
            <input
              type="date"
              value={selectedRange.from ? selectedRange.from.toISOString().split('T')[0] : ''}
              min={minDate}
              max={maxDate}
              onChange={handleFromChange}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={selectedRange.to ? selectedRange.to.toISOString().split('T')[0] : ''}
              min={minDate}
              max={maxDate}
              onChange={handleToChange}
            />
          </label>
        </div>
      )}
    </fieldset>
  );
};

export default DateRangePicker;
