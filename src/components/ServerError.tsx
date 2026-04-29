import { useState, useEffect, useRef } from 'react';

interface ServerErrorProps {
  /** Optional retry callback. When provided, renders the retry button. */
  onRetry?: () => void | Promise<void>;
  /** Optional request ID for support traceability. Displayed as a masked reference only. */
  requestId?: string;
  /** Optional override for the error heading. Defaults to the standard copy. */
  title?: string;
  /** Optional override for the body copy. Defaults to the standard copy. */
  description?: string;
}

export default function ServerError({
  onRetry,
  requestId,
  title = 'Something went wrong on our end',
  description = 'This is not your fault. Our team has been notified and we're working on a fix. Please try again in a moment.',
}: ServerErrorProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [copied, setCopied] = useState(false);
  const retryButtonRef = useRef<HTMLButtonElement>(null);

  // Focus retry button on mount if onRetry is provided
  useEffect(() => {
    if (onRetry && retryButtonRef.current) {
      retryButtonRef.current.focus();
    }
  }, [onRetry]);

  const handleRetry = async () => {
    if (!onRetry || isRetrying) return;

    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  const handleCopyRequestId = async () => {
    if (!requestId) return;

    try {
      await navigator.clipboard.writeText(requestId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Silently fail if clipboard API is not available
      console.error('Failed to copy request ID:', err);
    }
  };

  return (
    <section
      className="surface placeholder-card server-error"
      role="alert"
      style={{
        margin: '0 auto',
        maxWidth: '400px',
        padding: '48px 28px',
        textAlign: 'center',
      }}
    >
      {/* Illustration */}
      <div
        aria-hidden="true"
        style={{
          width: '80px',
          height: '80px',
          margin: '0 auto 24px',
          borderRadius: '50%',
          background: 'var(--surface-soft)',
          border: '1px solid var(--line)',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--muted)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>

      {/* Heading */}
      <h2
        style={{
          margin: '0 0 12px',
          fontSize: 'clamp(1.5rem, 2vw, 1.8rem)',
          fontWeight: '600',
          color: 'var(--text)',
        }}
      >
        {title}
      </h2>

      {/* Body copy */}
      <p className="helper-text" style={{ marginBottom: '24px' }}>
        {description}
      </p>

      {/* Retry button */}
      {onRetry && (
        <button
          ref={retryButtonRef}
          className="primary-button"
          onClick={handleRetry}
          disabled={isRetrying}
          aria-busy={isRetrying}
          type="button"
          style={{
            minWidth: '140px',
            minHeight: '48px',
          }}
        >
          {isRetrying ? 'Retrying…' : 'Try again'}
        </button>
      )}

      {/* Request ID */}
      {requestId && (
        <div
          style={{
            marginTop: '32px',
            paddingTop: '24px',
            borderTop: '1px solid var(--line)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontSize: '0.8125rem',
                color: 'var(--muted)',
                fontFamily: "'Courier New', monospace",
              }}
            >
              Reference: {requestId}
            </span>
            <button
              onClick={handleCopyRequestId}
              className="ghost-button"
              type="button"
              aria-label="Copy request ID"
              style={{
                minHeight: '32px',
                padding: '0 12px',
                fontSize: '0.8125rem',
              }}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div
            aria-live="polite"
            aria-atomic="true"
            style={{
              position: 'absolute',
              left: '-10000px',
              width: '1px',
              height: '1px',
              overflow: 'hidden',
            }}
          >
            {copied ? 'Request ID copied to clipboard' : ''}
          </div>
        </div>
      )}
    </section>
  );
}
