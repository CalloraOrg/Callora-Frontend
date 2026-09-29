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
});

describe("generateIdempotencyKey", () => {
  it("prepends the provided prefix", () => {
    expect(generateIdempotencyKey("rotate").startsWith("rotate-")).toBe(true);
  });

  it("defaults to the 'idem' prefix", () => {
    expect(generateIdempotencyKey().startsWith("idem-")).toBe(true);
  });

  it("produces unique keys across calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i += 1) {
      seen.add(generateIdempotencyKey("rotate"));
    }
    expect(seen.size).toBe(1000);
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
    ).rejects.toThrow("always fails");

    expect(calls).toBe(3);
    expect(delay).toHaveBeenCalledTimes(2);
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
