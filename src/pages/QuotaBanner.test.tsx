import { render, screen } from '@testing-library/react';
import QuotaBanner from '../pages/QuotaBanner';

describe('QuotaBanner', () => {
  it('renders quota details and shortcut hint', () => {
    render(<QuotaBanner />);
    // Check main heading
    expect(screen.getByRole('heading', { name: /quota details/i })).toBeInTheDocument();
    // Check input field
    const input = screen.getByLabelText(/quota/i);
    expect(input).toBeInTheDocument();
    // Check KbdHint displays the Enter key
    const kbd = screen.getByText('Enter');
    expect(kbd).toBeInTheDocument();
    // Ensure description is present (optional)
    expect(screen.getByText('Submit quota')).toBeInTheDocument();
  });
});
