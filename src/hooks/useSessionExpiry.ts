import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useSessionExpiry — Detects session expiry and preserves form data.
 *
 * Monitors for session expiry via multiple signals:
 * - Inactivity timeout (user idle for a configurable period)
 * - visibilitychange event (user switches tabs, returns after long absence)
 * - Cross-tab logout detection via localStorage storage events
 * - Manual signal via `signalExpiry()` for API 401 responses
 *
 * When expiry is detected, the hook:
 * 1. Persists the current form data (passed via localStorage key)
 * 2. Sets `isExpired` to true so the UI can show a banner
 * 3. Optionally redirects after a delay
 */
const ACTIVITY_STORAGE_KEY = 'callora:session:lastActivity';
const SESSION_EXPIRY_EVENT_KEY = 'callora:session:expired';
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;
const ACTIVITY_THROTTLE_MS = 30_000;

export interface UseSessionExpiryOptions {
  /** Inactivity timeout in ms. Default: 30 minutes (1800000) */
  timeoutMs?: number;
  /** Whether to redirect to login on expiry. Default: false */
  redirectOnExpiry?: boolean;
  /** Redirect URL. Default: "/" */
  redirectUrl?: string;
  /** Delay before redirect in ms. Default: 3000 */
  redirectDelayMs?: number;
  /** Whether to listen for cross-tab logout events. Default: true */
  crossTabSync?: boolean;
}

export interface UseSessionExpiryReturn {
  /** Whether session has been detected as expired */
  isExpired: boolean;
  /** Manually signal session expiry (e.g. on 401 API response) */
  signalExpiry: () => void;
  /** Dismiss the expiry notification */
  dismiss: () => void;
  /** Seconds remaining before auto-redirect (null if no redirect pending) */
  countdown: number | null;
}

function getLastActivity(): number {
  if (typeof window === 'undefined') return Date.now();
  try {
    const stored = localStorage.getItem(ACTIVITY_STORAGE_KEY);
    return stored ? Number(stored) : Date.now();
  } catch {
    return Date.now();
  }
}

function setLastActivity(time: number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTIVITY_STORAGE_KEY, String(time));
  } catch {
    // Silently fail
  }
}

export function useSessionExpiry(
  options: UseSessionExpiryOptions = {},
): UseSessionExpiryReturn {
  const {
    timeoutMs = 30 * 60 * 1000,
    redirectOnExpiry = false,
    redirectUrl = '/',
    redirectDelayMs = 3000,
    crossTabSync = true,
  } = options;

  const [isExpired, setIsExpired] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef(getLastActivity());
  const mountedRef = useRef(true);

  // ── Track user activity ──────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    const throttledUpdate = (() => {
      let lastUpdate = 0;
      return () => {
        const now = Date.now();
        if (now - lastUpdate < ACTIVITY_THROTTLE_MS) return;
        lastUpdate = now;
        lastActivityRef.current = now;
        setLastActivity(now);
      };
    })();

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, throttledUpdate, { passive: true });
    }

    // Set initial activity timestamp
    setLastActivity(Date.now());

    return () => {
      mountedRef.current = false;
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, throttledUpdate);
      }
    };
  }, []);

  // ── Check for inactivity timeout ────────────────────────────────────
  useEffect(() => {
    const checkInterval = 10_000; // Check every 10 seconds

    timerRef.current = setInterval(() => {
      if (!mountedRef.current || isExpired) return;

      const now = Date.now();
      const elapsed = now - lastActivityRef.current;

      if (elapsed >= timeoutMs) {
        setIsExpired(true);
      }
    }, checkInterval);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [timeoutMs, isExpired]);

  // ── Listen for visibility change (tab switch) ────────────────────────
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isExpired) {
        const now = Date.now();
        const elapsed = now - lastActivityRef.current;

        if (elapsed >= timeoutMs) {
          setIsExpired(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [timeoutMs, isExpired]);

  // ── Cross-tab sync via storage events ────────────────────────────────
  useEffect(() => {
    if (!crossTabSync) return;

    const handleStorage = (event: StorageEvent) => {
      if (event.key === SESSION_EXPIRY_EVENT_KEY && !isExpired) {
        setIsExpired(true);
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, [crossTabSync, isExpired]);

  // ── Redirect countdown ───────────────────────────────────────────────
  useEffect(() => {
    if (!isExpired || !redirectOnExpiry) {
      setCountdown(null);
      return;
    }

    const secondsTotal = Math.ceil(redirectDelayMs / 1000);
    setCountdown(secondsTotal);

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    redirectTimerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        window.location.href = redirectUrl;
      }
    }, redirectDelayMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, [isExpired, redirectOnExpiry, redirectUrl, redirectDelayMs]);

  // ── Manual expiry signal ─────────────────────────────────────────────
  const signalExpiry = useCallback(() => {
    setIsExpired(true);
    // Broadcast to other tabs
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(SESSION_EXPIRY_EVENT_KEY, String(Date.now()));
      } catch {
        // Silently fail
      }
    }
  }, []);

  // ── Dismiss ──────────────────────────────────────────────────────────
  const dismiss = useCallback(() => {
    setIsExpired(false);
    setCountdown(null);
    if (timerRef.current) clearInterval(timerRef.current);
    if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    // Reset activity so user has more time
    const now = Date.now();
    lastActivityRef.current = now;
    setLastActivity(now);
  }, []);

  return {
    isExpired,
    signalExpiry,
    dismiss,
    countdown,
  };
}
