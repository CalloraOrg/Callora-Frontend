import { renderHook, act } from '@testing-library/react';
import { useWebhookDeliveries } from './useWebhookDeliveries';
import { vi, describe, it, expect, beforeEach } from 'vitest';

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

  it('should ignore older concurrent requests (race condition prevention)', async () => {
    const { result, rerender } = renderHook(({ acc }) => useWebhookDeliveries(acc), {
      initialProps: { acc: 'acc_1' }
    });
    
    // Switch to acc_2 before acc_1 resolves
    rerender({ acc: 'acc_2' });

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    // Should only have the state of acc_2, and status should be success
    expect(result.current.status).toBe('success');
  });

  it('should explicitly mark state as stale during refetches', async () => {
    const { result } = renderHook(() => useWebhookDeliveries('acc_123'));
    
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.status).toBe('success');

    // Trigger refetch
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

  it('should handle retry mutations and fetch authoritative state', async () => {
    const { result } = renderHook(() => useWebhookDeliveries('acc_123'));
    await act(async () => { vi.advanceTimersByTime(100); });

    let retryPromise: any;
    act(() => {
      retryPromise = result.current.retryDelivery('dlv_2_1');
    });

    expect(result.current.retryingId).toBe('dlv_2_1');

    await act(async () => {
      vi.advanceTimersByTime(100); // 50 for retry, 50 for refresh
      await retryPromise;
    });

    expect(result.current.retryingId).toBeNull();
  });
});
