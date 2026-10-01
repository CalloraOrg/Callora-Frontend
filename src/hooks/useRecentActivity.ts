/**
 * useRecentActivity — fetches the most recent activity items for an account.
 *
 * Calls GET /api/activity?accountId={id}&limit=10 and maps the response
 * (BillingTransaction array) into the OverviewActivityItem shape consumed by
 * DashboardOverview. The fetch is aborted on unmount and re-issued whenever
 * `accountId` changes.
 *
 * State machine:
 *   loading  → items: [], error: null
 *   success  → items: OverviewActivityItem[], error: null
 *   error    → items: [], error: string
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BillingTransaction } from '../pages/BillingHistory';

export type ActivityStatus = 'loading' | 'success' | 'error';

/**
 * A single item in the dashboard's Recent Activity feed.
 * Mirrors the subset of BillingTransaction that DashboardOverview renders.
 */
export interface OverviewActivityItem {
  id: string;
  type: 'deposit' | 'usage';
  amount: number;
  /** ISO 8601 timestamp. */
  date: string;
  endpoint?: string;
  status?: 'operational' | 'degraded' | 'error' | 'success';
}

export interface UseRecentActivityResult {
  items: OverviewActivityItem[];
  status: ActivityStatus;
  error: string | null;
  /** Re-triggers the fetch. Useful for the error-state retry button. */
  retry: () => void;
}

/** Number of activity items requested per fetch. */
const ACTIVITY_LIMIT = 10;

/**
 * Maps a BillingTransaction status to the OverviewActivityItem status subset.
 * 'pending' and 'warning' are non-terminal — treat them as 'operational'.
 */
function mapStatus(
  txStatus: BillingTransaction['status'],
): OverviewActivityItem['status'] {
  switch (txStatus) {
    case 'success':
      return 'success';
    case 'error':
      return 'error';
    case 'pending':
    case 'warning':
    default:
      return 'operational';
  }
}

/** Convert a BillingTransaction into an OverviewActivityItem. */
function txToActivityItem(tx: BillingTransaction): OverviewActivityItem {
  return {
    id: tx.id,
    type: tx.type === 'Deposit' ? 'deposit' : 'usage',
    amount: tx.amount,
    date: tx.timestamp,
    endpoint: tx.description,
    status: mapStatus(tx.status),
  };
}

/**
 * Fetch recent activity for `accountId` from the Callora transactions API.
 *
 * @param accountId - The active account ID. The effect re-runs when this changes.
 */
export function useRecentActivity(accountId: string | null): UseRecentActivityResult {
  const [items, setItems] = useState<OverviewActivityItem[]>([]);
  const [status, setStatus] = useState<ActivityStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  // Incremented on each fetch attempt so stale responses are discarded.
  const reqCounterRef = useRef(0);

  const load = useCallback(
    async (id: string, signal: AbortSignal) => {
      const reqId = ++reqCounterRef.current;

      setStatus('loading');
      setError(null);

      try {
        const url = `/api/activity?accountId=${encodeURIComponent(id)}&limit=${ACTIVITY_LIMIT}`;
        const response = await fetch(url, { signal });

        // Guard: discard if a newer request has already superseded this one.
        if (reqId !== reqCounterRef.current) return;

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status} ${response.statusText}`);
        }

        const data: BillingTransaction[] = await response.json();

        if (reqId !== reqCounterRef.current) return;

        setItems(data.map(txToActivityItem));
        setStatus('success');
      } catch (err: unknown) {
        if (reqId !== reqCounterRef.current) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;

        const message =
          err instanceof Error ? err.message : 'Failed to load recent activity';
        setError(message);
        setStatus('error');
      }
    },
    [],
  );

  // retryRef lets the retry callback always call the latest `load` without
  // needing to be recreated on every render.
  const retryRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!accountId) {
      // No account selected — nothing to fetch.
      setItems([]);
      setStatus('success');
      setError(null);
      return;
    }

    const controller = new AbortController();

    retryRef.current = () => {
      // Re-run load with a fresh AbortController so the retry is cancellable.
      const retryController = new AbortController();
      retryRef.current = () => retryController.abort();
      load(accountId, retryController.signal);
    };

    load(accountId, controller.signal);

    return () => {
      controller.abort();
    };
  }, [accountId, load]);

  const retry = useCallback(() => {
    retryRef.current();
  }, []);

  return { items, status, error, retry };
}
