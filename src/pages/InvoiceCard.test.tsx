import { act } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { InvoiceCard } from './InvoiceCard';

function simulateScroll(y: number) {
  Object.defineProperty(window, 'scrollY', {
    writable: true,
    configurable: true,
    value: y,
  });
  window.dispatchEvent(new Event('scroll'));
}

describe('InvoiceCard sticky action bar', () => {
  it('keeps the action bar hidden until the card is scrolled', () => {
    render(<InvoiceCard invoiceNumber="INV-1001" amountDue="$4,200" />);

    const bar = screen.getByTestId('invoice-card-action-bar');
    expect(bar).toBeInTheDocument();
    expect(bar.classList.contains('invoice-card-action-bar--visible')).toBe(false);
    expect(bar).toHaveAttribute('aria-hidden', 'true');
  });

  it('reveals the sticky action bar after scrolling and exposes the primary action', () => {
    const onPay = vi.fn();
    render(
      <InvoiceCard
        invoiceNumber="INV-1001"
        amountDue="$4,200"
        onPay={onPay}
      />,
    );

    act(() => {
      simulateScroll(220);
    });

    const bar = screen.getByTestId('invoice-card-action-bar');
    expect(bar.classList.contains('invoice-card-action-bar--visible')).toBe(true);
    expect(bar).toHaveAttribute('aria-hidden', 'false');

    const payButton = screen.getByRole('button', { name: /pay now/i });
    fireEvent.click(payButton);
    expect(onPay).toHaveBeenCalledTimes(1);
  });
});
