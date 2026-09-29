import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analytics } from './AnalyticsService';
import * as userPrefs from '../utils/userPrefs';
import * as SecureErrorHandler from './SecureErrorHandler';

vi.mock('../utils/userPrefs');
vi.mock('./SecureErrorHandler');

describe('AnalyticsService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('when analyticsConsent is false', () => {
    beforeEach(() => {
      vi.mocked(userPrefs.getPref).mockReturnValue(false);
    });

    it('should drop the event and fail closed without logging', () => {
      analytics.trackEvent({ eventName: 'test_event' });
      expect(console.info).not.toHaveBeenCalled();
      expect(SecureErrorHandler.redactSensitiveData).not.toHaveBeenCalled();
    });
  });

  describe('when analyticsConsent is true', () => {
    beforeEach(() => {
      vi.mocked(userPrefs.getPref).mockImplementation((key) => {
        if (key === 'analyticsConsent') return true;
        return undefined as any;
      });
      vi.mocked(SecureErrorHandler.redactSensitiveData).mockImplementation((text) => `REDACTED_${text}`);
    });

    it('should log the event safely', () => {
      analytics.trackEvent({ eventName: 'test_event', payload: { foo: 'bar' } });
      expect(console.info).toHaveBeenCalledWith('[Analytics Event Tracked]', 'test_event', { foo: 'REDACTED_bar' });
    });

    it('should handle malformed and invalid input by dropping it safely', () => {
      // Missing eventName
      analytics.trackEvent({} as any);
      expect(console.warn).toHaveBeenCalledWith('[Analytics] Invalid or malformed input. Event dropped.');
      expect(console.info).not.toHaveBeenCalled();

      // eventName is not a string
      analytics.trackEvent({ eventName: 123 as any });
      expect(console.warn).toHaveBeenCalledWith('[Analytics] Invalid or malformed input. Event dropped.');
      expect(console.info).not.toHaveBeenCalled();
    });

    it('should exclude secrets from telemetry by redacting string values', () => {
      analytics.trackEvent({
        eventName: 'login_attempt',
        payload: {
          email: 'test@example.com',
          token: 'sk_live_1234567890abcdef',
        },
      });

      expect(SecureErrorHandler.redactSensitiveData).toHaveBeenCalledWith('test@example.com');
      expect(SecureErrorHandler.redactSensitiveData).toHaveBeenCalledWith('sk_live_1234567890abcdef');
      
      expect(console.info).toHaveBeenCalledWith('[Analytics Event Tracked]', 'login_attempt', {
        email: 'REDACTED_test@example.com',
        token: 'REDACTED_sk_live_1234567890abcdef',
      });
    });
  });
});
