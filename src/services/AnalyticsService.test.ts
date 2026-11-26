// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AnalyticsService,
  ANALYTICS_BATCH_SIZE,
  ANALYTICS_FLUSH_INTERVAL_MS,
  ANALYTICS_MAX_RETRIES,
} from './AnalyticsService';
import * as userPrefs from '../utils/userPrefs';
import * as SecureErrorHandler from './SecureErrorHandler';

vi.mock('../utils/userPrefs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/userPrefs')>();
  return {
    ...actual,
    getPref: vi.fn(),
  };
});
// We DO NOT mock SecureErrorHandler so we can test the real recursive redaction logic.

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let redactSpy: ReturnType<typeof vi.spyOn>;
  let sendBeaconMock: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;

  async function parseBeaconPayload(callIndex = 0) {
    const blob = sendBeaconMock.mock.calls[callIndex][1] as Blob;
    const text = await blob.text();
    return JSON.parse(text) as {
      events: Array<{
        eventName: string;
        payload: Record<string, unknown>;
        timestamp: string;
      }>;
    };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    redactSpy = vi.spyOn(SecureErrorHandler, 'redactDeeply');

    sendBeaconMock = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      writable: true,
      value: sendBeaconMock,
    });

    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    service = new AnalyticsService();
  });

  afterEach(() => {
    service.clearQueue();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('when analyticsConsent is false', () => {
    beforeEach(() => {
      vi.mocked(userPrefs.getPref).mockReturnValue(false);
    });

    it('drops the event, never enqueues, and makes no network request', async () => {
      service.trackEvent({ eventName: 'test_event', payload: { a: 1 } });
      expect(service.getQueueLength()).toBe(0);
      expect(redactSpy).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(ANALYTICS_FLUSH_INTERVAL_MS * 2);
      expect(sendBeaconMock).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('when analyticsConsent is true', () => {
    beforeEach(() => {
      vi.mocked(userPrefs.getPref).mockReturnValue(true);
    });

    it('queues and flushes events after the flush interval timer', async () => {
      service.trackEvent({ eventName: 'route_view', payload: { path: '/dashboard' } });
      expect(service.getQueueLength()).toBe(1);
      expect(sendBeaconMock).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(ANALYTICS_FLUSH_INTERVAL_MS);
      expect(sendBeaconMock).toHaveBeenCalledTimes(1);
      expect(sendBeaconMock.mock.calls[0][0]).toBe('/api/analytics/events');
      expect(service.getQueueLength()).toBe(0);

      const body = await parseBeaconPayload(0);
      expect(body.events).toHaveLength(1);
      expect(body.events[0].eventName).toBe('route_view');
      expect(body.events[0].payload).toEqual({ path: '/dashboard' });
    });

    it('flushes immediately when batch size N is reached', async () => {
      for (let i = 0; i < ANALYTICS_BATCH_SIZE - 1; i += 1) {
        service.trackEvent({ eventName: 'route_view', payload: { path: `/p/${i}` } });
      }
      expect(sendBeaconMock).not.toHaveBeenCalled();
      expect(service.getQueueLength()).toBe(ANALYTICS_BATCH_SIZE - 1);

      service.trackEvent({ eventName: 'route_view', payload: { path: '/p/last' } });
      expect(sendBeaconMock).toHaveBeenCalledTimes(1);
      expect(service.getQueueLength()).toBe(0);

      const body = await parseBeaconPayload(0);
      expect(body.events).toHaveLength(ANALYTICS_BATCH_SIZE);
    });

    it('flushes remaining events on pagehide with sendBeacon', async () => {
      service.trackEvent({ eventName: 'deposit_started', payload: { network: 'testnet' } });
      expect(sendBeaconMock).not.toHaveBeenCalled();

      window.dispatchEvent(new Event('pagehide'));
      expect(sendBeaconMock).toHaveBeenCalledTimes(1);
      expect(service.getQueueLength()).toBe(0);

      const body = await parseBeaconPayload(0);
      expect(body.events[0].eventName).toBe('deposit_started');
      expect(body.events[0].payload).toEqual({ network: 'testnet' });
    });

    it('flushes remaining events on visibilitychange to hidden', () => {
      service.trackEvent({ eventName: 'deposit_signed', payload: { network: 'testnet' } });
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(sendBeaconMock).toHaveBeenCalledTimes(1);
      expect(service.getQueueLength()).toBe(0);
    });

    it('falls back to fetch(..., { keepalive: true }) when sendBeacon is absent', async () => {
      Object.defineProperty(navigator, 'sendBeacon', {
        configurable: true,
        writable: true,
        value: undefined,
      });

      service.trackEvent({ eventName: 'deposit_confirmed', payload: { network: 'testnet' } });
      await vi.advanceTimersByTimeAsync(ANALYTICS_FLUSH_INTERVAL_MS);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/analytics/events',
        expect.objectContaining({
          method: 'POST',
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(sentBody.events[0].eventName).toBe('deposit_confirmed');
      expect(sentBody.events[0].payload).toEqual({ network: 'testnet' });
    });

    it('caps retries on repeated failure and drops the batch after maxRetries', async () => {
      Object.defineProperty(navigator, 'sendBeacon', {
        configurable: true,
        writable: true,
        value: undefined,
      });
      fetchMock.mockRejectedValue(new Error('network down'));

      service.trackEvent({ eventName: 'deposit_failed', payload: { network: 'testnet', reason: 'NETWORK_ERROR' } });

      // Initial flush + ANALYTICS_MAX_RETRIES retries
      for (let attempt = 0; attempt <= ANALYTICS_MAX_RETRIES; attempt += 1) {
        await vi.advanceTimersByTimeAsync(ANALYTICS_FLUSH_INTERVAL_MS);
      }

      expect(fetchMock).toHaveBeenCalledTimes(ANALYTICS_MAX_RETRIES + 1);
      expect(service.getQueueLength()).toBe(0);

      // No further retries scheduled
      await vi.advanceTimersByTimeAsync(ANALYTICS_FLUSH_INTERVAL_MS * 3);
      expect(fetchMock).toHaveBeenCalledTimes(ANALYTICS_MAX_RETRIES + 1);
    });

    it('clears the queue immediately when consent is revoked', async () => {
      service.trackEvent({ eventName: 'route_view', payload: { path: '/billing' } });
      expect(service.getQueueLength()).toBe(1);

      vi.mocked(userPrefs.getPref).mockReturnValue(false);
      window.dispatchEvent(
        new CustomEvent(userPrefs.PREFS_CHANGED_EVENT, {
          detail: { key: 'analyticsConsent', value: false },
        }),
      );

      expect(service.getQueueLength()).toBe(0);
      await vi.advanceTimersByTimeAsync(ANALYTICS_FLUSH_INTERVAL_MS * 2);
      expect(sendBeaconMock).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('handles malformed and invalid input by dropping it safely', () => {
      service.trackEvent({} as never);
      expect(consoleWarnSpy).toHaveBeenCalledWith('[Analytics] Invalid or malformed input. Event dropped.');
      expect(service.getQueueLength()).toBe(0);

      service.trackEvent({ eventName: 123 as never });
      expect(consoleWarnSpy).toHaveBeenCalledWith('[Analytics] Invalid or malformed input. Event dropped.');
      expect(service.getQueueLength()).toBe(0);
    });
  });

  describe('AnalyticsService Redaction', () => {
    beforeEach(() => {
      vi.mocked(userPrefs.getPref).mockReturnValue(true);
    });

    it('excludes secrets from telemetry by redacting string values', async () => {
      service.trackEvent({
        eventName: 'login_attempt',
        payload: {
          email: 'test@example.com',
          user_id: '12345',
        },
      });
      await service.flush();

      const body = await parseBeaconPayload(0);
      expect(body.events[0].payload).toEqual({
        email: '[REDACTED_EMAIL]',
        user_id: '12345',
      });
    });

    it('redacts nested string values', async () => {
      const payload = { request: { headers: { Authorization: 'Bearer secret123' } } };
      service.trackEvent({ eventName: 'TEST_EVENT', payload });
      await service.flush();

      const body = await parseBeaconPayload(0);
      const safePayload = body.events[0].payload as {
        request: { headers: { Authorization: string } };
      };
      expect(safePayload.request.headers.Authorization).toBe('[REDACTED]');
    });

    it('redacts arrays of strings element-wise', async () => {
      const payload = { items: ['safe-item', 'sk_test_1234567890abcdef1234567890'] };
      service.trackEvent({ eventName: 'TEST_EVENT', payload });
      await service.flush();

      const body = await parseBeaconPayload(0);
      const safePayload = body.events[0].payload as { items: string[] };
      expect(safePayload.items[0]).toBe('safe-item');
      expect(safePayload.items[1]).toBe('[REDACTED_KEY]');
    });

    it('removes values for sensitive keys like apiKey', async () => {
      const payload = { config: { apiKey: '12345-abc' } };
      service.trackEvent({ eventName: 'TEST_EVENT', payload });
      await service.flush();

      const body = await parseBeaconPayload(0);
      const safePayload = body.events[0].payload as { config: { apiKey: string } };
      expect(safePayload.config.apiKey).toBe('[REDACTED]');
    });

    it('truncates deeply nested input beyond the depth cap safely', async () => {
      const deeplyNested = { l1: { l2: { l3: { l4: { l5: { l6: 'too deep' } } } } } };
      service.trackEvent({ eventName: 'TEST_EVENT', payload: deeplyNested });
      await service.flush();

      const body = await parseBeaconPayload(0);
      const safePayload = body.events[0].payload as {
        l1: { l2: { l3: { l4: { l5: string } } } };
      };
      expect(safePayload.l1.l2.l3.l4.l5).toBe('[TRUNCATED]');
    });
  });
});
