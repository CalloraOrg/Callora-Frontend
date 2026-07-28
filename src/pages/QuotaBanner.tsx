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
  showEmptyState?: boolean;
  onSetupQuota?: () => void;
};

export type FieldStatus = 'idle' | 'error' | 'success';

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
  if (showEmptyState && onSetupQuota) {
    return (
      <section
        className="quota-banner"
        aria-labelledby="quota-banner-title"
      >
        <EmptyState
          variant="quota-banner"
          title="No quota configured"
          message="No quota has been configured for this API yet. Set a quota to track and manage your usage limits."
          action={{ label: "Set up quota", onClick: onSetupQuota }}
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