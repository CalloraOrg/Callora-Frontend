// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ApiUsageCallHistory } from './ApiUsage';

const calls = Array.from({ length: 3 }, (_, index) => ({
  id: String(index),
  timestamp: new Date('2026-07-24T10:00:00Z'),
  endpoint: `/api/v1/example/${index}`,
  status: 'success' as const,
  responseTime: 120,
  cost: 0.001,
}));

function callHistory(isLoading: boolean) {
  return (
    <ApiUsageCallHistory
      calls={calls}
      expandedCall={null}
      isLoading={isLoading}
      onToggleExpand={() => {}}
    />
  );
}

describe('ApiUsage call history skeleton', () => {
  afterEach(cleanup);

  it('renders the same number of loading rows as loaded call records', () => {
    const { container, rerender } = render(callHistory(true));

    expect(container.querySelectorAll('.table-row')).toHaveLength(calls.length);

    rerender(callHistory(false));

    expect(container.querySelectorAll('.table-row')).toHaveLength(calls.length);
  });

  it('matches the six-column shape and action height of loaded rows', () => {
    const { container } = render(callHistory(true));

    container.querySelectorAll('.table-row').forEach(row => {
      expect(row.querySelectorAll('.skeleton-cell-slot')).toHaveLength(6);
      expect(row.querySelector('.skeleton-cell--endpoint')).toBeTruthy();
      expect(row.querySelector('.skeleton-cell--action')).toBeTruthy();
    });
  });

  it('announces loading and clears the busy state after content loads', () => {
    const { container, rerender } = render(callHistory(true));
    const table = container.querySelector('.call-history-table');

    expect(table?.getAttribute('aria-busy')).toBe('true');
    expect(table?.getAttribute('aria-describedby')).toBe('call-history-loading');
    expect(screen.getByRole('status').textContent).toBe('Loading call history.');

    rerender(callHistory(false));

    expect(table?.getAttribute('aria-busy')).toBe('false');
    expect(table?.getAttribute('aria-describedby')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });
});
