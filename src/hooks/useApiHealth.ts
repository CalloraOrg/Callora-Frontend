import { useCallback, useEffect, useState } from "react";
import { fetchApiHealth, isCatalogAbortError } from "../api/catalogApi";
import type { HealthStatus } from "../components/HealthTimeline";

export type ApiHealthState = "idle" | "loading" | "ready" | "error";

export interface UseApiHealthResult {
  data: HealthStatus[];
  status: ApiHealthState;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

/**
 * Fetches health timeline buckets for an API via `GET /api/apis/:id/health`.
 * Automatically aborts in-flight requests when `id` changes or the caller unmounts.
 */
export function useApiHealth(
  id: string | null | undefined,
  enabled = true,
): UseApiHealthResult {
  const [data, setData] = useState<HealthStatus[]>([]);
  const [status, setStatus] = useState<ApiHealthState>(
    id && enabled ? "loading" : "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!id || !enabled) {
      setData([]);
      setStatus("idle");
      setError(null);
      return;
    }

    const controller = new AbortController();
    setStatus("loading");
    setError(null);

    fetchApiHealth(id, controller.signal)
      .then((points) => {
        if (controller.signal.aborted) return;
        setData(points);
        setStatus("ready");
      })
      .catch((err) => {
        if (controller.signal.aborted || isCatalogAbortError(err)) return;
        setData([]);
        setError(
          err instanceof Error && err.message
            ? err.message
            : "Unable to load service health.",
        );
        setStatus("error");
      });

    return () => {
      controller.abort();
    };
  }, [id, enabled, attempt]);

  return {
    data,
    status,
    loading: status === "loading",
    error,
    retry,
  };
}
