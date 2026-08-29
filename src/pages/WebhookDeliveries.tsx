import { useState } from 'react';
import { useWebhookDeliveries } from '../hooks/useWebhookDeliveries';
import { ToastProvider, Toast } from '../components/Toast';

export default function WebhookDeliveries() {
  const [accountId, setAccountId] = useState('acc_123'); // Simulate account switch
  const {
    deliveries,
    status,
    error,
    isStale,
    filter,
    setFilter,
    retryDelivery,
    retryingId,
    refresh
  } = useWebhookDeliveries(accountId);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleRetry = async (id: string) => {
    try {
      await retryDelivery(id);
      setToastMessage('Retry triggered successfully');
    } catch (err: any) {
      setToastMessage(`Retry failed: ${err.message}`);
    }
  };

  return (
    <div className="webhook-deliveries" style={{ padding: '24px' }}>
      <h1>Webhook Deliveries</h1>
      
      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
        <button onClick={() => setAccountId(accountId === 'acc_123' ? 'acc_456' : 'acc_123')}>
          Switch Account (Current: {accountId})
        </button>
        <button onClick={() => setAccountId('error-account')}>
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
        
        <label>
          Page:
          <button onClick={() => setFilter(f => ({ ...f, page: Math.max(1, f.page - 1) }))}>Prev</button>
          <span style={{ margin: '0 8px' }}>{filter.page}</span>
          <button onClick={() => setFilter(f => ({ ...f, page: f.page + 1 }))}>Next</button>
        </label>
      </div>

      {status === 'loading' && <p>Loading deliveries...</p>}
      {status === 'error' && (
        <div style={{ color: 'red', border: '1px solid red', padding: '16px' }}>
          <strong>Error:</strong> {error}
          <br/>
          <button onClick={refresh}>Retry Load</button>
        </div>
      )}

      {(status === 'success' || isStale) && (
        <div style={{ opacity: isStale ? 0.6 : 1, transition: 'opacity 0.2s' }}>
          {isStale && <p style={{ color: 'orange' }}>Updating data...</p>}
          
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
      
      <ToastProvider />
      {toastMessage && (
        <Toast 
          message={toastMessage} 
          onDismiss={() => setToastMessage(null)} 
          type="info"
        />
      )}
    </div>
  );
}
