import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import QuotaBanner from './QuotaBanner';

describe('QuotaBanner', () => {
  it('wires error/help text to inputs via aria-describedby', () => {
    render(<QuotaBanner />);
    const input = screen.getByRole('textbox');
    
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toContain('quota-input-hint');
    expect(describedBy).toContain('quota-extra-info');
  });
});
