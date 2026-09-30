import { renderHook, act } from '@testing-library/react';
import { useWebhookDeliveries, type WebhookDeliveriesFetcher } from './useWebhookDeliveries';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('useWebhookDeliveries', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should explicitly transition through loading to success state', async () => {
    const { result } = renderHook(() => useWebhookDeliveries('acc_123'));
    
    expect(result.current.status).toBe('loading');
    expect(result.current.deliveries).toEqual([]);

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.status).toBe('success');
    expect(result.current.deliveries.length).toBeGreaterThan(0);
    expect(result.current.isStale).toBe(false);
  });

  it('should ignore older concurrent requests and clear rows when the account changes', async () => {
    const fetcher: WebhookDeliveriesFetcher = vi.fn(
      (accountId, _filter, signal) => new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          resolve([{
            id: `${accountId}-delivery`,
            url: 'https://example.com/webhook',
            status: 'delivered',
            attempts: 1,
            lastAttemptAt: new Date().toISOString(),
          }]);
        }, 50);

        signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          reject(new DOMException('Aborted', 'AbortError'));
        });
      }),
    );

    const { result, rerender } = renderHook(
      ({ acc }) => useWebhookDeliveries(acc, fetcher),
      { initialProps: { acc: 'acc_1' as string | null } },
    );

    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.deliveries[0]?.id).toBe('acc_1-delivery');

    rerender({ acc: 'acc_2' });

    expect(result.current.deliveries).toEqual([]);
    expect(result.current.status).toBe('loading');

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.status).toBe('success');
    expect(result.current.deliveries[0]?.id).toBe('acc_2-delivery');
  });

  it('should explicitly mark state as stale during same-account refetches', async () => {
    const { result } = renderHook(() => useWebhookDeliveries('acc_123'));
    
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.status).toBe('success');

    act(() => {
      result.current.refresh();
    });

    expect(result.current.status).toBe('success');
    expect(result.current.isStale).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.isStale).toBe(false);
  });

  it('should surface errors from an injected fetcher', async () => {
    const failingFetcher: WebhookDeliveriesFetcher = vi.fn(async () => {
      throw new Error('Failed to fetch from authoritative source');
    });

    const { result } = renderHook(() => useWebhookDeliveries('acc_123', failingFetcher));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Failed to fetch from authoritative source');
  });

  it('should handle retry mutations and fetch authoritative state', async () => {
    const { result } = renderHook(() => useWebhookDeliveries('acc_123'));
    await act(async () => { vi.advanceTimersByTime(100); });

    let retryPromise: Promise<void> | undefined;
    act(() => {
      retryPromise = result.current.retryDelivery('dlv_2_1');
    });

    expect(result.current.retryingId).toBe('dlv_2_1');

    await act(async () => {
      vi.advanceTimersByTime(100);
      await retryPromise;
    });

    expect(result.current.retryingId).toBeNull();
  });
});
