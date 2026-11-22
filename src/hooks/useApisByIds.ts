import { useEffect, useMemo, useState } from "react";
import { isCatalogAbortError, resolveApisByIds } from "../api/catalogApi";
import type { APIItem } from "../data/mockApis";

export type ApisByIdsStatus = "loading" | "ready" | "error";

export interface UseApisByIdsResult {
  status: ApisByIdsStatus;
  apis: APIItem[];
  missing: string[];
  error: string | null;
}

const EMPTY_RESULT: UseApisByIdsResult = {
  status: "ready",
  apis: [],
  missing: [],
  error: null,
};

function deduplicateIds(ids: readonly string[] | ReadonlySet<string>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result;
}

/**
 * Resolves a list or set of API ids via {@link resolveApisByIds}, preserving
 * input order and exposing loading, ready, and error states along with any
 * missing ids.
 */
export function useApisByIds(
  ids: readonly string[] | ReadonlySet<string>,
): UseApisByIdsResult {
  const uniqueIds = useMemo(() => deduplicateIds(ids), [ids]);
  const idsKey = uniqueIds.join("\0");

  const [state, setState] = useState<UseApisByIdsResult>(() =>
    uniqueIds.length === 0
      ? EMPTY_RESULT
      : { status: "loading", apis: [], missing: [], error: null },
  );

  useEffect(() => {
    if (!idsKey) {
      setState(EMPTY_RESULT);
      return;
    }

    const targetIds = idsKey.split("\0");
    const controller = new AbortController();
    setState((prev) => ({
      status: "loading",
      apis: prev.apis,
      missing: prev.missing,
      error: null,
    }));

    resolveApisByIds(targetIds, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setState({
          status: "ready",
          apis: result.apis,
          missing: result.missing,
          error: null,
        });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || isCatalogAbortError(err)) return;
        const message =
          err instanceof Error && err.message
            ? err.message
            : "Failed to load APIs.";
        setState({
          status: "error",
          apis: [],
          missing: [],
          error: message,
        });
      });

    return () => {
      controller.abort();
    };
  }, [idsKey]);

  return state;
}
