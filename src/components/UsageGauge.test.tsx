// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import UsageGauge from './UsageGauge';

describe('UsageGauge', () => {
  afterEach(() => {
    cleanup();
  });

  it('exposes a screen-reader-friendly usage state and numeric progress values', () => {
    render(<UsageGauge label="API usage this cycle" used={25} limit={100} unit="USDC" />);

    const gauge = screen.getByRole('progressbar', { name: 'API usage this cycle' });

    expect(gauge.getAttribute('aria-valuemin')).toBe('0');
    expect(gauge.getAttribute('aria-valuemax')).toBe('100');
    expect(gauge.getAttribute('aria-valuenow')).toBe('25');
    expect(gauge.getAttribute('aria-valuetext')).toBe(
      'Within limit: 25 of 100 USDC used, 75 USDC remaining, 25% used.',
    );
    expect(screen.getByText('Within limit')).toBeTruthy();
  });

  it('announces warning, critical, and exhausted states at threshold boundaries', () => {
    const { rerender } = render(<UsageGauge used={75} limit={100} />);

    expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toContain(
      'Approaching limit',
    );

    rerender(<UsageGauge used={90} limit={100} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toContain(
      'Critical usage',
    );

    rerender(<UsageGauge used={125} limit={100} />);
    const gauge = screen.getByRole('progressbar');
    expect(gauge.getAttribute('aria-valuenow')).toBe('100');
    expect(gauge.getAttribute('aria-valuetext')).toBe(
      'Limit reached: 125 of 100 USDC used, 0 USDC remaining, 125% used.',
    );
  });

  it('handles missing or zero limits without dividing by zero', () => {
    render(<UsageGauge label="Requests" used={12} limit={0} unit="calls" />);

    const gauge = screen.getByRole('progressbar', { name: 'Requests' });

    expect(gauge.getAttribute('aria-valuenow')).toBe('0');
    expect(gauge.getAttribute('aria-valuetext')).toBe(
      'No limit configured: 12 calls used. Add a usage limit to track remaining allowance.',
    );
    expect(screen.getByText('No limit configured')).toBeTruthy();
  });

  it('exposes aria-label on the section and progressbar', () => {
    render(<UsageGauge label="API usage this cycle" used={25} limit={100} unit="USDC" />);

    const section = screen.getByRole('region', { name: 'API usage this cycle' });
    expect(section).toBeTruthy();

    const gauge = screen.getByRole('progressbar', { name: 'API usage this cycle' });
    expect(gauge.getAttribute('aria-label')).toBe('API usage this cycle');
  });

  it('defaults aria-label to "Usage" when no label prop is provided', () => {
    render(<UsageGauge used={10} limit={50} />);

    const section = screen.getByRole('region', { name: 'Usage' });
    expect(section).toBeTruthy();

    const gauge = screen.getByRole('progressbar', { name: 'Usage' });
    expect(gauge.getAttribute('aria-label')).toBe('Usage');
  });
});
