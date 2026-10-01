import { Fragment, useState } from 'react';
import { useWebhookDeliveries, type WebhookDelivery } from '../hooks/useWebhookDeliveries';
import { useToast } from '../components/Toast';
import { Pagination } from '../components/Pagination';
import { JsonViewer } from '../components/JsonViewer';
import { redactSensitiveData } from '../services/SecureErrorHandler';

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

/** Expandable detail panel rendered beneath a table row when open. */
function DeliveryDetailPanel({ delivery }: { delivery: WebhookDelivery }) {
  const redactedRequest = safeRedact(delivery.requestBody);
  const redactedResponse = safeRedact(delivery.responseBody);

  return (
    <tr>
      <td
        colSpan={7}
        style={{ padding: '12px 16px', background: '#f9f9f9', borderBottom: '1px solid #ddd' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {delivery.responseStatus !== undefined && (
            <div>
              <strong>Response Status:</strong>{' '}
              <span
                style={{
                  fontFamily: 'monospace',
                  color: delivery.responseStatus >= 400 ? '#c0392b' : '#27ae60',
                }}
              >
                {delivery.responseStatus}
              </span>
            </div>
          )}

          {redactedRequest !== undefined && (
            <div>
              <strong>Request Body:</strong>
              <JsonViewer data={redactedRequest} />
            </div>
          )}

          {redactedResponse !== undefined && (
            <div>
              <strong>Response Body:</strong>
              <JsonViewer data={redactedResponse} />
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function WebhookDeliveries() {
  const [accountId, setAccountId] = useState('acc_123');
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
  } = useWebhookDeliveries(accountId);

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
    try {
      await retryDelivery(id);
      showToast('Retry triggered successfully');
    } catch (err: any) {
      showToast({ message: `Retry failed: ${err.message}`, variant: 'error', persistent: true });
    }
  };

  return (
    <div className="webhook-deliveries" style={{ padding: '24px' }}>
      <h1>Webhook Deliveries</h1>

      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
        <button onClick={() => {
          setAccountId(accountId === 'acc_123' ? 'acc_456' : 'acc_123');
          setFilter(f => ({ ...f, page: 1 }));
        }}>
          Switch Account (Current: {accountId})
        </button>
        <button onClick={() => {
          setAccountId('error-account');
          setFilter(f => ({ ...f, page: 1 }));
        }}>
          Simulate Error Account
        </button>
        <button onClick={refresh}>Refresh</button>
      </div>

      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
        <label>
          Filter Status:
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
          <button onClick={refresh}>Retry Load</button>
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
            <div className="empty-state">No deliveries found.</div>
          ) : (
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ borderBottom: '1px solid #ccc', padding: '8px' }} aria-label="Expand row" />
                  <th style={{ borderBottom: '1px solid #ccc', padding: '8px' }}>ID</th>
                  <th style={{ borderBottom: '1px solid #ccc', padding: '8px' }}>URL</th>
                  <th style={{ borderBottom: '1px solid #ccc', padding: '8px' }}>Status</th>
                  <th style={{ borderBottom: '1px solid #ccc', padding: '8px' }}>Attempts</th>
                  <th style={{ borderBottom: '1px solid #ccc', padding: '8px' }}>Timestamp</th>
                  <th style={{ borderBottom: '1px solid #ccc', padding: '8px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d) => {
                  const isExpanded = expandedIds.has(d.id);
                  return (
                    <Fragment key={d.id}>
                      <tr>
                        <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>
                          <button
                            aria-expanded={isExpanded}
                            aria-label={isExpanded ? `Collapse details for ${d.id}` : `Expand details for ${d.id}`}
                            onClick={() => toggleExpanded(d.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '2px 4px',
                              fontSize: '12px',
                              lineHeight: 1,
                            }}
                          >
                            {isExpanded ? '▲' : '▼'}
                          </button>
                        </td>
                        <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{d.id}</td>
                        <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{d.url}</td>
                        <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{d.status}</td>
                        <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{d.attempts}</td>
                        <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>
                          {formatTimestamp(d.createdAt)}
                        </td>
                        <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>
                          {d.status === 'failed' && (
                            <button
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
          )}
        </div>
      )}
    </div>
  );
}
