import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import QuotaBanner from './QuotaBanner';

describe('QuotaBanner', () => {
  it('wires error/help text to inputs via aria-describedby', () => {
    render(<QuotaBanner />);
    const input = screen.getByRole('textbox');

    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toContain('quota-input-hint');
    expect(describedBy).toContain('quota-extra-info');
  });

  it('renders primary action button with KbdHint shortcut chip', () => {
    render(<QuotaBanner primaryActionLabel="Save Quota" shortcutKey="Ctrl+Enter" />);

    const button = screen.getByRole('button', { name: /Save Quota/i });
    expect(button).toBeTruthy();
    expect(button.classList.contains('primary-button')).toBe(true);

    const kbd = screen.getByText('Ctrl+Enter');
    expect(kbd).toBeTruthy();
    expect(kbd.tagName.toLowerCase()).toBe('kbd');
  });

  it('triggers onSave callback when primary action button is clicked', () => {
    const handleSave = vi.fn();
    render(<QuotaBanner initialQuota="100" onSave={handleSave} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '250' } });

    const button = screen.getByRole('button', { name: /Save Quota/i });
    fireEvent.click(button);

    expect(handleSave).toHaveBeenCalledTimes(1);
    expect(handleSave).toHaveBeenCalledWith('250');
  });

  it('triggers onSave callback when Ctrl+Enter keyboard shortcut is pressed', () => {
    const handleSave = vi.fn();
    render(<QuotaBanner initialQuota="500" onSave={handleSave} />);

    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });

    expect(handleSave).toHaveBeenCalledTimes(1);
    expect(handleSave).toHaveBeenCalledWith('500');
  });
});

