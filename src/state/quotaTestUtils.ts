/**
 * Test helpers for quota store / component tests.
 *
 * `makeFakeApi` returns a fully controllable {@link QuotaApi}: every request is
 * recorded and can be resolved/rejected manually, which lets tests exercise
 * out-of-order, stale, conflicting, and cross-tab scenarios deterministically.
 *
 * `linkedChannels` creates two {@link QuotaChannel}s that deliver messages to
 * each other, simulating two browser tabs sharing a `BroadcastChannel`.
 */

import {
  QuotaApi,
  QuotaRecord,
  QuotaConflictError,
} from "../api/quotaApi";
import { QuotaChannel, QuotaSyncMessage } from "./quotaStore";

export class Deferred<T> {
  promise: Promise<T>;
  resolve!: (value: T) => void;
  reject!: (reason?: unknown) => void;

  constructor() {
    this.promise = new Promise<T>((res, rej) => {
      this.resolve = res;
      this.reject = rej;
    });
  }
}

function abortError(): Error {
  const err = new Error("The operation was aborted.");
  err.name = "AbortError";
  return err;
}

export interface FakeApiHandle {
  api: QuotaApi;
  fetchCalls: { accountId: string; deferred: Deferred<QuotaRecord>; signal?: AbortSignal }[];
  updateCalls: {
    accountId: string;
    value: number;
    baseVersion: number;
    deferred: Deferred<QuotaRecord>;
    signal?: AbortSignal;
  }[];
  seed: (accountId: string, value: number, version?: number) => void;
  resolveFetch: (index: number, record: QuotaRecord) => void;
  resolveLastFetch: (record: QuotaRecord) => void;
  rejectFetch: (index: number, err: unknown) => void;
  resolveUpdate: (index: number, record: QuotaRecord) => void;
  resolveLastUpdate: (record: QuotaRecord) => void;
  rejectUpdate: (index: number, err: unknown) => void;
  rejectLastUpdateConflict: (serverVersion: number, accountId: string) => void;
}

export function makeFakeApi(initial: Record<string, number> = {}): FakeApiHandle {
  const server = new Map<string, QuotaRecord>();
  for (const [accountId, value] of Object.entries(initial)) {
    server.set(accountId, { accountId, value, version: 1, updatedAt: 1 });
  }

  const fetchCalls: FakeApiHandle["fetchCalls"] = [];
  const updateCalls: FakeApiHandle["updateCalls"] = [];

  const api: QuotaApi = {
    fetchQuota(accountId, signal) {
      const d = new Deferred<QuotaRecord>();
      signal?.addEventListener("abort", () => d.reject(abortError()), {
        once: true,
      });
      fetchCalls.push({ accountId, deferred: d, signal });
      return d.promise;
    },
    updateQuota(accountId, value, baseVersion, signal) {
      const d = new Deferred<QuotaRecord>();
      signal?.addEventListener("abort", () => d.reject(abortError()), {
        once: true,
      });
      updateCalls.push({ accountId, value, baseVersion, deferred: d, signal });
      return d.promise;
    },
  };

  return {
    api,
    fetchCalls,
    updateCalls,
    seed(accountId, value, version = 1) {
      server.set(accountId, { accountId, value, version, updatedAt: 1 });
    },
    resolveFetch(index, record) {
      fetchCalls[index].deferred.resolve(record);
    },
    resolveLastFetch(record) {
      this.resolveFetch(fetchCalls.length - 1, record);
    },
    rejectFetch(index, err) {
      fetchCalls[index].deferred.reject(err);
    },
    resolveUpdate(index, record) {
      updateCalls[index].deferred.resolve(record);
    },
    resolveLastUpdate(record) {
      this.resolveUpdate(updateCalls.length - 1, record);
    },
    rejectUpdate(index, err) {
      updateCalls[index].deferred.reject(err);
    },
    rejectLastUpdateConflict(serverVersion, accountId) {
      this.rejectUpdate(
        updateCalls.length - 1,
        new QuotaConflictError(serverVersion, accountId),
      );
    },
  };
}

/** Two channels that forward messages to each other (simulated tabs). */
export function linkedChannels(): [QuotaChannel, QuotaChannel] {
  let handlerA: ((msg: QuotaSyncMessage) => void) | null = null;
  let handlerB: ((msg: QuotaSyncMessage) => void) | null = null;

  const channelA: QuotaChannel = {
    postMessage: (msg) => {
      try {
        handlerB?.(msg);
      } catch {
        /* a receiver error must not break the sender */
      }
    },
    close: () => {},
    setHandler: (cb) => {
      handlerA = cb;
    },
  };
  const channelB: QuotaChannel = {
    postMessage: (msg) => {
      try {
        handlerA?.(msg);
      } catch {
        /* a receiver error must not break the sender */
      }
    },
    close: () => {},
    setHandler: (cb) => {
      handlerB = cb;
    },
  };

  return [channelA, channelB];
}

/** Flush pending microtasks/macrotasks in tests. */
export function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
