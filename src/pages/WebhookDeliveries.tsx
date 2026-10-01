import { useState } from 'react';
import { useWebhookDeliveries } from '../hooks/useWebhookDeliveries';
import { useToast } from '../components/Toast';
import { Pagination } from '../components/Pagination';

export default function WebhookDeliveries() {
  const [accountId, setAccountId] = useState('acc_123'); // Simulate account switch
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
    refresh
  } = useWebhookDeliveries(accountId);

  const { showToast } = useToast();

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
            onChange={(e) => setFilter(f => ({ ...f, status: e.target.value as any, page: 1 }))}
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
          <br/>
          <button onClick={refresh}>Retry Load</button>
        </div>
      )}

      {(status === 'success' || isStale) && (
        <div
          className={`webhook-deliveries-data${isStale ? ' webhook-deliveries-data--stale' : ''}`}
          aria-busy={isStale}
        >
          {isStale && <p className="webhook-deliveries-stale-note" role="status">Updating data...</p>}
          
          {deliveries.length === 0 ? (
            <div className="empty-state">No deliveries found.</div>
          ) : (
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ borderBottom: '1px solid #ccc', padding: '8px' }}>ID</th>
                  <th style={{ borderBottom: '1px solid #ccc', padding: '8px' }}>URL</th>
                  <th style={{ borderBottom: '1px solid #ccc', padding: '8px' }}>Status</th>
                  <th style={{ borderBottom: '1px solid #ccc', padding: '8px' }}>Attempts</th>
                  <th style={{ borderBottom: '1px solid #ccc', padding: '8px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map(d => (
                  <tr key={d.id}>
                    <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{d.id}</td>
                    <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{d.url}</td>
                    <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{d.status}</td>
                    <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{d.attempts}</td>
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
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
