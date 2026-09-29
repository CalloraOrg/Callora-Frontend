export interface TimeoutError extends Error {
  name: "TimeoutError";
  label?: string;
}

export function createTimeoutError(label?: string): TimeoutError {
  const err: TimeoutError = new Error(
    `Operation timed out${label ? `: ${label}` : ""}.`,
  ) as TimeoutError;
  err.name = "TimeoutError";
  err.label = label;
  return err;
}

export function isTimeoutError(error: unknown): error is TimeoutError {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "TimeoutError"
  );
}

let idemCounter = 0;
export function generateIdempotencyKey(prefix = "idem"): string {
  idemCounter += 1;
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${idemCounter.toString(36)}-${rand}`;
}
export class InFlightGuard<T = unknown> {
  private readonly inflight = new Map<string, { promise: Promise<T> }>();

  isRunning(key: string): boolean {
    return this.inflight.has(key);
  }

  size(): number {
    return this.inflight.size;
  }

  clear(): void {
    this.inflight.clear();
  }

  run(key: string, task: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key);
    if (existing) {
      return existing.promise;
    }

    const promise = Promise.resolve().then(() => task());
    const entry = { promise };
    this.inflight.set(key, entry);

    const release = () => {
      if (this.inflight.get(key) === entry) {
        this.inflight.delete(key);
      }
    };
    promise.then(release, release);

    return promise;
  }
}

export function createInFlightGuard<T = unknown>(): InFlightGuard<T> {
  return new InFlightGuard<T>();
}

export function runWithTimeout<T>(
  task: (signal: AbortSignal) => Promise<T>,
  ms: number,
  label?: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const controller = new AbortController();

    const finish = (settle: (v: T) => void, value: T | unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      settle(value as T);
    };

    const timer = setTimeout(() => {
      controller.abort();
      finish(reject, createTimeoutError(label));
    }, ms);

    Promise.resolve()
      .then(() => task(controller.signal))
      .then(
        (value) => finish(resolve, value),
        (error) => finish(reject, error),
      );
  });
}

export function backoffDelayMs(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs = 30_000,
): number {
  const exponent = Math.pow(2, Math.max(0, attempt));
  return Math.min(Math.max(0, baseDelayMs) * exponent, maxDelayMs);
}

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  delay?: (ms: number) => Promise<void>;
}

const defaultDelay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const {
    maxRetries,
    baseDelayMs,
    maxDelayMs,
    shouldRetry,
    delay = defaultDelay,
  } = options;

  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (error) {
      if (
        attempt >= maxRetries ||
        (shouldRetry && !shouldRetry(error, attempt))
      ) {
        throw error;
      }
      const wait = backoffDelayMs(attempt, baseDelayMs, maxDelayMs);
      await delay(wait);
      attempt += 1;
    }
  }
}
