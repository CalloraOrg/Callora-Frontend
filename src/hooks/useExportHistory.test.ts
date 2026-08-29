import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useExportHistory, generateExportContent } from './useExportHistory';
import type { CallRecord } from '../pages/ApiUsage';

const MOCK_RECORDS: CallRecord[] = [
  {
    id: '1',
    timestamp: new Date('2026-08-29T10:00:00Z'),
    endpoint: '/api/v1/user/profile',
    status: 'success',
    responseTime: 120,
    cost: 0.001,
  },
  {
    id: '2',
    timestamp: new Date('2026-08-29T10:05:00Z'),
    endpoint: '/api/v1/transactions',
    status: 'error',
    responseTime: 500,
    cost: 0.002,
  },
];

describe('useExportHistory Hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('generates correct csv and json formatted content', () => {
    const jsonResult = generateExportContent(MOCK_RECORDS, 'json');
    expect(jsonResult.mimeType).toBe('application/json');
    const parsed = JSON.parse(jsonResult.content);
    expect(parsed.length).toBe(2);
    expect(parsed[0].endpoint).toBe('/api/v1/user/profile');

    const csvResult = generateExportContent(MOCK_RECORDS, 'csv');
    expect(csvResult.mimeType).toBe('text/csv');
    expect(csvResult.content).toContain('Timestamp,Endpoint,Status,Response Time,Cost');
    expect(csvResult.content).toContain('/api/v1/user/profile');
  });

  it('shows progressive export status and completes with authoritative state', async () => {
    const { result } = renderHook(() =>
      useExportHistory(MOCK_RECORDS, { chunkSize: 1, chunkDelayMs: 50 })
    );

    expect(result.current.status).toBe('idle');
    expect(result.current.progress).toBe(0);

    let exportPromise: Promise<void>;
    act(() => {
      exportPromise = result.current.startExport('csv');
    });

    expect(result.current.status).toBe('exporting');
    expect(result.current.format).toBe('csv');

    // Advance first chunk
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(result.current.progress).toBe(50);
    expect(result.current.processedRecords).toBe(1);

    // Advance second chunk to complete
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
      await exportPromise;
    });

    expect(result.current.status).toBe('completed');
    expect(result.current.progress).toBe(100);
    expect(result.current.processedRecords).toBe(2);
    expect(result.current.downloadUrl).toBe('blob:mock-url');
    expect(result.current.error).toBeNull();
  });

  it('handles export cancellation cleanly', async () => {
    const { result } = renderHook(() =>
      useExportHistory(MOCK_RECORDS, { chunkSize: 1, chunkDelayMs: 50 })
    );

    act(() => {
      result.current.startExport('json');
    });
    expect(result.current.status).toBe('exporting');

    act(() => {
      result.current.cancelExport();
    });

    expect(result.current.status).toBe('cancelled');
    expect(result.current.isCancelled).toBe(true);
    expect(result.current.error).toContain('cancelled');

    // Advancing timers should not progress or complete cancelled job
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(result.current.status).toBe('cancelled');
  });

  it('handles failure and supports retrying and recovering download', async () => {
    const { result, rerender } = renderHook(
      ({ simulateFail }) =>
        useExportHistory(MOCK_RECORDS, {
          chunkSize: 1,
          chunkDelayMs: 50,
          simulateFailureOnFormat: simulateFail ? 'csv' : null,
        }),
      { initialProps: { simulateFail: true } }
    );

    act(() => {
      result.current.startExport('csv');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(result.current.status).toBe('failed');
    expect(result.current.isFailed).toBe(true);
    expect(result.current.error).toContain('Export interrupted');
    expect(result.current.lastFailedFormat).toBe('csv');

    // Retry after fixing condition
    rerender({ simulateFail: false });

    act(() => {
      result.current.retryLastFailedExport();
    });
    expect(result.current.status).toBe('exporting');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });

    expect(result.current.status).toBe('completed');
    expect(result.current.isCompleted).toBe(true);
    expect(result.current.progress).toBe(100);
  });

  it('cancels in-flight export and resets state on account switch', async () => {
    const { result, rerender } = renderHook(
      ({ accountId }) =>
        useExportHistory(MOCK_RECORDS, {
          accountId,
          chunkSize: 1,
          chunkDelayMs: 50,
        }),
      { initialProps: { accountId: 'acc-1' } }
    );

    act(() => {
      result.current.startExport('json');
    });
    expect(result.current.status).toBe('exporting');

    // Switch account during in-flight export
    rerender({ accountId: 'acc-2' });

    expect(result.current.status).toBe('idle');
    expect(result.current.progress).toBe(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(result.current.status).toBe('idle');
  });
});
