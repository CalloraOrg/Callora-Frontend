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
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  generateIdempotencyKey,
  createInFlightGuard,
  runWithTimeout,
  isTimeoutError,
  backoffDelayMs,
  withRetry,
} from "./idempotency";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("generateIdempotencyKey", () => {
  it("prepends the provided prefix", () => {
    expect(generateIdempotencyKey("rotate")).toMatch(
      /^rotate-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+$/,
    );
  });

  it("defaults to the 'idem' prefix", () => {
    expect(generateIdempotencyKey().startsWith("idem-")).toBe(true);
  });

  it("produces 10,000 unique prefixed keys in a rapid burst", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const seen = new Set<string>();
    for (let i = 0; i < 10_000; i += 1) {
      const key = generateIdempotencyKey("rotate");
      expect(key).toMatch(/^rotate-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+$/);
      seen.add(key);
    }
    expect(seen.size).toBe(10_000);
  });
});

describe("InFlightGuard", () => {
  it("coalesces concurrent duplicate submissions into a single side effect", async () => {
    const guard = createInFlightGuard<number>();
    let calls = 0;
    const task = () => {
      calls += 1;
      return new Promise<number>((resolve) =>
        setTimeout(() => resolve(42), 20),
      );
    };

    const p1 = guard.run("rotate-key", task);
    const p2 = guard.run("rotate-key", task);
    const p3 = guard.run("rotate-key", task);

    expect(p2).toBe(p1);
    expect(p3).toBe(p1);
    expect(guard.size()).toBe(1);
    expect(guard.isRunning("rotate-key")).toBe(true);

    await Promise.resolve();
    expect(calls).toBe(1);

    await expect(Promise.all([p1, p2, p3])).resolves.toEqual([42, 42, 42]);
    expect(calls).toBe(1);
    expect(guard.size()).toBe(0);
    expect(guard.isRunning("rotate-key")).toBe(false);
  });

  it("allows a fresh attempt after the previous one resolves", async () => {
    const guard = createInFlightGuard<number>();
    let calls = 0;
    const task = () => {
      calls += 1;
      return Promise.resolve(calls);
    };

    const first = await guard.run("delivery", task);
    const second = await guard.run("delivery", task);
    expect(first).toBe(1);
    expect(second).toBe(2);
    expect(calls).toBe(2);
  });

  it("does not poison the key after a failure (recovery)", async () => {
    const guard = createInFlightGuard<number>();
    const task = vi
      .fn<() => Promise<number>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(7);

    const first = guard.run("delivery", task).catch((e: Error) => e.message);
    await expect(Promise.resolve(first)).resolves.toBe("boom");

    const second = await guard.run("delivery", task);
    expect(second).toBe(7);
    expect(task).toHaveBeenCalledTimes(2);
  });

  it("tracks distinct keys independently", async () => {
    const guard = createInFlightGuard<number>();
    const task = (value: number) => () => Promise.resolve(value);

    const a = guard.run("a", task(1));
    const b = guard.run("b", task(2));
    expect(guard.size()).toBe(2);

    const [av, bv] = await Promise.all([a, b]);
    expect(av).toBe(1);
    expect(bv).toBe(2);
  });
});

describe("runWithTimeout", () => {
  it("resolves with the task value when it finishes on time", async () => {
    await expect(
      runWithTimeout(() => Promise.resolve("ok"), 100),
    ).resolves.toBe("ok");
  });

  it("rejects with a TimeoutError and aborts the signal when the deadline passes", async () => {
    vi.useFakeTimers();
    let aborted = false;
    const pending = runWithTimeout(
      (signal) =>
        new Promise<string>((_, reject) => {
          signal.addEventListener("abort", () => {
            aborted = true;
            reject(new Error("aborted"));
          });
        }),
      100,
      "rotate",
    );

    const assertion = expect(pending).rejects.toMatchObject({
      name: "TimeoutError",
      label: "rotate",
    });
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(aborted).toBe(true);
  });

  it("marks the error as a TimeoutError for callers to distinguish", async () => {
    vi.useFakeTimers();
    const pending = runWithTimeout(
      () => new Promise<void>(() => {}),
      50,
      "fetch",
    );
    const assertion = expect(pending).rejects.toSatisfy((e: unknown) =>
      isTimeoutError(e),
    );
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
  });

  it("propagates a non-timeout rejection", async () => {
    await expect(
      runWithTimeout(() => Promise.reject(new Error("server error")), 100),
    ).rejects.toThrow("server error");
  });
});

describe("backoffDelayMs", () => {
  it("grows exponentially", () => {
    expect(backoffDelayMs(0, 1000)).toBe(1000);
    expect(backoffDelayMs(1, 1000)).toBe(2000);
    expect(backoffDelayMs(2, 1000)).toBe(4000);
    expect(backoffDelayMs(3, 1000)).toBe(8000);
  });

  it("clamps at the maximum delay", () => {
    expect(backoffDelayMs(10, 1000, 5000)).toBe(5000);
  });
});

describe("withRetry", () => {
  it("retries transient failures and eventually succeeds", async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls += 1;
        if (calls < 3) throw new Error("transient");
        return "ok";
      },
      { maxRetries: 5, baseDelayMs: 1 },
    );
    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });

  it("rethrows the final error after maxRetries (retry exhaustion)", async () => {
    const err = new Error("always fails");
    let calls = 0;
    const delay = vi.fn().mockResolvedValue(undefined);

    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw err;
        },
        { maxRetries: 2, baseDelayMs: 1, delay },
      ),
    ).rejects.toBe(err);

    expect(calls).toBe(3);
    expect(delay).toHaveBeenCalledTimes(2);
  });

  it("does not retry when maxRetries is zero", async () => {
    const err = new Error("first attempt failed");
    const task = vi.fn().mockRejectedValue(err);
    const delay = vi.fn().mockResolvedValue(undefined);

    await expect(
      withRetry(task, { maxRetries: 0, baseDelayMs: 1, delay }),
    ).rejects.toBe(err);

    expect(task).toHaveBeenCalledTimes(1);
    expect(delay).not.toHaveBeenCalled();
  });

  it("honors the shouldRetry predicate to stop immediately", async () => {
    const err = new Error("non-retryable");
    let calls = 0;
    const delay = vi.fn().mockResolvedValue(undefined);

    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw err;
        },
        {
          maxRetries: 5,
          baseDelayMs: 0,
          shouldRetry: (e) => e !== err,
          delay,
        },
      ),
    ).rejects.toThrow("non-retryable");

    expect(calls).toBe(1);
    expect(delay).not.toHaveBeenCalled();
  });
});
