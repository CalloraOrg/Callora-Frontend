import { apiUrl } from '../config/constants';
import { getPref, PREFS_CHANGED_EVENT } from '../utils/userPrefs';
import { redactDeeply } from './SecureErrorHandler';

export interface AnalyticsEvent {
  eventName: string;
  payload?: Record<string, unknown>;
}

export interface QueuedAnalyticsEvent {
  eventName: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export const ANALYTICS_ENDPOINT = '/api/analytics/events';
export const ANALYTICS_BATCH_SIZE = 10;
export const ANALYTICS_FLUSH_INTERVAL_MS = 5_000;
export const ANALYTICS_MAX_RETRIES = 3;

export class AnalyticsService {
  private queue: QueuedAnalyticsEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private retryCount = 0;
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private readonly maxRetries: number;

  constructor(options?: {
    batchSize?: number;
    flushIntervalMs?: number;
    maxRetries?: number;
  }) {
    this.batchSize = options?.batchSize ?? ANALYTICS_BATCH_SIZE;
    this.flushIntervalMs = options?.flushIntervalMs ?? ANALYTICS_FLUSH_INTERVAL_MS;
    this.maxRetries = options?.maxRetries ?? ANALYTICS_MAX_RETRIES;

    this.attachLifecycleListeners();
  }

  private attachLifecycleListeners(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', this.handlePageHide);
      window.addEventListener(PREFS_CHANGED_EVENT, this.handlePrefsChanged);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  private readonly handlePageHide = (): void => {
    void this.flush();
  };

  private readonly handleVisibilityChange = (): void => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      void this.flush();
    }
  };

  private readonly handlePrefsChanged = (event: Event): void => {
    const customEvent = event as CustomEvent<{ key?: string; value?: unknown }>;
    if (
      customEvent.detail?.key === 'analyticsConsent' &&
      customEvent.detail?.value === false
    ) {
      this.clearQueue();
    }
  };

  /**
   * Tracks an analytics event.
   * Gates analytics events on explicit consent.
   * Ensures secrets are excluded from telemetry.
   */
  public trackEvent(event: AnalyticsEvent): void {
    // 1. Authorization & explicit consent check
    const hasConsent = getPref('analyticsConsent');
    if (!hasConsent) {
      // Fail closed without protected-detail leakage and ensure queue is empty
      if (this.queue.length > 0 || this.flushTimer !== null) {
        this.clearQueue();
      }
      return;
    }

    // 2. Validation
    if (!event || !event.eventName || typeof event.eventName !== 'string') {
      console.warn('[Analytics] Invalid or malformed input. Event dropped.');
      return;
    }

    // 3. Exclude secrets from telemetry and client-visible state recursively
    const safePayload = event.payload
      ? (redactDeeply(event.payload) as Record<string, unknown>)
      : {};

    this.queue.push({
      eventName: event.eventName,
      payload: safePayload,
      timestamp: new Date().toISOString(),
    });

    if (this.queue.length >= this.batchSize) {
      void this.flush();
    } else if (this.flushTimer === null) {
      this.scheduleFlush();
    }
  }

  /**
   * Immediately drops all queued events and cancels any pending flush timer.
   */
  public clearQueue(): void {
    this.queue = [];
    this.retryCount = 0;
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Returns the number of events currently waiting in the in-memory queue.
   */
  public getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Flushes all queued events to `/api/analytics/events`.
   * Uses `navigator.sendBeacon` when available, falling back to `fetch(..., { keepalive: true })`.
   */
  public async flush(): Promise<void> {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (!getPref('analyticsConsent')) {
      this.clearQueue();
      return;
    }

    if (this.queue.length === 0) {
      return;
    }

    const batch = this.queue.splice(0, this.queue.length);
    const url = apiUrl(ANALYTICS_ENDPOINT);
    const body = JSON.stringify({ events: batch });

    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      try {
        const blob = new Blob([body], { type: 'application/json' });
        const sent = navigator.sendBeacon(url, blob);
        if (sent) {
          this.retryCount = 0;
          return;
        }
      } catch {
        // Fall through to fetch fallback
      }
    }

    if (typeof fetch === 'function') {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        });
        if (response.ok) {
          this.retryCount = 0;
          return;
        }
        this.handleFlushFailure(batch);
      } catch {
        this.handleFlushFailure(batch);
      }
    } else {
      this.handleFlushFailure(batch);
    }
  }

  private handleFlushFailure(batch: QueuedAnalyticsEvent[]): void {
    if (!getPref('analyticsConsent')) {
      this.clearQueue();
      return;
    }

    if (this.retryCount < this.maxRetries) {
      this.retryCount += 1;
      this.queue.unshift(...batch);
      if (this.flushTimer === null) {
        this.scheduleFlush();
      }
    } else {
      // Retry cap reached; drop the batch to avoid unbounded memory growth
      this.retryCount = 0;
    }
  }

  private scheduleFlush(): void {
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, this.flushIntervalMs);
  }
}

export const analytics = new AnalyticsService();
