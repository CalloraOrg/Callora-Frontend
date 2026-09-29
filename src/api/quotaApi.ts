/**
 * quotaApi.ts
 *
 * Simulated, backend-shaped quota API used by the race-safe quota store.
 *
 * The API models a real server with a per-account authoritative record that
 * carries a monotonically increasing `version`. Optimistic clients must submit
 * their update together with the `version` they based it on (the
 * "base version"); if that base is stale (another update already landed), the
 * server rejects with {@link QuotaConflictError}. This is exactly the failure
 * mode the store must handle across concurrent requests and tabs.
 *
 * Every call accepts an optional `AbortSignal` so in-flight requests can be
 * cancelled when a newer request supersedes them or the user switches account.
 */

export interface QuotaRecord {
  accountId: string;
  /** Authoritative quota value (e.g. requests-per-window). */
  value: number;
  /** Server version; bumped on every successful mutation. */
  version: number;
  /** Server timestamp of the last authoritative change. */
  updatedAt: number;
}

/** Raised when an update is based on a stale server version. */
export class QuotaConflictError extends Error {
  public readonly serverVersion: number;

  constructor(serverVersion: number, accountId: string) {
    super(
      `Quota update rejected: a newer version (v${serverVersion}) already exists for "${accountId}".`,
    );
    this.name = "QuotaConflictError";
    this.serverVersion = serverVersion;
  }
}

export interface QuotaApi {
  fetchQuota(accountId: string, signal?: AbortSignal): Promise<QuotaRecord>;
  updateQuota(
    accountId: string,
    value: number,
    baseVersion: number,
    signal?: AbortSignal,
  ): Promise<QuotaRecord>;
}

export interface CreateQuotaApiOptions {
  /** Base artificial latency (ms) applied to every request. */
  latencyMs?: number;
  /** Seed values keyed by accountId. Missing accounts default to value 0. */
  initial?: Record<string, number>;
}

function abortError(): Error {
  const err = new Error("The operation was aborted.");
  err.name = "AbortError";
  return err;
}

function delay(latencyMs: number, signal?: AbortSignal): Promise<void> {
  if (latencyMs <= 0) {
    return signal?.aborted ? Promise.reject(abortError()) : Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(resolve, latencyMs);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(abortError());
      },
      { once: true },
    );
  });
}

/**
 * Creates an in-memory quota API. Two store instances that share the same
 * `QuotaApi` therefore share the same "server", which is how cross-tab
 * consistency is exercised in tests.
 */
export function createQuotaApi(
  options: CreateQuotaApiOptions = {},
): QuotaApi {
  const latency = options.latencyMs ?? 0;
  const server = new Map<string, QuotaRecord>();

  for (const [accountId, value] of Object.entries(options.initial ?? {})) {
    server.set(accountId, {
      accountId,
      value,
      version: 1,
      updatedAt: Date.now(),
    });
  }

  function readOrInit(accountId: string): QuotaRecord {
    let rec = server.get(accountId);
    if (!rec) {
      rec = { accountId, value: 0, version: 1, updatedAt: Date.now() };
      server.set(accountId, rec);
    }
    return rec;
  }

  return {
    async fetchQuota(accountId, signal) {
      await delay(latency, signal);
      const rec = readOrInit(accountId);
      return { ...rec };
    },

    async updateQuota(accountId, value, baseVersion, signal) {
      await delay(latency, signal);
      const current = readOrInit(accountId);
      if (baseVersion !== current.version) {
        throw new QuotaConflictError(current.version, accountId);
      }
      const next: QuotaRecord = {
        accountId,
        value,
        version: current.version + 1,
        updatedAt: Date.now(),
      };
      server.set(accountId, next);
      return { ...next };
    },
  };
}
