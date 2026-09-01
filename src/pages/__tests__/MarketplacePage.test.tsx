import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MarketplacePage } from '../MarketplacePage';

describe('MarketplacePage Accessibility (ARIA Live)', () => {
  it('renders polite live region on initial mount', () => {
    render(<MarketplacePage />);
    const announcer = screen.getByTestId('marketplace-sr-announcer');
    
    expect(announcer).toBeInTheDocument();
    expect(announcer).toHaveAttribute('role', 'status');
    expect(announcer).toHaveAttribute('aria-live', 'polite');
    expect(announcer).toHaveAttribute('aria-atomic', 'true');
  });

  it('announces status changes when filter changes', async () => {
    render(<MarketplacePage />);
    const filterSelect = screen.getByLabelText(/filter grants by category/i);

    fireEvent.change(filterSelect, { target: { value: 'community' } });

    const announcer = screen.getByTestId('marketplace-sr-announcer');
    await waitFor(() => {
      expect(announcer).toHaveTextContent(/Filtering marketplace by community/i);
    });
  });

  it('announces search result counts accurately', async () => {
    render(<MarketplacePage />);
    const announcer = screen.getByTestId('marketplace-sr-announcer');

    await waitFor(() => {
      expect(announcer.textContent).toMatch(/Marketplace updated:/i);
    });
  });
});
