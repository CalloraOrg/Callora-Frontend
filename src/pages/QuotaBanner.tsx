import EmptyState from '../components/EmptyState';
import FormField from '../components/FormField';
import './QuotaBanner.css';

export type QuotaStatus = 'ok' | 'warn' | 'danger';

export type QuotaBannerProps = {
  title?: string;
  status?: QuotaStatus;
  statusLabel?: string;
  hint?: string;
  extraInfo?: string;
  inputId?: string;
  value?: string;
  onChange?: (value: string) => void;
  statusOptions?: FieldStatus;
  /**
   * When true (and `onSetupQuota` is provided), renders the themed
   * `quota-banner` EmptyState instead of the quota form — GrantFox FWC26
   * empty-state pattern (issue #702 / b#025).
   */
  showEmptyState?: boolean;
  /** Primary CTA for the empty state — opens the quota setup flow. */
  onSetupQuota?: () => void;
};

export type FieldStatus = 'idle' | 'error' | 'success';

/** Stable id for the empty-state heading; wired via aria-labelledby. */
const EMPTY_HEADING_ID = 'quota-banner-empty-heading';

/**
 * QuotaBanner — displays current quota status or a themed empty state.
 *
 * Empty state (issue #702 / b#025):
 * - Uses EmptyState `variant="quota-banner"` with a gauge-and-bars illustration.
 * - Illustration is decorative (`aria-hidden`); title + message carry meaning
 *   (WCAG 1.1.1 / 1.4.1).
 * - "Set up quota" CTA guides users to configure limits when no data exists.
 * - All colors use design tokens for light/dark consistency.
 */
export default function QuotaBanner({
  title = 'Quota Details',
  status = 'ok',
  statusLabel,
  hint = 'Enter quota amount',
  extraInfo = 'Some extra info about quota.',
  inputId = 'quota-input',
  value = '',
  onChange,
  statusOptions = 'idle',
  showEmptyState = false,
  onSetupQuota,
}: QuotaBannerProps) {
  // Themed empty state with helpful CTA when no quota data is configured.
  if (showEmptyState && onSetupQuota) {
    return (
      <section
        className="quota-banner quota-banner--empty"
        aria-labelledby={EMPTY_HEADING_ID}
      >
        <EmptyState
          variant="quota-banner"
          headingId={EMPTY_HEADING_ID}
          title="No quota configured"
          message="No quota has been configured for this API yet. Set a quota to track and manage your usage limits."
          action={{
            label: 'Set up quota',
            onClick: onSetupQuota,
          }}
        />
      </section>
    );
  }

  const statusLabels: Record<QuotaStatus, string> = {
    ok: 'Active',
    warn: 'Warning',
    danger: 'Exceeded',
  };

  const displayLabel = statusLabel ?? statusLabels[status];

  return (
    <section className="quota-banner" aria-labelledby="quota-banner-title">
      <header className="quota-banner__header">
        <h2 id="quota-banner-title" className="quota-banner__title">
          {title}
        </h2>
        <span className={`quota-banner__status quota-banner__status--${status}`}>
          {displayLabel}
        </span>
      </header>
      <div className="quota-banner__field">
        <FormField
          id={inputId}
          label="Quota"
          hint={hint}
          status={statusOptions}
        >
          <input
            type="text"
            id={inputId}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            aria-describedby={`${inputId}-hint ${inputId}-extra-info`}
          />
        </FormField>
      </div>
      <p id={`${inputId}-extra-info`} className="quota-banner__hint">
        {extraInfo}
      </p>
    </section>
  );
}
