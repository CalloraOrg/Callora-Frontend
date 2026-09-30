import { useState, useEffect, useRef, useCallback } from "react";
import {
  generateIdempotencyKey,
  backoffDelayMs,
  isTimeoutError,
} from "../services/idempotency";

export interface WebhookDelivery {
  id: string;
  url: string;
  status: "delivered" | "failed" | "pending";
  attempts: number;
  lastAttemptAt: string;
}

export interface WebhookFilter {
  status?: WebhookDelivery["status"] | "all";
  page: number;
}

export type WebhookDeliveriesFetcher = (
  accountId: string,
  filter: WebhookFilter,
  signal: AbortSignal,
) => Promise<WebhookDelivery[]>;

// Mock API function
export const fetchDeliveries: WebhookDeliveriesFetcher = async (
  accountId,
  filter,
  signal,
) => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (signal.aborted) {
        return reject(new DOMException("Aborted", "AbortError"));
      }

      const data: WebhookDelivery[] = [
        {
          id: `dlv_1_${filter.page}`,
          url: "https://example.com/webhook",
          status: "delivered",
          attempts: 1,
          lastAttemptAt: new Date().toISOString(),
        },
        {
          id: `dlv_2_${filter.page}`,
          url: "https://example.com/webhook",
          status: "failed",
          attempts: 3,
          lastAttemptAt: new Date().toISOString(),
        },
      ];

      let filtered = data;
      if (filter.status && filter.status !== "all") {
        filtered = data.filter((d) => d.status === filter.status);
      }

      resolve(filtered);
    }, 50);

    signal.addEventListener("abort", () => clearTimeout(timeout));
  });
};

export const retryDeliveryApi = async (
  deliveryId: string,
  options: { idempotencyKey?: string; signal?: AbortSignal } = {},
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (deliveryId === "dlv_fail") reject(new Error("Retry failed"));
      else resolve();
    }, 50);

    options.signal?.addEventListener("abort", () => {
      clearTimeout(timeout);
      reject(new DOMException("Retry aborted", "AbortError"));
    });
  });
};

const RETRY_MAX_RETRIES = 1;
const RETRY_BASE_DELAY_MS = 250;

function isRetryableDeliveryError(error: unknown): boolean {
  if (isTimeoutError(error)) return true;
  if (error instanceof Error) {
    const message = error.message || "";
    return (
      error.name === "TypeError" || /network|fetch|timeout|abort/i.test(message)
    );
  }
  return false;
}

export function useWebhookDeliveries(
  accountId: string | null,
  fetcher: WebhookDeliveriesFetcher = fetchDeliveries,
) {
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loadedAccountId, setLoadedAccountId] = useState<string | null>(null);
  const [filter, setFilter] = useState<WebhookFilter>({
    page: 1,
    status: "all",
  });
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const requestCounter = useRef(0);
  const previousAccountId = useRef<string | null>(null);

  const loadData = useCallback(
    async (
      currentAccountId: string,
      currentFilter: WebhookFilter,
      preserveCurrentData = true,
    ) => {
      const reqId = ++requestCounter.current;

      if (preserveCurrentData) {
        setStatus((prev) => {
          if (prev === "success" || prev === "error") {
            setIsStale(true);
            return prev;
          }
          return "loading";
        });
      } else {
        setDeliveries([]);
        setLoadedAccountId(null);
        setStatus("loading");
        setIsStale(false);
      }
      setError(null);

      const abortController = new AbortController();

      try {
        const data = await fetcher(
          currentAccountId,
          currentFilter,
          abortController.signal,
        );

        if (reqId !== requestCounter.current) return;

        setDeliveries(data);
        setLoadedAccountId(currentAccountId);
        setStatus("success");
        setIsStale(false);
      } catch (err: any) {
        if (reqId !== requestCounter.current) return;
        if (err.name === "AbortError") return;

        setError(err.message || "An error occurred");
        setStatus("error");
        setIsStale(false);
      }
    },
    [fetcher],
  );

  useEffect(() => {
    if (!accountId) {
      requestCounter.current += 1;
      previousAccountId.current = null;
      setDeliveries([]);
      setLoadedAccountId(null);
      setStatus("idle");
      setError(null);
      setIsStale(false);
      return;
    }

    const accountChanged = previousAccountId.current !== accountId;
    previousAccountId.current = accountId;
    loadData(accountId, filter, !accountChanged);
  }, [accountId, filter, loadData]);

  const retryDelivery = async (deliveryId: string) => {
    if (!accountId || retryingId === deliveryId) return;

    setRetryingId(deliveryId);
    const idempotencyKey = generateIdempotencyKey("delivery-retry");

    try {
      let attempt = 0;
      for (;;) {
        try {
          await retryDeliveryApi(deliveryId, { idempotencyKey });
          break;
        } catch (retryError) {
          if (
            attempt >= RETRY_MAX_RETRIES ||
            !isRetryableDeliveryError(retryError)
          ) {
            throw retryError;
          }
          await new Promise<void>((resolve) =>
            setTimeout(resolve, backoffDelayMs(attempt, RETRY_BASE_DELAY_MS)),
          );
          attempt += 1;
        }
      }
      await loadData(accountId, filter);
    } finally {
      setRetryingId(null);
    }
  };

  return {
    deliveries: loadedAccountId === accountId ? deliveries : [],
    status,
    error,
    isStale,
    filter,
    setFilter,
    retryDelivery,
    retryingId,
    refresh: () => {
      if (!accountId) return;
      void loadData(accountId, filter);
    },
  };
}
