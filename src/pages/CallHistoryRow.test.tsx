// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
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
  afterEach(cleanup);

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

  it('does not announce when status stays the same', () => {
    const { rerender } = render(
      <CallHistoryRow call={baseCall} isExpanded={false} onToggle={() => undefined} />,
    );

    const liveRegion = screen.getByRole('status');
    expect(liveRegion.textContent).toBe('');

    rerender(
      <CallHistoryRow
        call={{ ...baseCall, responseTime: 200 }}
        isExpanded={false}
        onToggle={() => undefined}
      />,
    );

    expect(liveRegion.textContent).toBe('');
  });

  it('renders success status text', () => {
    const { container } = render(
      <CallHistoryRow call={baseCall} isExpanded={false} onToggle={() => undefined} />,
    );
    expect(container.querySelector('.status-cell')?.textContent).toContain('success');
  });

  it('renders error status text', () => {
    const { container } = render(
      <CallHistoryRow
        call={{ ...baseCall, status: 'error' }}
        isExpanded={false}
        onToggle={() => undefined}
      />,
    );
    expect(container.querySelector('.status-cell')?.textContent).toContain('error');
  });

  it('has a live region with role="status"', () => {
    render(<CallHistoryRow call={baseCall} isExpanded={false} onToggle={() => undefined} />);
    expect(screen.getByRole('status')).toBeTruthy();
  });
});
