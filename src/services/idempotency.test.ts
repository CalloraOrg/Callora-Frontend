import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  RequestTimeoutError,
  generateIdempotencyKey,
  isTimeoutError,
  runWithTimeout,
} from './idempotency';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('generateIdempotencyKey', () => {
  it('produces a v4 UUID', () => {
    expect(generateIdempotencyKey()).toMatch(UUID_V4);
  });

  it('produces a different key on every call', () => {
    const keys = new Set(Array.from({ length: 500 }, () => generateIdempotencyKey()));
    expect(keys.size).toBe(500);
  });

  it('sets the version and variant bits correctly', () => {
    const key = generateIdempotencyKey();
    expect(key[14]).toBe('4');
    expect(['8', '9', 'a', 'b']).toContain(key[19].toLowerCase());
  });

  it('falls back to a manual UUID when randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', { getRandomValues: (arr: Uint8Array) => arr.fill(0xab) });
    const key = generateIdempotencyKey();
    expect(key).toMatch(UUID_V4);
  });

  it('falls back when randomUUID throws, as in a non-secure context', () => {
    vi.stubGlobal('crypto', {
      randomUUID: () => {
        throw new Error('unavailable');
      },
      getRandomValues: (arr: Uint8Array) => arr.fill(0x11),
    });
    expect(generateIdempotencyKey()).toMatch(UUID_V4);
  });

  it('still yields distinct keys when WebCrypto is entirely missing', () => {
    vi.stubGlobal('crypto', undefined);
    const keys = new Set(Array.from({ length: 200 }, () => generateIdempotencyKey()));
    expect(keys.size).toBe(200);
    for (const key of keys) expect(key).toMatch(UUID_V4);
  });
});

describe('isTimeoutError', () => {
  it('recognises its own error type', () => {
    expect(isTimeoutError(new RequestTimeoutError(5))).toBe(true);
  });

  it('recognises the type across module realms by name', () => {
    expect(isTimeoutError({ name: 'RequestTimeoutError' })).toBe(true);
  });

  it('rejects unrelated errors', () => {
    expect(isTimeoutError(new TypeError('boom'))).toBe(false);
    expect(isTimeoutError(undefined)).toBe(false);
    expect(isTimeoutError(null)).toBe(false);
  });
});

describe('runWithTimeout', () => {
  it('resolves with the task result when it finishes in time', async () => {
    await expect(runWithTimeout(async () => 'ok', 1000)).resolves.toBe('ok');
  });

  it('passes an abort signal to the task that is not yet aborted', async () => {
    let seen: AbortSignal | null = null;
    await runWithTimeout((signal) => {
      seen = signal;
      return Promise.resolve(1);
    }, 1000);
    expect(seen).toBeInstanceOf(AbortSignal);
    expect(seen!.aborted).toBe(false);
  });

  it('rejects with RequestTimeoutError once the budget elapses', async () => {
    const never = new Promise<never>(() => {});
    await expect(runWithTimeout(() => never, 10)).rejects.toBeInstanceOf(RequestTimeoutError);
  });

  it('includes the budget on the error', async () => {
    const never = new Promise<never>(() => {});
    await expect(runWithTimeout(() => never, 10)).rejects.toMatchObject({
      name: 'RequestTimeoutError',
      timeoutMs: 10,
      message: 'Request timed out after 10ms.',
    });
  });

  it('aborts the signal so the underlying request can be cancelled', async () => {
    let seen: AbortSignal | null = null;
    const never = new Promise<never>(() => {});
    await expect(
      runWithTimeout((signal) => {
        seen = signal;
        return never;
      }, 10),
    ).rejects.toBeInstanceOf(RequestTimeoutError);
    expect(seen!.aborted).toBe(true);
  });

  it('propagates a task error unchanged when it settles first', async () => {
    const boom = new Error('network down');
    await expect(runWithTimeout(() => Promise.reject(boom), 1000)).rejects.toBe(boom);
  });

  it('does not turn a task rejection into a timeout error', async () => {
    await expect(runWithTimeout(() => Promise.reject(new TypeError('bad')), 1000)).rejects.toThrow(
      TypeError,
    );
  });

  it('clears the timer when the task wins, leaving nothing pending', async () => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    await runWithTimeout(async () => 'done', 60_000);
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('suppresses a late rejection from the losing task', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);

    try {
      // Task outlives the timeout, then rejects. Without the guard inside
      // runWithTimeout this surfaces as an unhandled rejection.
      const slowRejection = new Promise<never>((_resolve, reject) => {
        setTimeout(() => reject(new Error('too late')), 40);
      });

      await expect(runWithTimeout(() => slowRejection, 5)).rejects.toBeInstanceOf(
        RequestTimeoutError,
      );

      // Give Node a macrotask turn to report anything unhandled.
      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('rejects a non-finite or non-positive budget', async () => {
    const task = async () => 'never';
    await expect(runWithTimeout(task, 0)).rejects.toBeInstanceOf(RangeError);
    await expect(runWithTimeout(task, -1)).rejects.toBeInstanceOf(RangeError);
    await expect(runWithTimeout(task, Number.NaN)).rejects.toBeInstanceOf(RangeError);
    await expect(runWithTimeout(task, Number.POSITIVE_INFINITY)).rejects.toBeInstanceOf(
      RangeError,
    );
  });

  it('rejects a missing task', async () => {
    await expect(
      runWithTimeout(undefined as unknown as () => Promise<void>, 100),
    ).rejects.toBeInstanceOf(TypeError);
  });

  it('defaults to a positive default budget', () => {
    expect(DEFAULT_REQUEST_TIMEOUT_MS).toBeGreaterThan(0);
  });
});
