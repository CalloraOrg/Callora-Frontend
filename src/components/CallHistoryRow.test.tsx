// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CallHistoryRow from './CallHistoryRow';
import type { CallRecord } from './CallHistoryRow';

const successCall: CallRecord = {
  id: 'c1',
  timestamp: new Date('2024-01-15T10:30:00'),
  endpoint: '/api/v1/user/profile',
  status: 'success',
  responseTime: 120,
  cost: 0.001,
  request: { userId: '42' },
  response: { name: 'Alice' },
};

const errorCall: CallRecord = {
  id: 'c2',
  timestamp: new Date('2024-01-15T11:00:00'),
  endpoint: '/api/v1/transactions',
  status: 'error',
  responseTime: 3500,
  cost: 0,
};

/** Renders CallHistoryRow in a plain div (the component uses CSS-grid rows, not <table>) */
function renderRow(props: React.ComponentProps<typeof CallHistoryRow>) {
  return render(<div>{<CallHistoryRow {...props} />}</div>);
}

describe('CallHistoryRow', () => {
  afterEach(cleanup);

  // ── Status icon rendering ────────────────────────────────────────────────

  it('renders CheckCircle icon for a successful call', () => {
    renderRow({ call: successCall, expanded: false, onToggleExpand: () => {} });
    expect(screen.getByTestId('icon-success')).toBeTruthy();
    expect(screen.queryByTestId('icon-error')).toBeNull();
  });

  it('renders XCircle icon for a failed call', () => {
    renderRow({ call: errorCall, expanded: false, onToggleExpand: () => {} });
    expect(screen.getByTestId('icon-error')).toBeTruthy();
    expect(screen.queryByTestId('icon-success')).toBeNull();
  });

  // ── Theme token usage ────────────────────────────────────────────────────

  it('success icon uses --status-success-icon-color token', () => {
    renderRow({ call: successCall, expanded: false, onToggleExpand: () => {} });
    const icon = screen.getByTestId('icon-success');
    // Lucide renders an <svg>; the color prop maps to the stroke attribute
    const svg = (icon.closest('svg') ?? icon) as Element;
    expect(svg.getAttribute('stroke')).toBe('var(--status-success-icon-color)');
  });

  it('error icon uses --status-error-icon-color token', () => {
    renderRow({ call: errorCall, expanded: false, onToggleExpand: () => {} });
    const icon = screen.getByTestId('icon-error');
    const svg = (icon.closest('svg') ?? icon) as Element;
    expect(svg.getAttribute('stroke')).toBe('var(--status-error-icon-color)');
  });

  // ── Accessibility ────────────────────────────────────────────────────────

  it('status cell has accessible aria-label for success', () => {
    renderRow({ call: successCall, expanded: false, onToggleExpand: () => {} });
    expect(screen.getByLabelText('Success')).toBeTruthy();
  });

  it('status cell has accessible aria-label for error', () => {
    renderRow({ call: errorCall, expanded: false, onToggleExpand: () => {} });
    expect(screen.getByLabelText('Error')).toBeTruthy();
  });

  it('status icon is hidden from assistive technology', () => {
    renderRow({ call: successCall, expanded: false, onToggleExpand: () => {} });
    const icon = screen.getByTestId('icon-success');
    const svg = (icon.closest('svg') ?? icon) as Element;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });

  // ── Expand / collapse behaviour ──────────────────────────────────────────

  it('shows View button when collapsed', () => {
    renderRow({ call: successCall, expanded: false, onToggleExpand: () => {} });
    expect(screen.getByRole('button', { name: 'View' })).toBeTruthy();
  });

  it('shows Hide button when expanded', () => {
    renderRow({ call: successCall, expanded: true, onToggleExpand: () => {} });
    expect(screen.getByRole('button', { name: 'Hide' })).toBeTruthy();
  });

  it('calls onToggleExpand with the call id when button is clicked', () => {
    const toggle = vi.fn();
    renderRow({ call: successCall, expanded: false, onToggleExpand: toggle });
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(toggle).toHaveBeenCalledWith('c1');
  });

  it('renders expanded details when expanded=true', () => {
    renderRow({ call: successCall, expanded: true, onToggleExpand: () => {} });
    expect(screen.getByRole('region', { name: 'Call details' })).toBeTruthy();
    expect(screen.getByText('Request')).toBeTruthy();
    expect(screen.getByText('Response')).toBeTruthy();
  });

  it('does not render expanded details when expanded=false', () => {
    renderRow({ call: successCall, expanded: false, onToggleExpand: () => {} });
    expect(screen.queryByRole('region', { name: 'Call details' })).toBeNull();
  });

  // ── Data rendering ───────────────────────────────────────────────────────

  it('displays the endpoint path', () => {
    renderRow({ call: successCall, expanded: false, onToggleExpand: () => {} });
    expect(screen.getByText('/api/v1/user/profile')).toBeTruthy();
  });

  it('formats response time in ms for short calls', () => {
    renderRow({ call: successCall, expanded: false, onToggleExpand: () => {} });
    expect(screen.getByText('120ms')).toBeTruthy();
  });

  it('formats response time in seconds for slow calls', () => {
    renderRow({ call: errorCall, expanded: false, onToggleExpand: () => {} });
    expect(screen.getByText('3.5s')).toBeTruthy();
  });
});
