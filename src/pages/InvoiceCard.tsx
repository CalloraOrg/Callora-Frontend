import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from '../hooks/useAccount';
import { useAccountContext } from '../hooks/useAccountContext';
import { formatDueDate, formatUsdcDecimal } from '../utils/format';
import { StatusBadge, type StatusVariant } from '../components/StatusBadge';
import Skeleton from '../components/Skeleton';
import {
  DEMO_INVOICE,
  fetchLatestInvoices,
  InvoicesFetchError,
  isInvoiceDemoMode,
  isInvoicesAbortError,
  normalizeInvoiceStatus,
  selectNewestPendingInvoice,
  type InvoiceItem,
} from '../api/invoicesApi';

/**
 * Props for the InvoiceCard component.
 */
export type InvoiceCardProps = {
  /** The invoice number to display (e.g., 'INV-1001') */
  invoiceNumber: string;
  /** The formatted amount due (e.g., '12.3456789 USDC') */
  amountDue: string;
  /** Optional due date / billing period end string, timestamp, or ISO string. Defaults to 'Due in 7 days' */
  dueDate?: string | Date | number;
  /** Optional timezone override (e.g., 'America/New_York'). Defaults to current account's timezone or system timezone */
  timezone?: string;
  /** Optional locale override (e.g., 'en-US') */
  locale?: string;
  /** Optional invoice status (e.g., 'pending', 'paid', 'void', 'canceled'). Unknown values render a neutral badge. */
  status?: string;
  /** Optional flag indicating whether this is a demo invoice in static preview mode. */
  isDemo?: boolean;
  /** Callback triggered when the 'Pay now' primary action is clicked */
  onPay?: () => void;
  /** Callback triggered when the 'Download' secondary action is clicked */
  onDownload?: () => void;
};

const SCROLL_THRESHOLD = 140;

/**
 * Map a raw or normalised invoice status to a `StatusBadge` variant and human-readable label.
 * Unknown status values map to a neutral badge (`maintenance` / `"Unknown"`) rather than crashing.
 */
export function invoiceStatusToBadgeProps(status: string | undefined): {
  variant: StatusVariant;
  label: string;
} {
  const normalized = normalizeInvoiceStatus(status);
  switch (normalized) {
    case 'pending':
      return { variant: 'pending', label: 'Pending' };
    case 'paid':
      return { variant: 'success', label: 'Paid' };
    case 'void':
      return { variant: 'maintenance', label: 'Void' };
    case 'canceled':
      return { variant: 'maintenance', label: 'Canceled' };
    default:
      return { variant: 'maintenance', label: 'Unknown' };
  }
}

/**
 * InvoiceCard component displaying invoice details for the GrantFox FWC26 campaign.
 * Features a sticky bottom action bar that appears on scroll.
 */
export function InvoiceCard({
  invoiceNumber,
  amountDue,
  dueDate = 'Due in 7 days',
  timezone,
  locale,
  status,
  isDemo = false,
  onPay,
  onDownload,
}: InvoiceCardProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const { timezone: contextTimezone } = useAccountContext();
  const storeAccount = useAccount();

  const effectiveTimezone = timezone ?? contextTimezone ?? storeAccount?.timezone;

  const formattedDueDate = useMemo(() => {
    return formatDueDate(dueDate, {
      timeZone: effectiveTimezone,
      locale,
    });
  }, [dueDate, effectiveTimezone, locale]);

  const badgeProps = useMemo(() => {
    if (status === undefined) return null;
    return invoiceStatusToBadgeProps(status);
  }, [status]);

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
          <p className="invoice-card__eyebrow">
            Invoice
            {isDemo && (
              <span
                data-testid="invoice-card-demo-badge"
                style={{
                  marginLeft: '8px',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  fontSize: '0.7rem',
                  background: 'var(--surface-soft)',
                  border: '1px solid var(--line)',
                  color: 'var(--muted)',
                }}
              >
                Demo invoice
              </span>
            )}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 id="invoice-card-title" className="invoice-card__title">
              {invoiceNumber}
            </h2>
            {badgeProps && (
              <StatusBadge status={badgeProps.variant} label={badgeProps.label} />
            )}
          </div>
        </div>
        <div className="invoice-card__amount">
          <span className="invoice-card__amount-label">Amount due</span>
          <strong data-testid="invoice-card-amount">{amountDue}</strong>
        </div>
      </header>

      <div className="invoice-card__meta">
        <span data-testid="invoice-card-due-date">{formattedDueDate}</span>
        <span>Callora API usage</span>
      </div>

      <div className="invoice-card__body">
        <p>
          Review the invoice details, then continue to payment or download a copy
          for your records.
        </p>
      </div>

      <div
        className={`theme-sticky-bar${isScrolled ? ' theme-sticky-bar--visible' : ''}`}
        role="toolbar"
        aria-label="Invoice actions"
        aria-hidden={!isScrolled}
        {...(!isScrolled ? { inert: '' } : {})}
        data-testid="invoice-card-action-bar"
      >
        <div className="theme-sticky-bar__inner">
          <button
            type="button"
            className="theme-sticky-bar__btn theme-sticky-bar__btn--primary"
            onClick={onPay}
            aria-label="Pay now"
          >
            Pay now
          </button>
          <button
            type="button"
            className="theme-sticky-bar__btn"
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

export type BillingInvoiceSectionProps = {
  /** Optional locale override for date and USDC formatting. */
  locale?: string;
  /** Optional fetch implementation override for testing. */
  fetchImpl?: typeof fetch;
  /** Callback triggered when 'Pay now' is clicked on the active invoice. */
  onPay?: () => void;
  /** Callback triggered when 'Download' is clicked on the active invoice. */
  onDownload?: () => void;
};

type LoadState =
  | { kind: 'loading' }
  | { kind: 'demo'; invoice: InvoiceItem }
  | { kind: 'ready'; invoice: InvoiceItem | null }
  | { kind: 'unauthorized'; message: string }
  | { kind: 'error'; message: string };

/**
 * Container component that loads the authenticated user's latest open invoice
 * from `GET /api/invoices`, picks the newest `pending` invoice, and renders the
 * appropriate loading skeleton, empty state, 401 sign-in prompt, error retry,
 * demo invoice, or `InvoiceCard`.
 */
export function BillingInvoiceSection({
  locale,
  fetchImpl,
  onPay,
  onDownload,
}: BillingInvoiceSectionProps = {}) {
  const { account, timezone: contextTimezone } = useAccountContext();
  const storeAccount = useAccount();
  const activeAccount = account ?? storeAccount;
  const activeAccountId = activeAccount?.id ?? null;
  const effectiveTimezone = contextTimezone ?? activeAccount?.timezone;

  const [state, setState] = useState<LoadState>(() =>
    isInvoiceDemoMode() && !fetchImpl
      ? { kind: 'demo', invoice: DEMO_INVOICE }
      : { kind: 'loading' },
  );

  const requestSeqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const loadInvoices = useCallback(() => {
    abortRef.current?.abort();

    if (isInvoiceDemoMode() && !fetchImpl) {
      abortRef.current = null;
      setState({ kind: 'demo', invoice: DEMO_INVOICE });
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const seq = ++requestSeqRef.current;

    setState({ kind: 'loading' });

    fetchLatestInvoices({
      limit: 20,
      signal: controller.signal,
      fetchImpl,
    })
      .then((res) => {
        if (controller.signal.aborted || seq !== requestSeqRef.current) return;
        const newestPending = selectNewestPendingInvoice(res.data);
        setState({ kind: 'ready', invoice: newestPending });
      })
      .catch((err: unknown) => {
        if (
          controller.signal.aborted ||
          isInvoicesAbortError(err) ||
          seq !== requestSeqRef.current
        ) {
          return;
        }
        if (err instanceof InvoicesFetchError && (err.status === 401 || err.code === 'UNAUTHORIZED')) {
          setState({
            kind: 'unauthorized',
            message: err.message || 'Sign in to view your latest invoices.',
          });
          return;
        }
        setState({
          kind: 'error',
          message:
            err instanceof Error && err.message
              ? err.message
              : 'Could not load your latest invoice. Please try again.',
        });
      });
  }, [fetchImpl]);

  useEffect(() => {
    loadInvoices();
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [loadInvoices, activeAccountId]);

  if (state.kind === 'loading') {
    return (
      <section
        className="invoice-card"
        aria-busy="true"
        aria-label="Loading latest invoice"
        data-testid="invoice-card-skeleton"
      >
        <div className="invoice-card__header">
          <div style={{ display: 'grid', gap: '8px', flex: 1 }}>
            <Skeleton width={80} height={14} />
            <Skeleton width={160} height={26} />
          </div>
          <div className="invoice-card__amount" style={{ display: 'grid', gap: '8px', justifyItems: 'end' }}>
            <Skeleton width={90} height={14} />
            <Skeleton width={120} height={24} />
          </div>
        </div>
        <div className="invoice-card__meta">
          <Skeleton width={140} height={16} />
          <Skeleton width={120} height={16} />
        </div>
        <div className="invoice-card__body">
          <Skeleton width="85%" height={16} />
        </div>
      </section>
    );
  }

  if (state.kind === 'unauthorized') {
    return (
      <section
        className="invoice-card"
        role="alert"
        aria-live="polite"
        data-testid="invoice-card-unauthorized"
      >
        <header className="invoice-card__header">
          <div>
            <p className="invoice-card__eyebrow">Invoice</p>
            <h2 className="invoice-card__title">Not signed in</h2>
          </div>
        </header>
        <div className="invoice-card__body">
          <p>{state.message} Please sign in to view and pay your billing invoices.</p>
        </div>
      </section>
    );
  }

  if (state.kind === 'error') {
    return (
      <section
        className="invoice-card"
        role="alert"
        aria-live="assertive"
        data-testid="invoice-card-error"
      >
        <header className="invoice-card__header">
          <div>
            <p className="invoice-card__eyebrow">Invoice</p>
            <h2 className="invoice-card__title">Unable to load invoice</h2>
          </div>
        </header>
        <div className="invoice-card__body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <p style={{ margin: 0 }}>{state.message}</p>
          <button
            type="button"
            className="secondary-button"
            onClick={loadInvoices}
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  if (state.kind === 'ready' && !state.invoice) {
    return (
      <section
        className="invoice-card"
        aria-label="Invoice status"
        data-testid="invoice-card-empty"
      >
        <header className="invoice-card__header">
          <div>
            <p className="invoice-card__eyebrow">Invoice</p>
            <h2 className="invoice-card__title">No outstanding invoices</h2>
          </div>
        </header>
        <div className="invoice-card__body">
          <p style={{ margin: 0 }}>
            You are all caught up. View past statements in{' '}
            <Link to="/billing/history" className="link-body">
              Billing History
            </Link>
            .
          </p>
        </div>
      </section>
    );
  }

  const invoice = state.invoice!;
  const isDemo = state.kind === 'demo';
  const formattedAmount = formatUsdcDecimal(invoice.totalAmountUsdc, { locale });

  return (
    <InvoiceCard
      invoiceNumber={invoice.invoiceNumber}
      amountDue={formattedAmount}
      dueDate={invoice.periodEnd}
      timezone={effectiveTimezone}
      locale={locale}
      status={invoice.rawStatus || invoice.status}
      isDemo={isDemo}
      onPay={onPay}
      onDownload={onDownload}
    />
  );
}
