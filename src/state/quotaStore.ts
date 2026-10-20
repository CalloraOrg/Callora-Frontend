/**
 * quotaStore.ts
 *
 * Race-safe, cross-tab quota state store.
 *
 * Design goals (issue #995):
 *  1. Cross-tab synchronization — quota mutations in one tab instantly and
 *     safely update (or invalidate) state in other open tabs via a
 *     `BroadcastChannel` (with a `storage`-event fallback).
 *  2. Race-condition safety — every fetch/update is tagged with a per-account
 *     monotonic "generation" counter. Responses that arrive for a superseded
 *     generation are dropped, so stale/out-of-order responses can never
 *     overwrite a newer authoritative state. Long-running requests are also
 *     aborted via `AbortController` when superseded or when the account changes.
 *  3. Authoritative UI — the store separates the *authoritative* server value
 *     from any *unconfirmed* optimistic value. The UI never reports an
 *     unconfirmed mutation as successful: it shows "Saving…" until the server
 *     confirms, and reverts on error.
 *  4. Explicit lifecycle states — loading, stale, error, retry, and
 *     account-switch are all first-class and observable.
 *
 * The store is framework-agnostic and exposes `subscribe`/`getSnapshot` so it
 * can be consumed via React's `useSyncExternalStore`.
 */

import {
  createQuotaApi,
  QuotaApi,
  QuotaConflictError,
  QuotaRecord,
} from "../api/quotaApi";

export type LoadStatus = "loading" | "ready" | "stale" | "error";
export type PendingStatus = "idle" | "submitting" | "error";

export interface QuotaSlice {
  accountId: string;
  /** Authoritative server value (null until first successful load). */
  value: number | null;
  /** Authoritative server version (null until first successful load). */
  version: number | null;
  /** Server timestamp of the last authoritative change. */
  updatedAt: number | null;
  loadStatus: LoadStatus;
  loadError: string | null;
  /** Optimistic value being submitted but NOT yet confirmed by the server. */
  pendingValue: number | null;
  /** Last value the user attempted to submit (used by retry()). */
  lastAttemptValue: number | null;
  pendingStatus: PendingStatus;
  pendingError: string | null;
  lastSyncedAt: number | null;
  /** Number of failed submit attempts for the current pending value. */
  retryCount: number;
}

export interface QuotaState {
  currentAccountId: string;
  slices: Record<string, QuotaSlice>;
}

/** Message broadcast between tabs to keep quota state in sync. */
export interface QuotaSyncMessage {
  type: "quota:sync";
  tabId: string;
  accountId: string;
  value: number;
  version: number;
  updatedAt: number;
}

/** Minimal channel abstraction so tests can inject a deterministic bus. */
export interface QuotaChannel {
  postMessage(msg: QuotaSyncMessage): void;
  close(): void;
  /** Registers the handler invoked when a message arrives from another tab. */
  setHandler(cb: (msg: QuotaSyncMessage) => void): void;
}

export interface QuotaStoreOptions {
  api?: QuotaApi;
  channel?: QuotaChannel;
  tabId?: string;
  now?: () => number;
}

function isAbortError(err: unknown): boolean {
  return (
    !!err &&
    typeof err === "object" &&
    ((err as { name?: string }).name === "AbortError" ||
      (err as { message?: string }).message === "The operation was aborted.")
  );
}

function defaultSlice(accountId: string): QuotaSlice {
  return {
    accountId,
    value: null,
    version: null,
    updatedAt: null,
    loadStatus: "loading",
    loadError: null,
    pendingValue: null,
    lastAttemptValue: null,
    pendingStatus: "idle",
    pendingError: null,
    lastSyncedAt: null,
    retryCount: 0,
  };
}

/**
 * Wraps a real `BroadcastChannel` (or a `storage`-event fallback) as a
 * {@link QuotaChannel}. Falls back gracefully when `BroadcastChannel` is
 * unavailable (e.g. older browsers, SSR).
 */
export function createQuotaChannel(name = "callora-quota"): QuotaChannel {
  if (typeof BroadcastChannel !== "undefined") {
    const bc = new BroadcastChannel(name);
    return {
      postMessage: (msg) => bc.postMessage(msg),
      close: () => bc.close(),
      setHandler: (cb) => {
        bc.onmessage = (event: MessageEvent<QuotaSyncMessage>) =>
          cb(event.data);
      },
    };
  }

  // Best-effort fallback using the `storage` event (fires only in *other*
  // tabs, which is exactly what we need for cross-tab sync).
  const handlerRef: { cb: ((msg: QuotaSyncMessage) => void) | null } = {
    cb: null,
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
      if (event.key === name && event.newValue) {
        try {
          handlerRef.cb?.(JSON.parse(event.newValue) as QuotaSyncMessage);
        } catch {
          /* ignore malformed payloads */
        }
      }
    });
  }
  return {
    postMessage: (msg) => {
      try {
        localStorage.setItem(name, JSON.stringify(msg));
        localStorage.removeItem(name);
      } catch {
        /* storage unavailable – skip cross-tab sync */
      }
    },
    close: () => {},
    setHandler: (cb) => {
      handlerRef.cb = cb;
    },
  };
}

export class QuotaStore {
  private state: QuotaState;
  private readonly listeners = new Set<() => void>();
  private readonly api: QuotaApi;
  private readonly channel: QuotaChannel | null;
  private readonly tabId: string;
  private readonly now: () => number;

  /** Per-account monotonic generation; bumped whenever a new request starts. */
  private readonly generation: Record<string, number> = {};
  /** In-flight abort controllers keyed by `${accountId}:${kind}`. */
  private readonly inflight: Record<string, AbortController> = {};

  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => QuotaState;

  constructor(options: QuotaStoreOptions = {}) {
    this.api = options.api ?? createQuotaApi();
    this.channel = options.channel ?? null;
    this.tabId = options.tabId ?? `tab_${Math.random().toString(36).slice(2)}`;
    this.now = options.now ?? (() => Date.now());
    this.state = {
      currentAccountId: "",
      slices: {},
    };

    this.subscribe = (listener: () => void) => {
      this.listeners.add(listener);
      return () => {
        this.listeners.delete(listener);
      };
    };
    this.getSnapshot = () => this.state;

    if (this.channel) {
      this.channel.setHandler((msg) => this.handleRemoteMessage(msg));
    }
  }

  // ─── Public actions ───────────────────────────────────────────────────────

  /** Switch the active account; abandons in-flight work for the prior account. */
  selectAccount(accountId: string): Promise<void> {
    const previous = this.state.currentAccountId;
    if (previous && previous !== accountId) {
      // Abandon any in-flight request for the account we are leaving so its
      // (now-irrelevant) responses cannot mutate state later.
      this.abort(previous, "fetch");
      this.abort(previous, "update");
    }

    this.state = {
      ...this.state,
      currentAccountId: accountId,
      slices: {
        ...this.state.slices,
        [accountId]: this.state.slices[accountId] ?? defaultSlice(accountId),
      },
    };
    this.emit();

    return this.load(accountId).then(() => undefined);
  }

  /** Refetch the current account's authoritative quota. */
  refresh(): Promise<void> {
    return this.load(this.state.currentAccountId).then(() => undefined);
  }

  /**
   * Submit a quota update for the current account. Resolves (or rejects) once
   * the request settles. The optimistic value is tracked but is NEVER reported
   * as confirmed until the server responds successfully.
   */
  update(value: number): Promise<void> {
    const accountId = this.state.currentAccountId;
    const slice = this.state.slices[accountId];
    if (!slice || slice.version === null) {
      const err = new Error("Load the quota before updating it.");
      this.patch(accountId, (s) => ({
        ...s,
        pendingStatus: "error",
        pendingError: err.message,
        lastAttemptValue: value,
        pendingValue: null,
        retryCount: (s.retryCount ?? 0) + 1,
      }));
      return Promise.reject(err);
    }

    const baseVersion = slice.version;
    const gen = this.bumpGeneration(accountId);
    this.abort(accountId, "update");
    const controller = new AbortController();
    this.inflight[`update:${accountId}`] = controller;

    this.patch(accountId, (s) => ({
      ...s,
      pendingValue: value,
      lastAttemptValue: value,
      pendingStatus: "submitting",
      pendingError: null,
    }));

    return this.api
      .updateQuota(accountId, value, baseVersion, controller.signal)
      .then((record) => {
        if (gen !== this.generation[accountId]) return; // superseded
        delete this.inflight[`update:${accountId}`];
        this.applyLocalUpdate(accountId, record);
        this.broadcast(record);
      })
      .catch((err) => {
        if (gen !== this.generation[accountId]) return; // superseded/aborted
        if (isAbortError(err)) return;
        if (err instanceof QuotaConflictError) {
          this.patch(accountId, (s) => ({
            ...s,
            pendingStatus: "error",
            pendingError:
              "Conflict: a newer quota already exists. Refresh and retry.",
            pendingValue: null,
            retryCount: (s.retryCount ?? 0) + 1,
          }));
          // Fetch the latest authoritative value so the UI can reconcile.
          return this.load(accountId).then(() => undefined);
        }
        this.patch(accountId, (s) => ({
          ...s,
          pendingStatus: "error",
          pendingError: (err as Error)?.message ?? "Update failed",
          pendingValue: null,
          retryCount: (s.retryCount ?? 0) + 1,
        }));
      });
  }

  /** Retry the last failed update for the current account. */
  retry(): Promise<void> {
    const accountId = this.state.currentAccountId;
    const slice = this.state.slices[accountId];
    if (!slice || slice.lastAttemptValue === null) {
      return Promise.resolve();
    }
    const run = () => this.update(slice.lastAttemptValue as number);
    if (slice.version === null) {
      return this.load(accountId).then(run);
    }
    return run();
  }

  /** Test/utility helper: read a slice (falls back to a default). */
  getSlice(accountId: string): QuotaSlice {
    return this.state.slices[accountId] ?? defaultSlice(accountId);
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private patch(
    accountId: string,
    fn: (slice: QuotaSlice) => QuotaSlice,
  ): void {
    const prev = this.state.slices[accountId] ?? defaultSlice(accountId);
    const next = fn(prev);
    this.state = {
      ...this.state,
      slices: { ...this.state.slices, [accountId]: next },
    };
    this.emit();
  }

  private bumpGeneration(accountId: string): number {
    this.generation[accountId] = (this.generation[accountId] ?? 0) + 1;
    return this.generation[accountId];
  }

  private abort(accountId: string, kind: "fetch" | "update"): void {
    const key = `${kind}:${accountId}`;
    const controller = this.inflight[key];
    if (controller) {
      controller.abort();
      delete this.inflight[key];
    }
  }

  private async load(accountId: string): Promise<QuotaRecord | null> {
    if (!accountId) return null;
    const gen = this.bumpGeneration(accountId);
    this.abort(accountId, "fetch");
    const controller = new AbortController();
    this.inflight[`fetch:${accountId}`] = controller;

    this.patch(accountId, (s) => ({
      ...s,
      loadStatus: s.value === null ? "loading" : s.loadStatus,
      loadError: null,
    }));

    try {
      const record = await this.api.fetchQuota(accountId, controller.signal);
      if (gen !== this.generation[accountId]) return null; // superseded
      delete this.inflight[`fetch:${accountId}`];
      this.applyLocalFetch(accountId, record);
      return record;
    } catch (err) {
      if (gen !== this.generation[accountId]) return null; // superseded
      if (isAbortError(err)) return null;
      this.patch(accountId, (s) => ({
        ...s,
        loadStatus: "error",
        loadError: (err as Error)?.message ?? "Failed to load quota",
      }));
      return null;
    }
  }

  private applyLocalFetch(accountId: string, record: QuotaRecord): void {
    this.patch(accountId, (s) => ({
      ...s,
      value: record.value,
      version: record.version,
      updatedAt: record.updatedAt,
      lastSyncedAt: this.now(),
      loadError: null,
      // If a mutation is in-flight, keep its indicator; if it failed, mark the
      // freshly-fetched server state as stale so the user can reconcile.
      loadStatus:
        s.pendingStatus === "error"
          ? "stale"
          : s.pendingStatus === "submitting"
            ? s.loadStatus
            : "ready",
    }));
  }

  private applyLocalUpdate(accountId: string, record: QuotaRecord): void {
    this.patch(accountId, (s) => ({
      ...s,
      value: record.value,
      version: record.version,
      updatedAt: record.updatedAt,
      lastSyncedAt: this.now(),
      loadStatus: "ready",
      loadError: null,
      pendingStatus: "idle",
      pendingValue: null,
      pendingError: null,
    }));
  }

  private broadcast(record: QuotaRecord): void {
    this.channel?.postMessage({
      type: "quota:sync",
      tabId: this.tabId,
      accountId: record.accountId,
      value: record.value,
      version: record.version,
      updatedAt: record.updatedAt,
    });
  }

  private handleRemoteMessage(msg: QuotaSyncMessage): void {
    if (msg.tabId === this.tabId) return; // ignore our own echoes
    this.applyRemote(msg.accountId, msg);
  }

  /**
   * Apply an authoritative change that originated in another tab. We only apply
   * it when it is strictly newer than what we already know, and we never let it
   * silently discard a local pending mutation — instead we surface the conflict
   * so the user can reconcile.
   */
  private applyRemote(accountId: string, msg: QuotaSyncMessage): void {
    const slice = this.state.slices[accountId];
    if (slice && slice.version !== null && msg.version <= slice.version) {
      return; // not newer – ignore
    }

    this.patch(accountId, (s) => {
      const next: QuotaSlice = {
        ...s,
        value: msg.value,
        version: msg.version,
        updatedAt: msg.updatedAt,
        lastSyncedAt: this.now(),
      };

      if (s.pendingStatus === "submitting" || s.pendingStatus === "error") {
        // A remote change supersedes our local (unconfirmed or failed) attempt.
        next.pendingStatus = "error";
        next.pendingError =
          s.pendingStatus === "submitting"
            ? "Another tab updated this quota. Review and retry."
            : s.pendingError;
        next.pendingValue = null; // revert optimistic display
        next.loadStatus = "stale";
      } else if (s.loadStatus === "error") {
        next.loadStatus = "ready";
        next.loadError = null;
      } else {
        next.loadStatus = "ready";
      }
      return next;
    });
  }
}

/** Shared singleton used by the UI (one per app instance / tab). */
export const quotaStore = new QuotaStore({
  api: createQuotaApi(),
  channel: createQuotaChannel(),
});
