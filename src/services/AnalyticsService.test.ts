import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { analytics } from './AnalyticsService';
import * as userPrefs from '../utils/userPrefs';
import * as SecureErrorHandler from './SecureErrorHandler';

vi.mock('../utils/userPrefs');
// We DO NOT mock SecureErrorHandler so we can test the real recursive redaction logic.

describe('AnalyticsService', () => {
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let redactSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    redactSpy = vi.spyOn(SecureErrorHandler, 'redactDeeply');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('when analyticsConsent is false', () => {
    beforeEach(() => {
      vi.mocked(userPrefs.getPref).mockReturnValue(false);
    });

    it('should drop the event and fail closed without logging', () => {
      analytics.trackEvent({ eventName: 'test_event', payload: { a: 1 } });
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(redactSpy).not.toHaveBeenCalled();
    });
  });

  describe('when analyticsConsent is true', () => {
    beforeEach(() => {
      vi.mocked(userPrefs.getPref).mockReturnValue(true);
    });

    it('should log the event safely', () => {
      analytics.trackEvent({ eventName: 'test_event', payload: { foo: 'bar' } });
      // 'bar' contains no secrets, so it remains 'bar'
      expect(consoleInfoSpy).toHaveBeenCalledWith('[Analytics Event Tracked]', 'test_event', { foo: 'bar' });
    });

    it('should handle malformed and invalid input by dropping it safely', () => {
      analytics.trackEvent({} as any);
      expect(consoleWarnSpy).toHaveBeenCalledWith('[Analytics] Invalid or malformed input. Event dropped.');
      expect(consoleInfoSpy).not.toHaveBeenCalled();

      analytics.trackEvent({ eventName: 123 as any });
      expect(consoleWarnSpy).toHaveBeenCalledWith('[Analytics] Invalid or malformed input. Event dropped.');
      expect(consoleInfoSpy).not.toHaveBeenCalled();
    });

    it('should exclude secrets from telemetry by redacting string values', () => {
      analytics.trackEvent({
        eventName: 'login_attempt',
        payload: {
          email: 'test@example.com',
          user_id: '12345',
        },
      });

      // email matches a sensitive regex pattern, user_id does not.
      expect(consoleInfoSpy).toHaveBeenCalledWith('[Analytics Event Tracked]', 'login_attempt', {
        email: '[REDACTED_EMAIL]',
        user_id: '12345',
      });
    });
  });

  describe('AnalyticsService Redaction', () => {
    beforeEach(() => {
      vi.mocked(userPrefs.getPref).mockReturnValue(true);
    });

    it('redacts nested string values', () => {
      // 'Authorization' contains 'auth', which triggers isSensitiveValue
      const payload = { request: { headers: { Authorization: 'Bearer secret123' } } };
      analytics.trackEvent({ eventName: 'TEST_EVENT', payload });
      
      const safePayload = consoleInfoSpy.mock.calls[0][2];
      expect(safePayload.request.headers.Authorization).toBe('[REDACTED]');
    });

    it('redacts arrays of strings element-wise', () => {
      const payload = { items: ['safe-item', 'sk_test_1234567890abcdef1234567890'] };
      analytics.trackEvent({ eventName: 'TEST_EVENT', payload });
      
      const safePayload = consoleInfoSpy.mock.calls[0][2];
      expect(safePayload.items[0]).toBe('safe-item');
      // The sk_test_ token matches the SENSITIVE_PATTERNS regex
      expect(safePayload.items[1]).toBe('[REDACTED_KEY]');
    });

    it('removes values for sensitive keys like apiKey', () => {
      const payload = { config: { apiKey: '12345-abc' } };
      analytics.trackEvent({ eventName: 'TEST_EVENT', payload });
      
      const safePayload = consoleInfoSpy.mock.calls[0][2];
      expect(safePayload.config.apiKey).toBe('[REDACTED]');
    });

    it('truncates deeply nested input beyond the depth cap safely', () => {
      const deeplyNested = { l1: { l2: { l3: { l4: { l5: { l6: 'too deep' } } } } } };
      analytics.trackEvent({ eventName: 'TEST_EVENT', payload: deeplyNested });
      
      const safePayload = consoleInfoSpy.mock.calls[0][2];
      expect(safePayload.l1.l2.l3.l4.l5).toBe('[TRUNCATED]');
    });
  });
});