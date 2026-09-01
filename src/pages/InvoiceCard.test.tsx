import { act } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { InvoiceCard } from './InvoiceCard';
import { addAccount, switchAccount, _reset } from '../state/accountStore';

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
    expect(bar.classList.contains('theme-sticky-bar--visible')).toBe(false);
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
    expect(bar.classList.contains('theme-sticky-bar--visible')).toBe(true);
    expect(bar).toHaveAttribute('aria-hidden', 'false');

    const payButton = screen.getByRole('button', { name: /pay now/i });
    fireEvent.click(payButton);
    expect(onPay).toHaveBeenCalledTimes(1);
  });
});

describe('InvoiceCard timezone and due date rendering', () => {
  beforeEach(() => {
    localStorage.clear();
    _reset();
  });

  afterEach(() => {
    localStorage.clear();
    _reset();
  });

  it('renders default relative due date string unchanged', () => {
    render(<InvoiceCard invoiceNumber="INV-1001" amountDue="$4,200" dueDate="Due in 7 days" />);
    const dueDateElement = screen.getByTestId('invoice-card-due-date');
    expect(dueDateElement).toHaveTextContent('Due in 7 days');
  });

  it('renders ISO due date formatted in explicit timezone prop', () => {
    // 2026-09-01T01:00:00Z -> Aug 31, 2026 in America/New_York (EDT)
    render(
      <InvoiceCard
        invoiceNumber="INV-1001"
        amountDue="$4,200"
        dueDate="2026-09-01T01:00:00Z"
        timezone="America/New_York"
        locale="en-US"
      />
    );
    const dueDateElement = screen.getByTestId('invoice-card-due-date');
    expect(dueDateElement).toHaveTextContent('Aug 31, 2026');
  });

  it('renders ISO due date formatted in active account timezone from account store', () => {
    addAccount({
      id: 'acc-tokyo',
      label: 'Tokyo Account',
      apiKey: 'key-123',
      timezone: 'Asia/Tokyo',
    });
    switchAccount('acc-tokyo');

    // 2026-09-01T01:00:00Z -> Sep 1, 2026 in Asia/Tokyo (JST)
    render(
      <InvoiceCard
        invoiceNumber="INV-1001"
        amountDue="$4,200"
        dueDate="2026-09-01T01:00:00Z"
        locale="en-US"
      />
    );
    const dueDateElement = screen.getByTestId('invoice-card-due-date');
    expect(dueDateElement).toHaveTextContent('Sep 1, 2026');
  });

  it('dynamically updates invoice due date display when account switches', () => {
    addAccount({
      id: 'acc-ny',
      label: 'NY Account',
      apiKey: 'key-ny',
      timezone: 'America/New_York',
    });
    addAccount({
      id: 'acc-tokyo',
      label: 'Tokyo Account',
      apiKey: 'key-tokyo',
      timezone: 'Asia/Tokyo',
    });

    switchAccount('acc-ny');

    const { rerender } = render(
      <InvoiceCard
        invoiceNumber="INV-1001"
        amountDue="$4,200"
        dueDate="2026-09-01T01:00:00Z"
        locale="en-US"
      />
    );

    expect(screen.getByTestId('invoice-card-due-date')).toHaveTextContent('Aug 31, 2026');

    act(() => {
      switchAccount('acc-tokyo');
    });

    expect(screen.getByTestId('invoice-card-due-date')).toHaveTextContent('Sep 1, 2026');
  });
});

