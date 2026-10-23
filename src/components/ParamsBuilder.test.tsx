// @vitest-environment jsdom

/**
 * ParamsBuilder tests
 *
 * Coverage:
 * • Empty state renders with "No parameters yet" and Add CTA
 * • Adding a row populates the row list
 * • Removing a row updates the list
 * • Editing key / type / value serialises correct JSON
 * • Boolean value renders a select (not a text input)
 * • Number value renders a number input
 * • Tab order: key → type → value → remove (via DOM order)
 * • Mode toggle: form → raw serialises rows to JSON
 * • Mode toggle: raw → form parses JSON into rows
 * • Invalid raw JSON stays in raw mode and surfaces an inline error
 * • Non-object raw JSON surfaces an inline error on switch
 * • onChange is called with the correct JSON string
 * • disabled prop disables all interactive elements
 * • Aria attributes: labelledby, aria-invalid, aria-live regions
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ParamsBuilder from './ParamsBuilder';
import type { ParamsBuilderProps } from './ParamsBuilder';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function setup(props: Partial<ParamsBuilderProps> = {}) {
  const onChange = vi.fn();
  const utils = render(
    <ParamsBuilder
      value="{}"
      onChange={onChange}
      {...props}
    />,
  );
  return { ...utils, onChange };
}

/** Click the "Form" mode button. */
function clickForm() {
  fireEvent.click(screen.getByRole('button', { name: 'Form' }));
}

/** Click the "Raw JSON" mode button. */
function clickRaw() {
  fireEvent.click(screen.getByRole('button', { name: 'Raw JSON' }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ParamsBuilder', () => {
  afterEach(cleanup);

  // ── Empty state ─────────────────────────────────────────────────────────

  it('shows "No parameters yet" when value is "{}"', () => {
    setup({ value: '{}' });
    expect(screen.getByText('No parameters yet.')).toBeTruthy();
  });

  it('shows an Add parameter CTA in the empty state', () => {
    setup({ value: '{}' });
    expect(screen.getByRole('button', { name: /add parameter/i })).toBeTruthy();
  });

  // ── Adding a row ────────────────────────────────────────────────────────

  it('adds a row when "Add parameter" is clicked', () => {
    setup({ value: '{}' });
    fireEvent.click(screen.getByRole('button', { name: /add parameter/i }));
    // After adding, a key input should be visible
    expect(screen.getByLabelText(/parameter 1 key/i)).toBeTruthy();
  });

  it('calls onChange with empty-key object when a blank row is added', () => {
    const { onChange } = setup({ value: '{}' });
    fireEvent.click(screen.getByRole('button', { name: /add parameter/i }));
    // Blank key → excluded from serialisation → still "{}"
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(JSON.parse(lastCall)).toEqual({});
  });

  // ── Editing rows ────────────────────────────────────────────────────────

  it('serialises a string row into JSON', () => {
    const { onChange } = setup({ value: '{}' });
    fireEvent.click(screen.getByRole('button', { name: /add parameter/i }));

    fireEvent.change(screen.getByLabelText(/parameter 1 key/i), {
      target: { value: 'name' },
    });
    fireEvent.change(screen.getByLabelText(/parameter 1 value/i), {
      target: { value: 'Alice' },
    });

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(JSON.parse(lastCall)).toEqual({ name: 'Alice' });
  });

  it('serialises a number row into JSON', () => {
    const { onChange } = setup({ value: '{}' });
    fireEvent.click(screen.getByRole('button', { name: /add parameter/i }));

    fireEvent.change(screen.getByLabelText(/parameter 1 key/i), {
      target: { value: 'limit' },
    });
    fireEvent.change(screen.getByLabelText(/parameter 1 type/i), {
      target: { value: 'number' },
    });
    fireEvent.change(screen.getByLabelText(/parameter 1 value/i), {
      target: { value: '10' },
    });

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(JSON.parse(lastCall)).toEqual({ limit: 10 });
  });

  it('renders a select for the boolean value field', () => {
    setup({ value: '{"active":true}' });
    // The existing row's type should be boolean → value select
    const valueEl = screen.getByLabelText(/parameter 1 value/i);
    expect(valueEl.tagName.toLowerCase()).toBe('select');
    expect((valueEl as HTMLSelectElement).value).toBe('true');
  });

  it('renders a number input for the number value field', () => {
    setup({ value: '{"count":5}' });
    const valueEl = screen.getByLabelText(/parameter 1 value/i);
    expect((valueEl as HTMLInputElement).type).toBe('number');
    expect((valueEl as HTMLInputElement).value).toBe('5');
  });

  it('serialises a boolean row correctly', () => {
    const { onChange } = setup({ value: '{}' });
    fireEvent.click(screen.getByRole('button', { name: /add parameter/i }));

    fireEvent.change(screen.getByLabelText(/parameter 1 key/i), {
      target: { value: 'active' },
    });
    fireEvent.change(screen.getByLabelText(/parameter 1 type/i), {
      target: { value: 'boolean' },
    });
    // Value select defaults to "true"
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(JSON.parse(lastCall)).toEqual({ active: true });
  });

  // ── Removing a row ──────────────────────────────────────────────────────

  it('removes a row when the remove button is clicked', () => {
    setup({ value: '{"x":"1"}' });
    expect(screen.getByLabelText(/parameter 1 key/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /remove parameter 1/i }));

    expect(screen.queryByLabelText(/parameter 1 key/i)).toBeNull();
    expect(screen.getByText('No parameters yet.')).toBeTruthy();
  });

  it('calls onChange with "{}" after the last row is removed', () => {
    const { onChange } = setup({ value: '{"x":"1"}' });
    fireEvent.click(screen.getByRole('button', { name: /remove parameter 1/i }));
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(JSON.parse(lastCall)).toEqual({});
  });

  // ── Parameter count badge ────────────────────────────────────────────────

  it('shows the parameter count badge in form mode', () => {
    setup({ value: '{"a":"1","b":"2"}' });
    // Two rows should give count badge of 2
    expect(screen.getByLabelText('2 parameters')).toBeTruthy();
  });

  it('count badge shows singular for one parameter', () => {
    setup({ value: '{"a":"1"}' });
    expect(screen.getByLabelText('1 parameter')).toBeTruthy();
  });

  // ── Tab order (DOM order check) ─────────────────────────────────────────

  it('DOM order within a row is: key → type → value → remove', () => {
    setup({ value: '{"foo":"bar"}' });
    const row = screen.getByRole('listitem', { name: /parameter 1/i });
    // Query all interactive elements in DOM order
    const all = Array.from(row.querySelectorAll('input, select, button'));
    const labels = all.map((el) => el.getAttribute('aria-label') ?? el.tagName.toLowerCase());
    expect(labels[0]).toMatch(/key/i);    // first: key input
    expect(labels[1]).toMatch(/type/i);   // second: type select
    expect(labels[2]).toMatch(/value/i);  // third: value input/select
    expect(labels[3]).toMatch(/remove/i); // fourth: remove button
  });

  // ── Mode toggle: form → raw ─────────────────────────────────────────────

  it('switches to Raw JSON mode when the Raw JSON button is clicked', () => {
    setup({ value: '{}' });
    clickRaw();
    expect(screen.getByRole('textbox', { name: /raw json parameters/i })).toBeTruthy();
  });

  it('serialises rows into the raw textarea when switching form → raw', () => {
    setup({ value: '{"limit":10}' });
    clickRaw();
    const textarea = screen.getByRole('textbox', {
      name: /raw json parameters/i,
    }) as HTMLTextAreaElement;
    expect(JSON.parse(textarea.value)).toEqual({ limit: 10 });
  });

  it('Raw JSON button is aria-pressed="true" when in raw mode', () => {
    setup({ value: '{}' });
    clickRaw();
    const rawBtn = screen.getByRole('button', { name: 'Raw JSON' });
    expect(rawBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('Form button is aria-pressed="false" when in raw mode', () => {
    setup({ value: '{}' });
    clickRaw();
    const formBtn = screen.getByRole('button', { name: 'Form' });
    expect(formBtn.getAttribute('aria-pressed')).toBe('false');
  });

  // ── Mode toggle: raw → form ─────────────────────────────────────────────

  it('parses raw JSON back into form rows when switching raw → form', () => {
    const { onChange } = setup({ value: '{}' });
    clickRaw();

    const textarea = screen.getByRole('textbox', {
      name: /raw json parameters/i,
    }) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '{"page":2}' } });

    clickForm();
    expect(screen.getByLabelText(/parameter 1 key/i)).toBeTruthy();
    expect((screen.getByLabelText(/parameter 1 key/i) as HTMLInputElement).value).toBe('page');
  });

  // ── Invalid raw JSON ─────────────────────────────────────────────────────

  it('surfaces an inline error when raw JSON is syntactically invalid', async () => {
    setup({ value: '{}' });
    clickRaw();

    const textarea = screen.getByRole('textbox', { name: /raw json parameters/i });
    fireEvent.change(textarea, { target: { value: '{bad json}' } });

    // The status region should show a JSON syntax error message
    const status = screen.getByRole('status');
    expect(status.textContent).toMatch(/json syntax error/i);
  });

  it('stays in raw mode when switching to form with invalid JSON', () => {
    setup({ value: '{}' });
    clickRaw();

    const textarea = screen.getByRole('textbox', { name: /raw json parameters/i });
    fireEvent.change(textarea, { target: { value: '{bad json}' } });

    clickForm();

    // Still in raw mode
    expect(screen.getByRole('textbox', { name: /raw json parameters/i })).toBeTruthy();
  });

  it('shows a parse error alert when switching from invalid raw JSON to form', () => {
    setup({ value: '{}' });
    clickRaw();

    const textarea = screen.getByRole('textbox', { name: /raw json parameters/i });
    fireEvent.change(textarea, { target: { value: '{not valid json' } });

    clickForm();

    // The switch error alert should appear
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toMatch(/cannot switch to form/i);
  });

  it('surfaces an error when raw JSON is an array (not an object)', () => {
    setup({ value: '{}' });
    clickRaw();

    const textarea = screen.getByRole('textbox', { name: /raw json parameters/i });
    fireEvent.change(textarea, { target: { value: '[1,2,3]' } });

    clickForm();

    expect(screen.getByRole('alert').textContent).toMatch(/cannot switch to form/i);
  });

  // ── onChange propagation ─────────────────────────────────────────────────

  it('calls onChange when raw textarea content changes', () => {
    const { onChange } = setup({ value: '{}' });
    clickRaw();
    const textarea = screen.getByRole('textbox', { name: /raw json parameters/i });
    fireEvent.change(textarea, { target: { value: '{"x":1}' } });
    expect(onChange).toHaveBeenCalledWith('{"x":1}');
  });

  // ── Disabled state ───────────────────────────────────────────────────────

  it('disables the Add parameter button when disabled=true', () => {
    render(<ParamsBuilder value="{}" onChange={vi.fn()} disabled />);
    expect(
      (screen.getByRole('button', { name: /add parameter/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('disables the mode toggle buttons when disabled=true', () => {
    render(<ParamsBuilder value="{}" onChange={vi.fn()} disabled />);
    expect(
      (screen.getByRole('button', { name: 'Form' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Raw JSON' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('disables key inputs when disabled=true and rows exist', () => {
    render(<ParamsBuilder value='{"a":"1"}' onChange={vi.fn()} disabled />);
    expect(
      (screen.getByLabelText(/parameter 1 key/i) as HTMLInputElement).disabled,
    ).toBe(true);
  });

  it('disables remove buttons when disabled=true', () => {
    render(<ParamsBuilder value='{"a":"1"}' onChange={vi.fn()} disabled />);
    expect(
      (screen.getByRole('button', { name: /remove parameter 1/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  // ── Accessibility ────────────────────────────────────────────────────────

  it('raw textarea has aria-invalid when JSON is invalid', () => {
    setup({ value: '{}' });
    clickRaw();
    const textarea = screen.getByRole('textbox', { name: /raw json parameters/i });
    fireEvent.change(textarea, { target: { value: '{oops' } });
    expect(textarea.getAttribute('aria-invalid')).toBe('true');
  });

  it('raw textarea does NOT have aria-invalid when JSON is valid', () => {
    setup({ value: '{}' });
    clickRaw();
    const textarea = screen.getByRole('textbox', { name: /raw json parameters/i });
    fireEvent.change(textarea, { target: { value: '{"ok":1}' } });
    expect(textarea.getAttribute('aria-invalid')).toBeNull();
  });

  it('raw status region has role="status" and aria-live="polite"', () => {
    setup({ value: '{}' });
    clickRaw();
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
  });

  it('custom label is rendered', () => {
    setup({ label: 'Query Params', value: '{}' });
    expect(screen.getByText('Query Params')).toBeTruthy();
  });

  // ── Round-trip ───────────────────────────────────────────────────────────

  it('round-trips form → raw → form without data loss', () => {
    const initial = JSON.stringify({ city: 'London', count: 3, active: true }, null, 2);
    setup({ value: initial });

    // Switch to raw, should contain the same JSON
    clickRaw();
    const textarea = screen.getByRole('textbox', {
      name: /raw json parameters/i,
    }) as HTMLTextAreaElement;
    expect(JSON.parse(textarea.value)).toEqual({ city: 'London', count: 3, active: true });

    // Switch back to form
    clickForm();
    expect(screen.getByLabelText('3 parameters')).toBeTruthy();
  });
});
