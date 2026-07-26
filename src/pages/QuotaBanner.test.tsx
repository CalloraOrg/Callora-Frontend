import React from 'react';
import { render, screen } from '@testing-library/react';
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

    // Fire change event
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
});

// Need to import fireEvent
import { fireEvent } from '@testing-library/react';