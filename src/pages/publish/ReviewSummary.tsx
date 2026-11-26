export interface ReviewSummaryProps {
  formError: string | null;
  submitting: boolean;
}

export function ReviewSummary({ formError, submitting }: ReviewSummaryProps) {
  return (
    <div className="pa-form-footer">
      {formError && (
        <p className="pa-form-error" role="alert" aria-live="assertive">
          {formError}
        </p>
      )}
      <button
        type="submit"
        className="pa-btn-primary"
        disabled={submitting}
        aria-busy={submitting}
      >
        {submitting ? 'Submitting…' : 'Publish API'}
      </button>
      <p className="pa-form-note">
        Submission is reviewed before going live. API name, base URL,
        category, and at least one endpoint are required.
      </p>
    </div>
  );
}

export interface PublishSuccessViewProps {
  apiName: string;
  listingId: string | null;
  onPublishAnother: () => void;
}

export function PublishSuccessView({
  apiName,
  listingId,
  onPublishAnother,
}: PublishSuccessViewProps) {
  return (
    <div className="pa-shell">
      <div className="pa-success surface" role="alert" aria-live="polite">
        <span className="pa-success-icon" aria-hidden="true">🎉</span>
        <h1 className="pa-success-title">API submitted for review</h1>
        <p className="pa-success-body">
          <strong>{apiName || 'Your API'}</strong> has been submitted and is
          pending review. You&apos;ll receive a notification once it&apos;s live on
          the marketplace.
        </p>
        {listingId && (
          <p className="pa-success-body">
            Listing reference: <code className="pa-success-ref">{listingId}</code>
          </p>
        )}
        <button
          type="button"
          className="pa-btn-primary"
          onClick={onPublishAnother}
        >
          Publish another API
        </button>
      </div>
    </div>
  );
}
