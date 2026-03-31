interface ErrorPageProps {
  code: string;
  title: string;
  message: string;
  primaryAction: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  supportContact?: { label: string; href: string };
  statusLink?: { label: string; href: string };
}

export default function ErrorPage({
  code,
  title,
  message,
  primaryAction,
  secondaryAction,
  supportContact,
  statusLink,
}: ErrorPageProps) {
  return (
    <section
      className="surface placeholder-card not-found server-error"
      aria-labelledby="error-title"
    >
      <div className="error-illustration" aria-hidden="true">
        <span>!</span>
      </div>
      <p className="not-found-code">{code}</p>
      <h2 id="error-title">{title}</h2>
      <p className="not-found-message">{message}</p>
      <p className="helper-text">
        This is on us. Your data is safe, and our team is already looking into
        it.
      </p>

      <div className="hero-actions not-found-actions">
        <button className="primary-button" onClick={primaryAction.onClick} type="button">
          {primaryAction.label}
        </button>

        {secondaryAction && (
          <button className="secondary-button" onClick={secondaryAction.onClick} type="button">
            {secondaryAction.label}
          </button>
        )}
      </div>

      {(supportContact || statusLink) && (
        <div className="error-links" aria-label="Support and status links">
          {supportContact && (
            <a href={supportContact.href} className="error-link-pill">
              {supportContact.label}
            </a>
          )}
          {statusLink && (
            <a href={statusLink.href} className="error-link-pill">
              {statusLink.label}
            </a>
          )}
        </div>
      )}
    </section>
  );
}

export function ServerError({ onRetry, onGoHome }: { onRetry: () => void; onGoHome: () => void }) {
  return (
    <ErrorPage
      code="Error 500"
      title="Something Went Wrong"
      message="We're experiencing technical difficulties. Please try again later."
      primaryAction={{ label: "Try Again", onClick: onRetry }}
      secondaryAction={{ label: "Go to Home", onClick: onGoHome }}
      supportContact={{ label: "Contact Support", href: "mailto:support@callora.com" }}
      statusLink={{ label: "View Status Page", href: "/status" }}
    />
  );
}
