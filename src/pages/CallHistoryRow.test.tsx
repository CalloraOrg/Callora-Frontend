// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CallHistoryRow from './CallHistoryRow';

const baseCall = {
  id: 'call-1',
  timestamp: new Date('2024-01-01T12:00:00.000Z'),
  endpoint: '/api/v1/user/profile',
  status: 'success' as const,
  responseTime: 120,
  cost: 0.001,
};

describe('CallHistoryRow', () => {
  it('announces status changes through a polite live region', () => {
    const { rerender } = render(
      <CallHistoryRow call={baseCall} isExpanded={false} onToggle={() => undefined} />,
    );

    const liveRegion = screen.getByRole('status');
    expect(liveRegion.textContent).toBe('');

    rerender(
      <CallHistoryRow
        call={{ ...baseCall, status: 'error' }}
        isExpanded={false}
        onToggle={() => undefined}
      />,
    );

    expect(liveRegion.textContent).toContain('Call status updated to error.');
    expect(liveRegion.getAttribute('aria-live')).toBe('polite');
    expect(liveRegion.getAttribute('aria-atomic')).toBe('true');
  });
});
