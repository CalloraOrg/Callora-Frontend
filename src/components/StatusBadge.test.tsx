// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { StatusBadge, apiStatusToVariant } from './StatusBadge';
import type { StatusVariant } from './StatusBadge';

afterEach(cleanup);

describe('StatusBadge', () => {
  // ── Rendering ────────────────────────────────────────────────────────────

  it('renders with role="img" and a human-readable label', () => {
    render(<StatusBadge status="operational" />);
    expect(screen.getByRole('img', { name: 'Operational' })).toBeTruthy();
  });

  it('uses a custom label when provided', () => {
    render(<StatusBadge status="error" label="Service Down" />);
    expect(screen.getByRole('img', { name: 'Service Down' })).toBeTruthy();
    expect(screen.getByText('Service Down')).toBeTruthy();
  });

  // ── Default labels for every variant ─────────────────────────────────────

  const labelCases: [StatusVariant, string][] = [
    ['success', 'Operational'],
    ['operational', 'Operational'],
    ['error', 'Error'],
    ['down', 'Down'],
    ['warning', 'Degraded'],
    ['degraded', 'Degraded'],
    ['pending', 'Pending'],
  ];

  it.each(labelCases)('status=%s renders default label "%s"', (status, expectedLabel) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByRole('img', { name: expectedLabel })).toBeTruthy();
  });

  // ── Design-token CSS custom properties ───────────────────────────────────

  it('applies the correct background-color token for success', () => {
    render(<StatusBadge status="success" />);
    const badge = screen.getByRole('img', { name: 'Operational' });
    expect((badge as HTMLElement).style.backgroundColor).toBe('var(--sb-success-bg)');
  });

  it('applies the correct color token for error', () => {
    render(<StatusBadge status="error" />);
    const badge = screen.getByRole('img', { name: 'Error' });
    expect((badge as HTMLElement).style.color).toBe('var(--sb-error-fg)');
  });

  it('applies the correct border token for pending', () => {
    render(<StatusBadge status="pending" />);
    const badge = screen.getByRole('img', { name: 'Pending' });
    expect((badge as HTMLElement).style.border).toContain('var(--sb-pending-border)');
  });

  // ── Pattern class (color-blind safety) ───────────────────────────────────

  it('applies pattern class for error (╲ stripes)', () => {
    render(<StatusBadge status="error" />);
    const badge = screen.getByRole('img', { name: 'Error' });
    expect(badge.classList.contains('sb-pattern-error')).toBe(true);
  });

  it('applies pattern class for warning', () => {
    render(<StatusBadge status="warning" />);
    const badge = screen.getByRole('img', { name: 'Degraded' });
    expect(badge.classList.contains('sb-pattern-warning')).toBe(true);
  });

  it('applies pattern class for pending (dots)', () => {
    render(<StatusBadge status="pending" />);
    const badge = screen.getByRole('img', { name: 'Pending' });
    expect(badge.classList.contains('sb-pattern-pending')).toBe(true);
  });

  it('applies pattern class for operational (no-pattern baseline)', () => {
    render(<StatusBadge status="operational" />);
    const badge = screen.getByRole('img', { name: 'Operational' });
    expect(badge.classList.contains('sb-pattern-operational')).toBe(true);
  });

  // ── Extra className prop ──────────────────────────────────────────────────

  it('forwards extra className to root element', () => {
    render(<StatusBadge status="success" className="my-custom-class" />);
    const badge = screen.getByRole('img', { name: 'Operational' });
    expect(badge.classList.contains('my-custom-class')).toBe(true);
  });

  // ── Accessibility ─────────────────────────────────────────────────────────

  it('dot indicator is hidden from assistive technology', () => {
    render(<StatusBadge status="success" />);
    const badge = screen.getByRole('img', { name: 'Operational' }) as HTMLElement;
    // The dot is the first span child; it must carry aria-hidden="true"
    const dot = badge.querySelector('span[aria-hidden="true"]');
    expect(dot).not.toBeNull();
  });

  it('exposes the pattern semantics for non-color status cues', () => {
    render(<StatusBadge status="error" />);
    const badge = screen.getByRole('img', { name: 'Error' }) as HTMLElement;
    expect(badge.getAttribute('data-status')).toBe('error');
    expect(badge.getAttribute('data-pattern')).toBe('stripes');
    expect(badge.getAttribute('aria-description')).toContain('diagonal stripes');
  });

  // ── maintenance variant ───────────────────────────────────────────────────

  it('renders with default label "Maintenance" for the maintenance variant', () => {
    render(<StatusBadge status="maintenance" />);
    expect(screen.getByRole('img', { name: 'Maintenance' })).toBeTruthy();
  });

  it('applies the sb-pattern-maintenance CSS class for the crosshatch pattern', () => {
    render(<StatusBadge status="maintenance" />);
    const badge = screen.getByRole('img', { name: 'Maintenance' });
    expect(badge.classList.contains('sb-pattern-maintenance')).toBe(true);
  });

  it('exposes crosshatch pattern semantics in data-pattern and aria-description', () => {
    render(<StatusBadge status="maintenance" />);
    const badge = screen.getByRole('img', { name: 'Maintenance' }) as HTMLElement;
    expect(badge.getAttribute('data-status')).toBe('maintenance');
    expect(badge.getAttribute('data-pattern')).toBe('crosshatch');
    expect(badge.getAttribute('aria-description')).toContain('crosshatch pattern');
  });

  it('applies the maintenance design-token colors', () => {
    render(<StatusBadge status="maintenance" />);
    const badge = screen.getByRole('img', { name: 'Maintenance' }) as HTMLElement;
    expect(badge.style.backgroundColor).toBe('var(--sb-maintenance-bg)');
    expect(badge.style.color).toBe('var(--sb-maintenance-fg)');
    expect(badge.style.border).toContain('var(--sb-maintenance-border)');
  });

  // ── apiStatusToVariant helper ─────────────────────────────────────────────

  describe('apiStatusToVariant', () => {
    it('maps "operational" → "operational"', () => {
      expect(apiStatusToVariant('operational')).toBe('operational');
    });

    it('maps "degraded" → "degraded"', () => {
      expect(apiStatusToVariant('degraded')).toBe('degraded');
    });

    it('maps "maintenance" → "maintenance"', () => {
      expect(apiStatusToVariant('maintenance')).toBe('maintenance');
    });

    it('maps undefined → "pending" (safe fallback)', () => {
      expect(apiStatusToVariant(undefined)).toBe('pending');
    });
  });
});
