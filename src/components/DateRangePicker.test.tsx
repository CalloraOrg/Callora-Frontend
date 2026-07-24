// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DateRangePicker, { DateRange } from './DateRangePicker';

describe('DateRangePicker', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders all preset options inside a radiogroup', () => {
    const onChange = vi.fn();
    const range: DateRange = { preset: '24h' };

    render(<DateRangePicker selectedRange={range} onChange={onChange} />);

    const radioGroup = screen.getByRole('radiogroup');
    expect(radioGroup).toBeTruthy();
    expect(radioGroup.getAttribute('aria-label')).toBe('Time range presets');

    expect(screen.getByLabelText('24h')).toBeTruthy();
    expect(screen.getByLabelText('7d')).toBeTruthy();
    expect(screen.getByLabelText('30d')).toBeTruthy();
    expect(screen.getByLabelText('Custom')).toBeTruthy();
  });

  it('calls onChange with calculated preset values when a preset radio is clicked', () => {
    const onChange = vi.fn();
    const range: DateRange = { preset: '24h' };

    render(<DateRangePicker selectedRange={range} onChange={onChange} />);

    const preset7d = screen.getByLabelText('7d');
    fireEvent.click(preset7d);

    expect(onChange).toHaveBeenCalledTimes(1);
    const updatedRange: DateRange = onChange.mock.calls[0][0];
    expect(updatedRange.preset).toBe('7d');
    expect(updatedRange.from).toBeInstanceOf(Date);
    expect(updatedRange.to).toBeInstanceOf(Date);
  });

  it('shows custom date inputs when custom preset is selected', () => {
    const onChange = vi.fn();
    const range: DateRange = {
      preset: 'custom',
      from: new Date(2026, 6, 1),
      to: new Date(2026, 6, 10),
    };

    render(<DateRangePicker selectedRange={range} onChange={onChange} />);

    const fromInput = screen.getByLabelText('From') as HTMLInputElement;
    const toInput = screen.getByLabelText('To') as HTMLInputElement;

    expect(fromInput).toBeTruthy();
    expect(toInput).toBeTruthy();
    expect(fromInput.value).toBe('2026-07-01');
    expect(toInput.value).toBe('2026-07-10');
  });

  it('calls onChange with updated from and to dates when input values change', () => {
    const onChange = vi.fn();
    const range: DateRange = {
      preset: 'custom',
      from: new Date(2026, 6, 1),
      to: new Date(2026, 6, 10),
    };

    render(<DateRangePicker selectedRange={range} onChange={onChange} />);

    const fromInput = screen.getByLabelText('From');
    fireEvent.change(fromInput, { target: { value: '2026-07-05' } });

    expect(onChange).toHaveBeenCalledTimes(1);
    const updatedFromRange: DateRange = onChange.mock.calls[0][0];
    expect(updatedFromRange.preset).toBe('custom');
    expect(updatedFromRange.from?.getFullYear()).toBe(2026);
    expect(updatedFromRange.from?.getMonth()).toBe(6);
    expect(updatedFromRange.from?.getDate()).toBe(5);

    const toInput = screen.getByLabelText('To');
    fireEvent.change(toInput, { target: { value: '2026-07-15' } });

    expect(onChange).toHaveBeenCalledTimes(2);
    const updatedToRange: DateRange = onChange.mock.calls[1][0];
    expect(updatedToRange.to?.getDate()).toBe(15);
  });

  it('renders validation error message when start date is after end date', () => {
    const onChange = vi.fn();
    const invalidRange: DateRange = {
      preset: 'custom',
      from: new Date(2026, 6, 20),
      to: new Date(2026, 6, 10),
    };

    render(<DateRangePicker selectedRange={invalidRange} onChange={onChange} />);

    const errorMessage = screen.getByRole('alert');
    expect(errorMessage).toBeTruthy();
    expect(errorMessage.textContent).toContain('Start date cannot be after end date.');

    const fromInput = screen.getByLabelText('From');
    expect(fromInput.getAttribute('aria-invalid')).toBe('true');
  });

  it('disables controls when disabled prop is true', () => {
    const onChange = vi.fn();
    const range: DateRange = {
      preset: 'custom',
      from: new Date(2026, 6, 1),
      to: new Date(2026, 6, 10),
    };

    render(<DateRangePicker selectedRange={range} onChange={onChange} disabled />);

    const radio24h = screen.getByLabelText('24h') as HTMLInputElement;
    const fromInput = screen.getByLabelText('From') as HTMLInputElement;

    expect(radio24h.disabled).toBe(true);
    expect(fromInput.disabled).toBe(true);
  });

  it('applies minDate and maxDate attributes to date inputs', () => {
    const onChange = vi.fn();
    const minDate = new Date(2026, 0, 1);
    const maxDate = new Date(2026, 11, 31);
    const range: DateRange = {
      preset: 'custom',
      from: new Date(2026, 6, 1),
      to: new Date(2026, 6, 10),
    };

    render(
      <DateRangePicker
        selectedRange={range}
        onChange={onChange}
        minDate={minDate}
        maxDate={maxDate}
      />
    );

    const toInput = screen.getByLabelText('To') as HTMLInputElement;
    expect(toInput.getAttribute('max')).toBe('2026-12-31');
  });
});
