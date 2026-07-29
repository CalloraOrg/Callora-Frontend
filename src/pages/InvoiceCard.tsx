import { useEffect, useState } from 'react';

export type InvoiceCardProps = {
  invoiceNumber: string;
  amountDue: string;
  dueDate?: string;
  onPay?: () => void;
  onDownload?: () => void;
};

const SCROLL_THRESHOLD = 140;

export function InvoiceCard({
  invoiceNumber,
  amountDue,
  dueDate = 'Due in 7 days',
  onPay,
  onDownload,
}: InvoiceCardProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > SCROLL_THRESHOLD);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <section className="invoice-card" aria-labelledby="invoice-card-title">
      <header className="invoice-card__header">
        <div>
          <p className="invoice-card__eyebrow">Invoice</p>
          <h2 id="invoice-card-title" className="invoice-card__title">
            {invoiceNumber}
          </h2>
        </div>
        <div className="invoice-card__amount">
          <span className="invoice-card__amount-label">Amount due</span>
          <strong>{amountDue}</strong>
        </div>
      </header>

      <div className="invoice-card__meta">
        <span>{dueDate}</span>
        <span>GrantFox FWC26</span>
      </div>

      <div className="invoice-card__body">
        <p>
          Review the invoice details, then continue to payment or download a copy
          for your records.
        </p>
      </div>

      <div
        className={`invoice-card-action-bar${isScrolled ? ' invoice-card-action-bar--visible' : ''}`}
        role="toolbar"
        aria-label="Invoice actions"
        aria-hidden={!isScrolled}
        {...(!isScrolled ? { inert: '' } : {})}
        data-testid="invoice-card-action-bar"
      >
        <div className="invoice-card-action-bar__inner">
          <button
            type="button"
            className="invoice-card-action-bar__button invoice-card-action-bar__button--primary"
            onClick={onPay}
            aria-label="Pay now"
          >
            Pay now
          </button>
          <button
            type="button"
            className="invoice-card-action-bar__button"
            onClick={onDownload}
            aria-label="Download invoice"
          >
            Download
          </button>
        </div>
      </div>
    </section>
  );
}
