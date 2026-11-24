import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  fetchNotifications,
  markAllRead as apiMarkAllRead,
  markRead as apiMarkRead,
  NotificationsApiError,
  type NotificationItem,
} from "../api/notificationsApi";
import { isSignedIn } from "../services/authService";

export const DEFAULT_POLL_INTERVAL_MS = 60_000;

export type NotificationsStatus = "idle" | "loading" | "success" | "error";

export interface UseNotificationsOptions {
  /** Whether the user is signed in. Defaults to `isSignedIn()`. */
  enabled?: boolean;
  /** Polling interval in milliseconds while the tab is visible. Defaults to 60s. */
  pollIntervalMs?: number;
  /** Optional callback invoked when an optimistic mark-read action fails. */
  onActionError?: (message: string) => void;
}

export interface UseNotificationsResult {
  items: NotificationItem[];
  status: NotificationsStatus;
  error: string | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  isEmpty: boolean;
  hasMore: boolean;
  unreadCount: number;
  isSignedIn: boolean;
  pendingIds: ReadonlySet<string>;
  isMarkingAll: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  markAsRead: (id: string) => Promise<boolean>;
  markAllAsRead: () => Promise<boolean>;
}

function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (err instanceof Error && err.name === "AbortError") return true;
  return false;
}

function mergeItems(
  existing: NotificationItem[],
  incoming: NotificationItem[],
  mode: "replace" | "append",
): NotificationItem[] {
  if (mode === "replace") {
    const seen = new Set<string>();
    const result: NotificationItem[] = [];
    for (const item of incoming) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        result.push(item);
      }
    }
    return result;
  }

  const seen = new Set(existing.map((i) => i.id));
  const merged = [...existing];
  for (const item of incoming) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      merged.push(item);
    }
  }
  return merged;
}

export function useNotifications(
  options: UseNotificationsOptions = {},
): UseNotificationsResult {
  const enabled = options.enabled ?? isSignedIn();
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const onActionErrorRef = useRef(options.onActionError);
  onActionErrorRef.current = options.onActionError;

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<NotificationsStatus>(
    enabled ? "loading" : "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [sessionRevoked, setSessionRevoked] = useState(false);

  const mountedRef = useRef(true);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const activeFetchRef = useRef<AbortController | null>(null);
  const loadMoreControllerRef = useRef<AbortController | null>(null);
  const requestCounterRef = useRef(0);

  const effectiveEnabled = enabled && !sessionRevoked;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeFetchRef.current?.abort();
      loadMoreControllerRef.current?.abort();
    };
  }, []);

  // Reset revoked flag whenever caller explicitly toggles enabled back on.
  useEffect(() => {
    if (enabled) {
      setSessionRevoked(false);
    }
  }, [enabled]);

  const loadFirstPage = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!effectiveEnabled) return;

      activeFetchRef.current?.abort();
      const controller = new AbortController();
      activeFetchRef.current = controller;
      const reqId = ++requestCounterRef.current;

      if (!opts.silent) {
        setStatus("loading");
        setError(null);
      }

      try {
        const result = await fetchNotifications({ signal: controller.signal });
        if (!mountedRef.current || reqId !== requestCounterRef.current) return;

        setItems((prev) => {
          // If this is a silent background poll and we had loaded extra pages,
          // preserve the newly fetched head while avoiding duplicates.
          if (opts.silent && prev.length > 0) {
            const incomingIds = new Set(result.items.map((i) => i.id));
            const tail = prev.filter((i) => !incomingIds.has(i.id));
            return [...result.items, ...tail];
          }
          return mergeItems([], result.items, "replace");
        });
        if (!opts.silent) {
          setNextCursor(result.nextCursor);
        }
        setStatus("success");
        setError(null);
      } catch (err: unknown) {
        if (!mountedRef.current || reqId !== requestCounterRef.current) return;
        if (isAbortError(err)) return;

        if (err instanceof NotificationsApiError && err.isUnauthorized) {
          setSessionRevoked(true);
          setItems([]);
          setNextCursor(null);
          setStatus("idle");
          setError(null);
          return;
        }

        if (!opts.silent) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load notifications.",
          );
          setStatus("error");
        }
      }
    },
    [effectiveEnabled],
  );

  // Initial load and reset on sign-out.
  useEffect(() => {
    if (!effectiveEnabled) {
      activeFetchRef.current?.abort();
      loadMoreControllerRef.current?.abort();
      requestCounterRef.current += 1;
      setItems([]);
      setNextCursor(null);
      setStatus("idle");
      setError(null);
      setIsLoadingMore(false);
      return;
    }

    void loadFirstPage();
  }, [effectiveEnabled, loadFirstPage]);

  // Visibility-aware polling.
  useEffect(() => {
    if (!effectiveEnabled || pollIntervalMs <= 0) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (timer !== null) return;
      timer = setInterval(() => {
        if (
          typeof document === "undefined" ||
          document.visibilityState === "visible"
        ) {
          void loadFirstPage({ silent: true });
        }
      }, pollIntervalMs);
    };

    const stopPolling = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        startPolling();
      } else {
        stopPolling();
      }
    };

    if (
      typeof document === "undefined" ||
      document.visibilityState === "visible"
    ) {
      startPolling();
    }

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      stopPolling();
      if (typeof document !== "undefined") {
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );
      }
    };
  }, [effectiveEnabled, pollIntervalMs, loadFirstPage]);

  const refresh = useCallback(async () => {
    await loadFirstPage({ silent: false });
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (!effectiveEnabled || !nextCursor || isLoadingMore) return;

    loadMoreControllerRef.current?.abort();
    const controller = new AbortController();
    loadMoreControllerRef.current = controller;

    setIsLoadingMore(true);
    setError(null);

    try {
      const result = await fetchNotifications({
        cursor: nextCursor,
        signal: controller.signal,
      });
      if (!mountedRef.current || controller.signal.aborted) return;

      setItems((prev) => mergeItems(prev, result.items, "append"));
      setNextCursor(result.nextCursor);
    } catch (err: unknown) {
      if (!mountedRef.current || isAbortError(err)) return;

      if (err instanceof NotificationsApiError && err.isUnauthorized) {
        setSessionRevoked(true);
        setItems([]);
        setNextCursor(null);
        setStatus("idle");
        setError(null);
        return;
      }

      const message =
        err instanceof Error
          ? err.message
          : "Could not load more notifications.";
      setError(message);
      onActionErrorRef.current?.(message);
    } finally {
      if (mountedRef.current) {
        setIsLoadingMore(false);
      }
    }
  }, [effectiveEnabled, nextCursor, isLoadingMore]);

  const markAsRead = useCallback(
    async (id: string): Promise<boolean> => {
      if (!effectiveEnabled) return false;
      const target = itemsRef.current.find((item) => item.id === id);
      if (!target || target.readAt !== null) return true;

      const previousReadAt = target.readAt;
      const optimisticReadAt = new Date().toISOString();

      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, readAt: optimisticReadAt } : item,
        ),
      );
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });

      try {
        await apiMarkRead(id);
        return true;
      } catch (err: unknown) {
        if (!mountedRef.current) return false;

        if (err instanceof NotificationsApiError && err.isUnauthorized) {
          setSessionRevoked(true);
          setItems([]);
          setNextCursor(null);
          setStatus("idle");
          setError(null);
          return false;
        }

        // Rollback optimistic update.
        setItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, readAt: previousReadAt } : item,
          ),
        );
        const message =
          err instanceof Error
            ? err.message
            : "Could not mark notification as read.";
        onActionErrorRef.current?.(message);
        return false;
      } finally {
        if (mountedRef.current) {
          setPendingIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }
      }
    },
    [effectiveEnabled],
  );

  const markAllAsRead = useCallback(async (): Promise<boolean> => {
    if (!effectiveEnabled) return false;
    const unreadIds = new Set(
      itemsRef.current
        .filter((item) => item.readAt === null)
        .map((item) => item.id),
    );
    if (unreadIds.size === 0) return true;

    const optimisticReadAt = new Date().toISOString();
    setItems((prev) =>
      prev.map((item) =>
        unreadIds.has(item.id) ? { ...item, readAt: optimisticReadAt } : item,
      ),
    );
    setIsMarkingAll(true);

    try {
      await apiMarkAllRead();
      return true;
    } catch (err: unknown) {
      if (!mountedRef.current) return false;

      if (err instanceof NotificationsApiError && err.isUnauthorized) {
        setSessionRevoked(true);
        setItems([]);
        setNextCursor(null);
        setStatus("idle");
        setError(null);
        return false;
      }

      // Rollback only the items we optimistically updated.
      setItems((prev) =>
        prev.map((item) =>
          unreadIds.has(item.id) ? { ...item, readAt: null } : item,
        ),
      );
      const message =
        err instanceof Error
          ? err.message
          : "Could not mark all notifications as read.";
      onActionErrorRef.current?.(message);
      return false;
    } finally {
      if (mountedRef.current) {
        setIsMarkingAll(false);
      }
    }
  }, [effectiveEnabled]);

  const unreadCount = useMemo(
    () => items.reduce((count, item) => (item.readAt === null ? count + 1 : count), 0),
    [items],
  );

  return {
    items,
    status,
    error,
    isLoading: status === "loading",
    isLoadingMore,
    isEmpty: status === "success" && items.length === 0,
    hasMore: nextCursor !== null,
    unreadCount,
    isSignedIn: effectiveEnabled,
    pendingIds,
    isMarkingAll,
    refresh,
    loadMore,
    markAsRead,
    markAllAsRead,
  };
}

export const NotificationsContext = createContext<UseNotificationsResult | null>(
  null,
);

export function useNotificationsContext(): UseNotificationsResult | null {
  return useContext(NotificationsContext);
}
