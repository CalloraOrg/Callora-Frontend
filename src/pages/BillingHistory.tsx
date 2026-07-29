import { useId } from 'react';
import PreviewCard, { type PreviewCardData } from '../components/PreviewCard';

export type BillingRecordType = 'invoice' | 'payment' | 'charge' | 'refund';

export interface BillingRecord {
  id: string;
  type: BillingRecordType;
  title: string;
  description?: string;
  amount: number;
  currency?: string;
  date: string;
  status?: 'operational' | 'success' | 'pending' | 'error';
  invoiceNumber?: string;
  category?: string;
  method?: string;
}

export interface BillingHistoryProps {
  records: BillingRecord[];
  className?: string;
}

const TYPE_LABELS: Record<BillingRecordType, string> = {
  invoice: 'Invoice',
  payment: 'Payment',
  charge: 'Usage Charge',
  refund: 'Refund',
};

const AMOUNT_SIGNS: Record<BillingRecordType, 'credit' | 'debit'> = {
  invoice: 'debit',
  payment: 'credit',
  charge: 'debit',
  refund: 'credit',
};

function formatCurrency(amount: number, currency = 'USDC'): string {
  return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function toPreviewCardData(record: BillingRecord): PreviewCardData {
  const sign = AMOUNT_SIGNS[record.type];
  const isCredit = sign === 'credit';

  return {
    id: `billing-preview-${record.id}`,
    title: record.title,
    subtitle: `${TYPE_LABELS[record.type]}${record.invoiceNumber ? ` · ${record.invoiceNumber}` : ''}`,
    category: record.category,
    description: record.description,
    status: record.status ?? 'operational',
    metrics: [
      { label: 'Amount', value: `${isCredit ? '+' : '-'}${formatCurrency(record.amount, record.currency)}` },
      { label: 'Date', value: record.date },
    ],
    price: isCredit ? undefined : Math.abs(record.amount),
    lastActive: record.date,
  };
}

export function BillingHistory({ records, className = '' }: BillingHistoryProps) {
  const titleId = useId();

  return (
    <section
      className={['billing-history', className].filter(Boolean).join(' ')}
      aria-labelledby={titleId}
    >
      <div className="billing-history__header">
        <div>
          <h2 id={titleId} className="billing-history__title">
            Billing History
          </h2>
          <p className="billing-history__subtitle">
            Invoices, payments, and usage charges with preview details on hover or focus.
          </p>
        </div>
      </div>

      {records.length === 0 ? (
        <div className="billing-history__empty" role="status">
          No billing records yet.
        </div>
      ) : (
        <ul className="billing-history__list" role="list">
          {records.map((record) => {
            const previewData = toPreviewCardData(record);
            const sign = AMOUNT_SIGNS[record.type];
            const amountClass =
              sign === 'credit' ? 'billing-history__item-amount--credit' : 'billing-history__item-amount--debit';

            return (
              <li key={record.id} role="listitem">
                <PreviewCard data={previewData} position="left">
                  <div
                    className="billing-history__item"
                    data-testid={`billing-item-${record.id}`}
                  >
                    <div className="billing-history__item-left">
                      <span className="billing-history__item-title">{record.title}</span>
                      <span className="billing-history__item-meta">
                        <span>{TYPE_LABELS[record.type]}</span>
                        {record.invoiceNumber && <span>{record.invoiceNumber}</span>}
                        <span>{record.date}</span>
                      </span>
                    </div>
                    <div className="billing-history__item-right">
                      <span className={['billing-history__item-amount', amountClass].join(' ')}>
                        {sign === 'credit' ? '+' : '-'}
                        {formatCurrency(record.amount, record.currency)}
                      </span>
                    </div>
                  </div>
                </PreviewCard>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default BillingHistory;
