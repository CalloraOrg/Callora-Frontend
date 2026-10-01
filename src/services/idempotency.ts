/**
 * Idempotency helpers for write requests.
 *
 * Every mutating call the browser makes on the provider's behalf carries an
 * `Idempotency-Key` header. If the client retries — because the user double
 * clicked, because a response was lost in flight, or because a timeout fired
 * while the server was still processing — the server can recognise the replay
 * and return the original result instead of creating a second resource.
 *
 * `runWithTimeout` is the companion guard: it bounds how long a single
 * request attempt may occupy the UI, and aborts the underlying request so a
 * hung connection cannot leave the submit button stuck in its loading state
 * forever.
 */

/** Default ceiling for a single write attempt, in milliseconds. */
export const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;

/**
 * Error thrown when a request exceeds its timeout budget.
 *
 * Callers distinguish this from a genuine network failure so they can show a
 * retry-flavoured message rather than an offline one.
 */
export class RequestTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms.`);
    this.name = 'RequestTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/** True when `error` is a {@link RequestTimeoutError}, across realms. */
export function isTimeoutError(error: unknown): boolean {
  return error instanceof RequestTimeoutError || (error as { name?: string })?.name === 'RequestTimeoutError';
}

const HEX_DIGITS = '0123456789abcdef';

/** Fill `target` with random bytes, preferring the platform CSPRNG. */
function fillRandomBytes(target: Uint8Array): Uint8Array {
  const cryptoObj: Crypto | undefined = globalThis.crypto;

  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    cryptoObj.getRandomValues(target);
    return target;
  }

  // Last-resort fallback for environments without WebCrypto (very old
  // browsers, or an insecure-context stub). The key is a de-duplication hint
  // rather than a secret, so entropy quality is not security-critical here.
  for (let i = 0; i < target.length; i += 1) {
    target[i] = Math.floor(Math.random() * 256);
  }
  return target;
}

/** Format bytes as a lowercase hex string. */
function toHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += HEX_DIGITS[bytes[i] >> 4] + HEX_DIGITS[bytes[i] & 0x0f];
  }
  return out;
}

/**
 * Generate an RFC 4122 version 4 UUID suitable for use as an
 * `Idempotency-Key`.
 *
 * A fresh key is produced on every call. Callers that need the *same* key
 * across retries must store the first value and reuse it — that is the entire
 * point of the header.
 */
export function generateIdempotencyKey(): string {
  const cryptoObj: Crypto | undefined = globalThis.crypto;

  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    try {
      return cryptoObj.randomUUID();
    } catch {
      // Some environments expose randomUUID but throw on it (for example a
      // non-secure context). Fall through to the manual builder.
    }
  }

  const bytes = fillRandomBytes(new Uint8Array(16));
  // Version 4 (random) and RFC 4122 variant bits.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = toHex(bytes);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

/**
 * Run `task` with a hard time budget.
 *
 * `task` receives an `AbortSignal` that fires when the budget elapses, so it
 * can cancel the underlying network activity instead of leaving it running in
 * the background. Whichever settles first wins; the timer is always cleared
 * so a resolved request never keeps the event loop alive.
 *
 * @param task - receives the abort signal and performs the request
 * @param timeoutMs - positive budget in milliseconds
 * @throws {RequestTimeoutError} when the budget elapses first
 * @throws {RangeError} when `timeoutMs` is not a positive finite number
 */
export async function runWithTimeout<T>(
  task: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<T> {
  if (typeof task !== 'function') {
    throw new TypeError('runWithTimeout requires a task function.');
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError('runWithTimeout requires a positive finite timeoutMs.');
  }

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new RequestTimeoutError(timeoutMs));
    }, timeoutMs);
  });

  const taskPromise = task(controller.signal);
  // If the timeout wins the race the task keeps running; swallow its eventual
  // rejection so it does not surface as an unhandled promise rejection.
  taskPromise.catch(() => undefined);

  try {
    return await Promise.race([taskPromise, timeout]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
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

function generateSecureRandomSuffix(): string {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error("Web Crypto is required to generate an idempotency key.");
  }

  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function generateIdempotencyKey(prefix = "idem"): string {
  idemCounter += 1;
  const rand = generateSecureRandomSuffix();
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
