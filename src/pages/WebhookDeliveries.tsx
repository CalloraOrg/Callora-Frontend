import { Fragment, useEffect, useState } from 'react';
import {
  useWebhookDeliveries,
  type WebhookDeliveriesFetcher,
  type WebhookDelivery,
} from '../hooks/useWebhookDeliveries';
import { useAccountId } from '../hooks/useAccount';
import { useToast } from '../components/Toast';
import { Pagination } from '../components/Pagination';
import { JsonViewer } from '../components/JsonViewer';
import { redactSensitiveData } from '../services/SecureErrorHandler';

const MOBILE_MEDIA_QUERY = '(max-width: 639px)';
const MAX_VISIBLE_PATH_LENGTH = 28;

/** Format an ISO string or Date into a human-readable local timestamp. */
function formatTimestamp(value: string | Date | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Return an ISO 8601 string suitable for a <time dateTime="..."> attribute. */
function toIsoString(value: string | Date | undefined): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return String(value);
  return date.toISOString();
}

/** Format an ISO string or Date into a compact relative timestamp (e.g. "2m ago"). */
function formatRelativeTimestamp(value: string | Date | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return String(value);

  const diffSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSeconds < 60) return 'Just now';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

/**
 * Format a webhook URL as host plus a truncated path for compact display while
 * preserving the full URL for tooltips and assistive technology.
 */
function formatDisplayUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const fullPath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (fullPath.length <= MAX_VISIBLE_PATH_LENGTH) {
      return `${parsed.host}${fullPath}`;
    }
    return `${parsed.host}${fullPath.slice(0, MAX_VISIBLE_PATH_LENGTH)}…`;
  } catch {
    if (rawUrl.length <= MAX_VISIBLE_PATH_LENGTH * 2) return rawUrl;
    return `${rawUrl.slice(0, MAX_VISIBLE_PATH_LENGTH * 2)}…`;
  }
}

/**
 * Redact and normalise a requestBody / responseBody value before handing it
 * to JsonViewer. Objects are stringified first so redactSensitiveData (which
 * accepts only string | Error) can do its work, then the result is parsed back
 * to an object for pretty-printing.
 */
function safeRedact(value: string | object | undefined): unknown {
  if (value === undefined || value === null) return undefined;
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  const redacted = redactSensitiveData(raw);
  try {
    return JSON.parse(redacted);
  } catch {
    return redacted;
  }
}

/** Stacked detail content shared by desktop expanded table rows and mobile cards. */
function DeliveryDetailContent({ delivery }: { delivery: WebhookDelivery }) {
  const redactedRequest = safeRedact(delivery.requestBody);
  const redactedResponse = safeRedact(delivery.responseBody);

  return (
    <div className="webhook-detail-stack">
      {delivery.responseStatus !== undefined && (
        <div>
          <strong>Response Status:</strong>{' '}
          <span
            style={{
              fontFamily: 'monospace',
              color: delivery.responseStatus >= 400 ? 'var(--danger)' : 'var(--success)',
            }}
          >
            {delivery.responseStatus}
          </span>
        </div>
      )}

      {redactedRequest !== undefined && (
        <div className="webhook-detail-section">
          <strong>Request Body:</strong>
          <div
            className="webhook-json-scroll"
            tabIndex={0}
            role="region"
            aria-label={`Request body JSON for ${delivery.id}`}
          >
            <JsonViewer data={redactedRequest} />
          </div>
        </div>
      )}

      {redactedResponse !== undefined && (
        <div className="webhook-detail-section">
          <strong>Response Body:</strong>
          <div
            className="webhook-json-scroll"
            tabIndex={0}
            role="region"
            aria-label={`Response body JSON for ${delivery.id}`}
          >
            <JsonViewer data={redactedResponse} />
          </div>
        </div>
      )}
    </div>
  );
}

/** Expandable detail panel rendered beneath a table row when open. */
function DeliveryDetailPanel({ delivery }: { delivery: WebhookDelivery }) {
  return (
    <tr id={`webhook-detail-${delivery.id}`}>
      <td
        colSpan={7}
        className="webhook-detail-cell"
      >
        <DeliveryDetailContent delivery={delivery} />
      </td>
    </tr>
  );
}

function detectMobileViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
}

interface WebhookDeliveriesProps {
  /** Injectable for tests; defaults to the hook's fetcher. */
  fetcher?: WebhookDeliveriesFetcher;
}

export default function WebhookDeliveries({ fetcher }: WebhookDeliveriesProps = {}) {
  // Without a connected account, show the bundled sample deliveries.
  const accountId = useAccountId() ?? 'demo-account';
  const {
    deliveries,
    totalCount,
    status,
    error,
    isStale,
    filter,
    setFilter,
    retryDelivery,
    retryingId,
    refresh,
  } = useWebhookDeliveries(accountId, fetcher);

  const [isMobile, setIsMobile] = useState<boolean>(detectMobileViewport);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mql = window.matchMedia(MOBILE_MEDIA_QUERY);
    setIsMobile(mql.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handleChange);
      return () => mql.removeEventListener('change', handleChange);
    }
    mql.addListener?.(handleChange);
    return () => mql.removeListener?.(handleChange);
  }, []);

  // Pagination belongs to the account being viewed: switching accounts starts
  // again from the first page.
  useEffect(() => {
    setFilter((f) => (f.page === 1 ? f : { ...f, page: 1 }));
  }, [accountId, setFilter]);

  const { showToast } = useToast();

  // Track which row ids are expanded.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleRetry = async (id: string) => {
    if (retryingId === id) return;
    try {
      await retryDelivery(id);
      showToast('Retry triggered successfully');
    } catch (err: any) {
      showToast({ message: `Retry failed: ${err.message}`, variant: 'error', persistent: true });
    }
  };

  const handleCopyId = async (id: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(id);
      }
      setCopiedId(id);
    } catch {
      // Ignore clipboard permission errors in restricted contexts
    }
  };

  return (
    <div className="webhook-deliveries">
      <p className="eyebrow">Developer tools</p>
      <h1>Webhook Deliveries</h1>
      <p className="webhook-deliveries-intro">
        Every event Callora sends to your endpoints, with the request and response bodies. Failed deliveries can be retried.
      </p>

      <div className="webhook-deliveries-toolbar">
        <label className="webhook-deliveries-filter">
          Status
          <select
            value={filter.status}
            onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value as any, page: 1 }))}
          >
            <option value="all">All</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
        </label>
        <button type="button" className="secondary-button" onClick={refresh}>Refresh</button>
      </div>

      <Pagination
        mode="cursor"
        currentPageIndex={filter.page - 1}
        hasNextPage={filter.page * 2 < totalCount}
        hasPreviousPage={filter.page > 1}
        totalItemCount={totalCount}
        pageSize={2}
        onGoNext={() => setFilter(f => ({ ...f, page: f.page + 1 }))}
        onGoPrevious={() => setFilter(f => ({ ...f, page: Math.max(1, f.page - 1) }))}
        onPageSizeChange={() => {}}
      />

      {status === 'loading' && <p role="status">Loading deliveries...</p>}
      {status === 'error' && (
        <div role="alert" className="webhook-deliveries-error">
          <strong>Error:</strong> {error}
          <br />
          <button type="button" className="secondary-button" onClick={refresh}>Retry Load</button>
        </div>
      )}

      {(status === 'success' || isStale) && (
        <div
          className={`webhook-deliveries-data${isStale ? ' webhook-deliveries-data--stale' : ''}`}
          aria-busy={isStale}
        >
          {isStale && (
            <p className="webhook-deliveries-stale-note" role="status">
              Updating data...
            </p>
          )}

          {deliveries.length === 0 ? (
            <div className="empty-state surface webhook-deliveries-empty">No deliveries match this filter.</div>
          ) : isMobile ? (
            <div className="webhook-deliveries-cards">
              {deliveries.map((d) => {
                const isExpanded = expandedIds.has(d.id);
                const detailId = `webhook-detail-${d.id}`;
                const timestampSource = d.createdAt ?? d.lastAttemptAt;
                const absoluteTime = formatTimestamp(timestampSource);
                const relativeTime = formatRelativeTimestamp(timestampSource);
                const isoTime = toIsoString(timestampSource);
                const displayUrl = formatDisplayUrl(d.url);

                return (
                  <article
                    key={d.id}
                    className="webhook-delivery-card surface"
                    aria-label={`Delivery ${d.id}`}
                  >
                    <div className="webhook-delivery-card__header">
                      <span className={`webhook-status webhook-status--${d.status}`}>
                        <span className="webhook-status__dot" aria-hidden="true" />
                        {d.status}
                      </span>
                      <div className="webhook-delivery-card__id-group">
                        <code className="webhook-delivery-card__id">{d.id}</code>
                        <button
                          type="button"
                          className="ghost-button webhook-delivery-card__copy"
                          onClick={() => handleCopyId(d.id)}
                          aria-label={`Copy delivery ID ${d.id}`}
                        >
                          {copiedId === d.id ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>

                    <div className="webhook-delivery-card__url-row">
                      <span
                        className="webhook-delivery-card__url"
                        title={d.url}
                        aria-label={d.url}
                      >
                        <span aria-hidden="true">{displayUrl}</span>
                      </span>
                    </div>

                    <div className="webhook-delivery-card__meta">
                      <span>
                        Attempts: <strong>{d.attempts}</strong>
                      </span>
                      <time
                        dateTime={isoTime}
                        title={absoluteTime}
                        className="webhook-delivery-card__time"
                      >
                        {relativeTime}
                      </time>
                    </div>

                    <div className="webhook-delivery-card__actions">
                      <button
                        type="button"
                        className="secondary-button webhook-delivery-card__details-btn"
                        aria-expanded={isExpanded}
                        aria-controls={detailId}
                        onClick={() => toggleExpanded(d.id)}
                      >
                        Details
                      </button>
                      {d.status === 'failed' && (
                        <button
                          type="button"
                          className="ghost-button webhook-delivery-card__retry-btn"
                          onClick={() => handleRetry(d.id)}
                          disabled={retryingId === d.id}
                        >
                          {retryingId === d.id ? 'Retrying...' : 'Retry'}
                        </button>
                      )}
                    </div>

                    {isExpanded && (
                      <div
                        id={detailId}
                        className="webhook-delivery-card__detail"
                      >
                        <DeliveryDetailContent delivery={d} />
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="webhook-deliveries-table-wrap surface">
            <table className="webhook-deliveries-table">
              <thead>
                <tr>
                  <th scope="col" aria-label="Expand row" />
                  <th scope="col">ID</th>
                  <th scope="col">URL</th>
                  <th scope="col">Status</th>
                  <th scope="col">Attempts</th>
                  <th scope="col">Timestamp</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d) => {
                  const isExpanded = expandedIds.has(d.id);
                  const detailId = `webhook-detail-${d.id}`;
                  const displayUrl = formatDisplayUrl(d.url);
                  return (
                    <Fragment key={d.id}>
                      <tr>
                        <td>
                          <button
                            type="button"
                            aria-expanded={isExpanded}
                            aria-controls={detailId}
                            aria-label={isExpanded ? `Collapse details for ${d.id}` : `Expand details for ${d.id}`}
                            onClick={() => toggleExpanded(d.id)}
                            className="webhook-expand-button"
                          >
                            {isExpanded ? '▲' : '▼'}
                          </button>
                        </td>
                        <td>{d.id}</td>
                        <td className="webhook-deliveries-url-cell">
                          <span
                            className="webhook-delivery-url"
                            title={d.url}
                            aria-label={d.url}
                          >
                            <span aria-hidden="true">{displayUrl}</span>
                          </span>
                        </td>
                        <td><span className={`webhook-status webhook-status--${d.status}`}>{d.status}</span></td>
                        <td>{d.attempts}</td>
                        <td>
                          {formatTimestamp(d.createdAt ?? d.lastAttemptAt)}
                        </td>
                        <td>
                          {d.status === 'failed' && (
                            <button
                              type="button"
                              className="ghost-button"
                              onClick={() => handleRetry(d.id)}
                              disabled={retryingId === d.id}
                            >
                              {retryingId === d.id ? 'Retrying...' : 'Retry'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {isExpanded && <DeliveryDetailPanel delivery={d} />}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
