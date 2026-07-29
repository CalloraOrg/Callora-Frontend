import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import QuotaBanner, { QuotaStatus } from './QuotaBanner';

describe('QuotaBanner', () => {
  const defaultProps = {
    title: 'Quota Details',
    status: 'ok' as QuotaStatus,
    hint: 'Enter quota amount',
    extraInfo: 'Some extra info about quota.',
    inputId: 'quota-input',
    value: '',
    onChange: vi.fn(),
    statusOptions: 'idle' as const,
  };

  it('renders the title', () => {
    render(<QuotaBanner {...defaultProps} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Quota Details' })).toBeTruthy();
  });

  it('renders the status badge with correct variant class', () => {
    render(<QuotaBanner {...defaultProps} status="ok" />);
    expect(screen.getByText('Active')).toHaveClass('quota-banner__status--ok');

    render(<QuotaBanner {...defaultProps} status="warn" />);
    expect(screen.getByText('Warning')).toHaveClass('quota-banner__status--warn');

    render(<QuotaBanner {...defaultProps} status="danger" />);
    expect(screen.getByText('Exceeded')).toHaveClass('quota-banner__status--danger');
  });

  it('allows custom status label override', () => {
    render(<QuotaBanner {...defaultProps} status="ok" statusLabel="Custom Label" />);
    expect(screen.getByText('Custom Label')).toBeTruthy();
  });

  it('renders FormField with label and hint', () => {
    render(<QuotaBanner {...defaultProps} />);
    expect(screen.getByLabelText('Quota')).toBeTruthy();
    expect(screen.getByText('Enter quota amount')).toBeTruthy();
  });

  it('wires error/help text to inputs via aria-describedby', () => {
    render(<QuotaBanner {...defaultProps} />);
    const input = screen.getByRole('textbox');

    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toContain('quota-input-hint');
    expect(describedBy).toContain('quota-input-extra-info');
  });

  it('applies status to FormField', () => {
    render(<QuotaBanner {...defaultProps} statusOptions="error" />);
    const input = screen.getByRole('textbox');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('does not set aria-invalid when status is idle', () => {
    render(<QuotaBanner {...defaultProps} statusOptions="idle" />);
    const input = screen.getByRole('textbox');
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });

  it('renders extra info with hint styling', () => {
    render(<QuotaBanner {...defaultProps} />);
    const extraInfo = screen.getByText('Some extra info about quota.');
    expect(extraInfo).toHaveClass('quota-banner__hint');
  });

  it('passes value and onChange to input', () => {
    const handleChange = vi.fn();
    render(<QuotaBanner {...defaultProps} value="100" onChange={handleChange} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('100');

    fireEvent.change(input, { target: { value: '200' } });
    expect(handleChange).toHaveBeenCalledWith('200');
  });

  it('uses section with aria-labelledby for accessibility', () => {
    render(<QuotaBanner {...defaultProps} />);
    const section = screen.getByRole('region', { name: 'Quota Details' });
    expect(section).toHaveClass('quota-banner');
  });

  it('wraps FormField in quota-banner__field container', () => {
    render(<QuotaBanner {...defaultProps} />);
    const fieldContainer = document.querySelector('.quota-banner__field');
    expect(fieldContainer).toBeTruthy();
    expect(fieldContainer?.querySelector('.ff-field')).toBeTruthy();
  });

  // ── Empty state (issue #702 / b#025) ───────────────────────────────────────

  describe('themed empty state (issue #702 / b#025)', () => {
    it('shows the empty state when showEmptyState is true and onSetupQuota is provided', () => {
      const onSetupQuota = vi.fn();
      render(<QuotaBanner showEmptyState onSetupQuota={onSetupQuota} />);
      expect(screen.getByTestId('empty-state-quota-banner')).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'No quota configured' })).toBeTruthy();
      expect(screen.getByRole('button', { name: /Set up quota/i })).toBeTruthy();
    });

    it('labels the empty region via aria-labelledby pointing at the EmptyState heading', () => {
      const onSetupQuota = vi.fn();
      render(<QuotaBanner showEmptyState onSetupQuota={onSetupQuota} />);
      const section = screen.getByRole('region', { name: 'No quota configured' });
      expect(section).toHaveClass('quota-banner--empty');
      expect(section.getAttribute('aria-labelledby')).toBe('quota-banner-empty-heading');
      expect(document.getElementById('quota-banner-empty-heading')).toBeTruthy();
    });

    it('renders the quota-banner illustration SVG as aria-hidden (WCAG 1.1.1)', () => {
      const onSetupQuota = vi.fn();
      const { container } = render(
        <QuotaBanner showEmptyState onSetupQuota={onSetupQuota} />,
      );
      const svg = container.querySelector('svg');
      expect(svg).toBeTruthy();
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
      // Design-token strokes only — no hardcoded hex
      expect(/#[0-9a-f]{3,8}/i.test(svg?.outerHTML ?? '')).toBe(false);
      expect(svg?.querySelectorAll('[stroke="var(--muted)"]').length).toBeGreaterThanOrEqual(1);
      expect(
        (svg?.querySelectorAll('[stroke="var(--accent)"]').length ?? 0) +
          (svg?.querySelectorAll('[fill="var(--accent)"]').length ?? 0),
      ).toBeGreaterThanOrEqual(1);
    });

    it('calls onSetupQuota when the CTA button is clicked', () => {
      const onSetupQuota = vi.fn();
      render(<QuotaBanner showEmptyState onSetupQuota={onSetupQuota} />);
      fireEvent.click(screen.getByRole('button', { name: /Set up quota/i }));
      expect(onSetupQuota).toHaveBeenCalledTimes(1);
    });

    it('does not show empty state when showEmptyState is false (default)', () => {
      const onSetupQuota = vi.fn();
      render(<QuotaBanner onSetupQuota={onSetupQuota} />);
      expect(screen.queryByText('No quota configured')).toBeNull();
      expect(screen.getByRole('textbox')).toBeTruthy();
    });

    it('does not show empty state when onSetupQuota is omitted even if showEmptyState is true', () => {
      render(<QuotaBanner showEmptyState />);
      expect(screen.queryByText('No quota configured')).toBeNull();
      expect(screen.getByRole('textbox')).toBeTruthy();
    });

    it('does not render the quota form controls while empty state is active', () => {
      const onSetupQuota = vi.fn();
      render(<QuotaBanner showEmptyState onSetupQuota={onSetupQuota} />);
      expect(screen.queryByRole('textbox')).toBeNull();
      expect(screen.queryByLabelText('Quota')).toBeNull();
    });
  });
});
