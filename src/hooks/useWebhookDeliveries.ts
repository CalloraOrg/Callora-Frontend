import { useState, useEffect, useRef, useCallback } from 'react';

export interface WebhookDelivery {
  id: string;
  url: string;
  status: 'delivered' | 'failed' | 'pending';
  attempts: number;
  lastAttemptAt: string;
}

export interface WebhookFilter {
  status?: WebhookDelivery['status'] | 'all';
  page: number;
}

// Mock API function
export const fetchDeliveries = async (accountId: string, filter: WebhookFilter, signal: AbortSignal): Promise<WebhookDelivery[]> => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (signal.aborted) {
        return reject(new DOMException('Aborted', 'AbortError'));
      }
      if (accountId === 'error-account') {
        return reject(new Error('Failed to fetch from authoritative source'));
      }
      
      const data: WebhookDelivery[] = [
        { id: `dlv_1_${filter.page}`, url: 'https://example.com/webhook', status: 'delivered', attempts: 1, lastAttemptAt: new Date().toISOString() },
        { id: `dlv_2_${filter.page}`, url: 'https://example.com/webhook', status: 'failed', attempts: 3, lastAttemptAt: new Date().toISOString() },
      ];
      
      let filtered = data;
      if (filter.status && filter.status !== 'all') {
         filtered = data.filter(d => d.status === filter.status);
      }
      
      resolve(filtered);
    }, 50);
    
    signal.addEventListener('abort', () => clearTimeout(timeout));
  });
};

export const retryDeliveryApi = async (deliveryId: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (deliveryId === 'dlv_fail') reject(new Error('Retry failed'));
      else resolve();
    }, 50);
  });
};

export function useWebhookDeliveries(accountId: string) {
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [filter, setFilter] = useState<WebhookFilter>({ page: 1, status: 'all' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const requestCounter = useRef(0);

  const loadData = useCallback(async (currentAccountId: string, currentFilter: WebhookFilter) => {
    const reqId = ++requestCounter.current;
    
    setStatus(prev => {
        if (prev === 'success' || prev === 'error') {
            setIsStale(true);
            return prev;
        }
        return 'loading';
    });
    setError(null);

    const abortController = new AbortController();

    try {
      const data = await fetchDeliveries(currentAccountId, currentFilter, abortController.signal);
      
      if (reqId !== requestCounter.current) return;
      
      setDeliveries(data);
      setStatus('success');
      setIsStale(false);
    } catch (err: any) {
      if (reqId !== requestCounter.current) return;
      if (err.name === 'AbortError') return;
      
      setError(err.message || 'An error occurred');
      setStatus('error');
      setIsStale(false);
    }
  }, []);

  useEffect(() => {
    loadData(accountId, filter);
  }, [accountId, filter, loadData]);

  const retryDelivery = async (deliveryId: string) => {
    setRetryingId(deliveryId);
    try {
      await retryDeliveryApi(deliveryId);
      // Re-fetch authoritative state after mutation
      await loadData(accountId, filter);
    } catch (err) {
      // we do NOT optimistically mutate state on failure
      throw err;
    } finally {
      setRetryingId(null);
    }
  };

  return {
    deliveries,
    status,
    error,
    isStale,
    filter,
    setFilter,
    retryDelivery,
    retryingId,
    refresh: () => loadData(accountId, filter),
  };
}
