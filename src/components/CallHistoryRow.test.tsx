// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CallHistoryRow from './CallHistoryRow';
import type { CallRecord } from './CallHistoryRow';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const successCall: CallRecord = {
  id: 'c1',
  timestamp: new Date('2024-01-15T10:30:00'),
  endpoint: '/api/v1/user/profile',
  status: 'success',
  responseTime: 120,
  cost: 0.001,
  request: { userId: '42' },
  response: { name: 'Alice', score: 10 },
};

const errorCall: CallRecord = {
  id: 'c2',
  timestamp: new Date('2024-01-15T11:00:00'),
  endpoint: '/api/v1/transactions',
  status: 'error',
  responseTime: 3500,
  cost: 0,
};

/** A second call whose response differs from successCall.response */
const laterCall: CallRecord = {
  id: 'c3',
  timestamp: new Date('2024-01-15T12:00:00'),
  endpoint: '/api/v1/user/profile',
  status: 'success',
  responseTime: 95,
  cost: 0.001,
  request: { userId: '42' },
  response: { name: 'Alice', score: 99 },   // score changed
};

/** A call with the exact same response as successCall */
const identicalResponseCall: CallRecord = {
  id: 'c4',
  timestamp: new Date('2024-01-15T13:00:00'),
  endpoint: '/api/v1/user/profile',
  status: 'success',
  responseTime: 110,
  cost: 0.001,
  response: { name: 'Alice', score: 10 },   // identical to successCall
};

/** Renders CallHistoryRow inside a plain div (the component uses CSS-grid rows, not <table>) */
function renderRow(props: React.ComponentProps<typeof CallHistoryRow>) {
  return render(<div>{<CallHistoryRow {...props} />}</div>);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

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
    const svg = (icon.closest('svg') ?? icon) as Element;
    expect(svg.getAttribute('stroke')).toBe('var(--status-success-icon-color)');
  });

  it('error icon uses --status-error-icon-color token', () => {
    renderRow({ call: errorCall, expanded: false, onToggleExpand: () => {} });
    const icon = screen.getByTestId('icon-error');
    const svg = (icon.closest('svg') ?? icon) as Element;
    expect(svg.getAttribute('stroke')).toBe('var(--status-error-icon-color)');
  });

  // ── Accessibility (original) ─────────────────────────────────────────────

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

  // ── No compareWith — plain raw response ─────────────────────────────────

  it('shows raw JSON response when no compareWith is provided', () => {
    renderRow({ call: successCall, expanded: true, onToggleExpand: () => {} });
    // JSON.stringify output of the response object should be present in a <pre>
    expect(screen.queryByRole('group', { name: 'Response view mode' })).toBeNull();
    const details = screen.getByRole('region', { name: 'Call details' });
    expect(details.querySelector('pre')).toBeTruthy();
  });

  it('does not render the mode-toggle group without compareWith', () => {
    renderRow({ call: successCall, expanded: true, onToggleExpand: () => {} });
    expect(screen.queryByRole('group', { name: 'Response view mode' })).toBeNull();
  });

  // ── With compareWith — diff mode ─────────────────────────────────────────

  it('renders the Diff / Raw toggle group when compareWith is provided', () => {
    renderRow({ call: successCall, expanded: true, onToggleExpand: () => {}, compareWith: laterCall });
    expect(screen.getByRole('group', { name: 'Response view mode' })).toBeTruthy();
  });

  it('defaults to diff view when compareWith is provided', () => {
    renderRow({ call: successCall, expanded: true, onToggleExpand: () => {}, compareWith: laterCall });
    // Diff button should be aria-pressed=true
    const diffBtn = screen.getByRole('button', { name: 'Diff' });
    expect(diffBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('renders the diff region with correct accessible label', () => {
    renderRow({ call: successCall, expanded: true, onToggleExpand: () => {}, compareWith: laterCall });
    expect(screen.getByRole('region', { name: 'Response diff' })).toBeTruthy();
  });

  it('renders a table with line-by-line diff content', () => {
    renderRow({ call: successCall, expanded: true, onToggleExpand: () => {}, compareWith: laterCall });
    const diffTable = screen.getByRole('table', { name: 'Line-by-line response diff' });
    expect(diffTable).toBeTruthy();
  });

  it('includes at least one removed row for the changed field', () => {
    renderRow({ call: successCall, expanded: true, onToggleExpand: () => {}, compareWith: laterCall });
    const removedRows = document.querySelectorAll('[data-diff-type="removed"]');
    expect(removedRows.length).toBeGreaterThan(0);
  });

  it('includes at least one added row for the changed field', () => {
    renderRow({ call: successCall, expanded: true, onToggleExpand: () => {}, compareWith: laterCall });
    const addedRows = document.querySelectorAll('[data-diff-type="added"]');
    expect(addedRows.length).toBeGreaterThan(0);
  });

  it('each diff row carries a descriptive aria-label', () => {
    renderRow({ call: successCall, expanded: true, onToggleExpand: () => {}, compareWith: laterCall });
    const rows = document.querySelectorAll('[data-diff-type]');
    rows.forEach((row) => {
      const label = row.getAttribute('aria-label');
      expect(label).toBeTruthy();
      // Must start with Added:, Removed:, or Unchanged:
      expect(/^(Added|Removed|Unchanged): /.test(label ?? '')).toBe(true);
    });
  });

  it('shows the call-label timestamps bar in diff mode', () => {
    renderRow({ call: successCall, expanded: true, onToggleExpand: () => {}, compareWith: laterCall });
    // The "before" and "after" labels exist — we look for them by class
    expect(document.querySelector('.diff-call-label--a')).toBeTruthy();
    expect(document.querySelector('.diff-call-label--b')).toBeTruthy();
  });

  // ── View-mode toggle behaviour ───────────────────────────────────────────

  it('switches to raw view when Raw button is clicked', () => {
    renderRow({ call: successCall, expanded: true, onToggleExpand: () => {}, compareWith: laterCall });
    const rawBtn = screen.getByRole('button', { name: 'Raw' });
    fireEvent.click(rawBtn);

    expect(rawBtn.getAttribute('aria-pressed')).toBe('true');
    // Diff region should no longer be present
    expect(screen.queryByRole('region', { name: 'Response diff' })).toBeNull();
  });

  it('switches back to diff view when Diff button is clicked after Raw', () => {
    renderRow({ call: successCall, expanded: true, onToggleExpand: () => {}, compareWith: laterCall });
    fireEvent.click(screen.getByRole('button', { name: 'Raw' }));
    fireEvent.click(screen.getByRole('button', { name: 'Diff' }));

    expect(screen.getByRole('region', { name: 'Response diff' })).toBeTruthy();
  });

  it('Raw button becomes aria-pressed=false when switching to Diff', () => {
    renderRow({ call: successCall, expanded: true, onToggleExpand: () => {}, compareWith: laterCall });
    // Start in diff mode — Raw is not active
    const rawBtn = screen.getByRole('button', { name: 'Raw' });
    expect(rawBtn.getAttribute('aria-pressed')).toBe('false');
  });

  // ── Identical responses ──────────────────────────────────────────────────

  it('shows "no differences" notice when responses are identical', () => {
    renderRow({
      call: successCall,
      expanded: true,
      onToggleExpand: () => {},
      compareWith: identicalResponseCall,
    });
    expect(
      screen.getByText(/responses are identical/i),
    ).toBeTruthy();
  });

  it('"no differences" notice has role="status" for screen readers', () => {
    renderRow({
      call: successCall,
      expanded: true,
      onToggleExpand: () => {},
      compareWith: identicalResponseCall,
    });
    const notice = screen.getByRole('status');
    expect(notice.textContent).toMatch(/identical/i);
  });

  // ── Edge case: missing response ──────────────────────────────────────────

  it('renders diff without crashing when call.response is undefined', () => {
    const noResponse: CallRecord = { ...successCall, response: undefined };
    expect(() =>
      renderRow({
        call: noResponse,
        expanded: true,
        onToggleExpand: () => {},
        compareWith: laterCall,
      }),
    ).not.toThrow();
  });

  it('renders diff without crashing when compareWith.response is undefined', () => {
    const noResponse: CallRecord = { ...laterCall, response: undefined };
    expect(() =>
      renderRow({
        call: successCall,
        expanded: true,
        onToggleExpand: () => {},
        compareWith: noResponse,
      }),
    ).not.toThrow();
  });

  // ── Accessibility — diff table structure ─────────────────────────────────

  it('diff table has screen-reader-only column headers', () => {
    renderRow({ call: successCall, expanded: true, onToggleExpand: () => {}, compareWith: laterCall });
    const thead = document.querySelector('.diff-table thead');
    expect(thead).toBeTruthy();
    // The thead has .sr-only so it is visually hidden but accessible
    expect(thead?.className).toContain('sr-only');
  });

  it('gutter cells are aria-hidden', () => {
    renderRow({ call: successCall, expanded: true, onToggleExpand: () => {}, compareWith: laterCall });
    const gutters = document.querySelectorAll('.diff-line__gutter');
    gutters.forEach((g) => {
      expect(g.getAttribute('aria-hidden')).toBe('true');
    });
  });

  it('sign cells are aria-hidden', () => {
    renderRow({ call: successCall, expanded: true, onToggleExpand: () => {}, compareWith: laterCall });
    const signs = document.querySelectorAll('.diff-line__sign');
    signs.forEach((s) => {
      expect(s.getAttribute('aria-hidden')).toBe('true');
    });
  });
});
