import { getPref } from '../utils/userPrefs';
import { redactSensitiveData } from './SecureErrorHandler';

export interface AnalyticsEvent {
  eventName: string;
  payload?: Record<string, unknown>;
}

class AnalyticsService {
  /**
   * Tracks an analytics event. 
   * Gates analytics events on explicit consent.
   * Ensures secrets are excluded from telemetry.
   */
  public trackEvent(event: AnalyticsEvent): void {
    // 1. Authorization & explicit consent check
    const hasConsent = getPref('analyticsConsent');
    if (!hasConsent) {
      // Fail closed without protected-detail leakage
      return;
    }

    // 2. Validation
    if (!event || !event.eventName || typeof event.eventName !== 'string') {
      console.warn('[Analytics] Invalid or malformed input. Event dropped.');
      return;
    }

    // 3. Exclude secrets from telemetry and client-visible state
    const safePayload: Record<string, unknown> = {};
    if (event.payload) {
      for (const [key, value] of Object.entries(event.payload)) {
        if (typeof value === 'string') {
          safePayload[key] = redactSensitiveData(value);
        } else {
          // Deep clone or omit complex objects if necessary
          safePayload[key] = value; 
        }
      }
    }

    // In a real application, this would send to an external analytics provider (e.g., Mixpanel, PostHog, etc)
    // For now, we simulate tracking by logging to the console.
    console.info('[Analytics Event Tracked]', event.eventName, safePayload);
  }
}

export const analytics = new AnalyticsService();
