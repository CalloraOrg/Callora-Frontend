import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { catalogApi, isCatalogAbortError } from "../api/catalogApi";
import { useToast } from "../components/Toast";
import MOCK_APIS, { type APIItem } from "../data/mockApis";
import { compareStore } from "../state/compareStore";
import { parseCompareIds } from "../utils/compareUrl";

async function resolveApiById(
  id: string,
  signal: AbortSignal,
): Promise<APIItem | null> {
  try {
    const result = await catalogApi.fetchApiDetail(id, signal);
    if (result.status === "ready") {
      return result.api;
    }
  } catch (err) {
    if (isCatalogAbortError(err) || signal.aborted) {
      throw err;
    }
    // Fall through to mock catalogue lookup in demo/offline mode.
  }

  return MOCK_APIS.find((item) => item.id === id) ?? null;
}

/**
 * Hydrates `compareStore` on initial load when `?ids=` is present in the URL.
 *
 * Guard policy: URL IDs only populate the store when the current selection is
 * empty. If the user already has APIs selected in `compareStore`, the existing
 * selection is preserved, a warning toast is shown, and `?ids=` is stripped so
 * refreshing does not repeat the notice.
 */
export function useCompareUrlSync(): void {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const hasHydratedRef = useRef(false);

  const rawIdsParam = searchParams.get("ids");

  useEffect(() => {
    if (hasHydratedRef.current || rawIdsParam === null) {
      return;
    }

    const stripIdsParam = () => {
      setSearchParams(
        (prev) => {
          if (!prev.has("ids")) return prev;
          const next = new URLSearchParams(prev);
          next.delete("ids");
          return next;
        },
        { replace: true },
      );
    };

    const ids = parseCompareIds(`?ids=${encodeURIComponent(rawIdsParam)}`);
    if (ids.length === 0) {
      hasHydratedRef.current = true;
      stripIdsParam();
      return;
    }

    // Guard: do not overwrite an existing comparison selection.
    if (compareStore.getSnapshot().apis.length > 0) {
      hasHydratedRef.current = true;
      showToast(
        "Comparison already has APIs selected. Clear it first to load a shared link.",
        "warning",
      );
      stripIdsParam();
      return;
    }

    const controller = new AbortController();

    void (async () => {
      let resolved: (APIItem | null)[];
      try {
        resolved = await Promise.all(
          ids.map((id) => resolveApiById(id, controller.signal)),
        );
      } catch (err) {
        if (isCatalogAbortError(err) || controller.signal.aborted) {
          return;
        }
        return;
      }

      if (controller.signal.aborted) {
        return;
      }

      hasHydratedRef.current = true;

      // Re-check in case the user added items while hydration was in flight.
      if (compareStore.getSnapshot().apis.length > 0) {
        showToast(
          "Comparison already has APIs selected. Clear it first to load a shared link.",
          "warning",
        );
        stripIdsParam();
        return;
      }

      let addedCount = 0;
      let skippedCount = 0;

      for (const api of resolved) {
        if (!api) {
          skippedCount += 1;
          continue;
        }
        const outcome = compareStore.addApi(api);
        if (outcome === "added") {
          addedCount += 1;
        }
      }

      if (addedCount >= 2) {
        compareStore.setOpen(true);
      }

      if (skippedCount > 0) {
        showToast(
          skippedCount === 1
            ? "1 API from the shared comparison link could not be found and was skipped."
            : `${skippedCount} APIs from the shared comparison link could not be found and were skipped.`,
          "warning",
        );
      }

      stripIdsParam();
    })();

    return () => {
      controller.abort();
    };
  }, [rawIdsParam, setSearchParams, showToast]);
}
