// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import {
  BalancesRequestError,
  balancesPath,
  fetchAccountBalances,
  parseAmount,
  parseBalancesPayload,
} from "./balances";

function jsonResponse(body: unknown, init: { status?: number; ok?: boolean } = {}) {
  return {
    ok: init.ok ?? (init.status ?? 200) < 400,
    status: init.status ?? 200,
    json: async () => body,
  } as unknown as Response;
}

describe("balancesPath", () => {
  it("targets the account balances endpoint", () => {
    expect(balancesPath("acct_1")).toBe("/api/accounts/acct_1/balances");
  });

  it("url-encodes the account id so it cannot break out of the path segment", () => {
    expect(balancesPath("../../admin")).toBe("/api/accounts/..%2F..%2Fadmin/balances");
  });
});

describe("parseAmount", () => {
  it("accepts non-negative numbers and numeric strings", () => {
    expect(parseAmount(12.5)).toBe(12.5);
    expect(parseAmount("1260.5")).toBe(1260.5);
    expect(parseAmount(" 42 ")).toBe(42);
    expect(parseAmount(0)).toBe(0);
    expect(parseAmount("1e3")).toBe(1000);
  });

  it("rejects values that would silently read as zero", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("   ")).toBeNull();
    expect(parseAmount(null)).toBeNull();
    expect(parseAmount(undefined)).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("12abc")).toBeNull();
  });

  it("rejects booleans, objects, and arrays", () => {
    expect(parseAmount(true)).toBeNull();
    expect(parseAmount({})).toBeNull();
    expect(parseAmount([10])).toBeNull();
  });

  it("rejects non-finite and negative amounts", () => {
    expect(parseAmount(Number.NaN)).toBeNull();
    expect(parseAmount(Number.POSITIVE_INFINITY)).toBeNull();
    expect(parseAmount(-1)).toBeNull();
    expect(parseAmount("-0.01")).toBeNull();
  });
});

describe("parseBalancesPayload", () => {
  it("reads a bare vault/wallet pair", () => {
    expect(parseBalancesPayload({ vault: 284.62, wallet: 1260.5 })).toEqual({
      vault: 284.62,
      wallet: 1260.5,
    });
  });

  it("reads vaultBalance/walletBalance aliases", () => {
    expect(parseBalancesPayload({ vaultBalance: "10", walletBalance: "20.5" })).toEqual({
      vault: 10,
      wallet: 20.5,
    });
  });

  it("unwraps balances and data envelopes", () => {
    expect(parseBalancesPayload({ balances: { vault: 1, wallet: 2 } })).toEqual({ vault: 1, wallet: 2 });
    expect(parseBalancesPayload({ data: { vault: 3, wallet: 4 } })).toEqual({ vault: 3, wallet: 4 });
  });

  it("keeps a genuine zero balance instead of treating it as missing", () => {
    expect(parseBalancesPayload({ vault: 0, wallet: 0 })).toEqual({ vault: 0, wallet: 0 });
  });

  it("rejects payloads missing an amount instead of defaulting to zero", () => {
    expect(() => parseBalancesPayload({ vault: 10 })).toThrow(BalancesRequestError);
    expect(() => parseBalancesPayload({})).toThrow(BalancesRequestError);
    expect(() => parseBalancesPayload(null)).toThrow(BalancesRequestError);
    expect(() => parseBalancesPayload("nope")).toThrow(BalancesRequestError);
  });

  it("rejects a payload whose amount is unusable", () => {
    expect(() => parseBalancesPayload({ vault: "", wallet: 5 })).toThrow(BalancesRequestError);
    expect(() => parseBalancesPayload({ vault: -5, wallet: 5 })).toThrow(BalancesRequestError);
  });
});

describe("fetchAccountBalances", () => {
  it("requests the account endpoint and returns numeric balances", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ vault: "284.62", wallet: 1260.5 }));

    await expect(fetchAccountBalances("acct_1", { fetchImpl })).resolves.toEqual({
      vault: 284.62,
      wallet: 1260.5,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("/api/accounts/acct_1/balances");
    expect(init.method).toBe("GET");
    expect(init.headers).toEqual({ Accept: "application/json" });
  });

  it("forwards the abort signal", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ vault: 1, wallet: 2 }));

    await fetchAccountBalances("acct_1", { fetchImpl, signal: controller.signal });

    expect(fetchImpl.mock.calls[0][1].signal).toBe(controller.signal);
  });

  it("refuses to build a request for a blank account id", async () => {
    const fetchImpl = vi.fn();

    await expect(fetchAccountBalances("   ", { fetchImpl })).rejects.toBeInstanceOf(
      BalancesRequestError,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports the status code on a non-2xx response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, { status: 503 }));

    await expect(fetchAccountBalances("acct_1", { fetchImpl })).rejects.toMatchObject({
      reason: "request-failed",
      status: 503,
    });
  });

  it("never echoes the response body into the error message", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ internal: "db password hunter2" }, { status: 500 }),
    );

    await expect(fetchAccountBalances("acct_1", { fetchImpl })).rejects.toMatchObject({
      message: "The balances service responded with 500.",
    });
  });

  it("reports a network failure without a status", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(fetchAccountBalances("acct_1", { fetchImpl })).rejects.toMatchObject({
      reason: "network",
      status: null,
    });
  });

  it("re-throws abort errors untouched so callers can ignore them", async () => {
    const controller = new AbortController();
    const abortError = new DOMException("Aborted", "AbortError");
    const fetchImpl = vi.fn().mockImplementation(async () => {
      controller.abort();
      throw abortError;
    });

    await expect(
      fetchAccountBalances("acct_1", { fetchImpl, signal: controller.signal }),
    ).rejects.toBe(abortError);
  });

  it("re-throws an AbortError even when the signal never flipped", async () => {
    const abortError = new DOMException("Aborted", "AbortError");
    const fetchImpl = vi.fn().mockRejectedValue(abortError);

    await expect(fetchAccountBalances("acct_1", { fetchImpl })).rejects.toBe(abortError);
  });

  it("fails when the body is not valid JSON", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    } as unknown as Response);

    await expect(fetchAccountBalances("acct_1", { fetchImpl })).rejects.toMatchObject({
      reason: "invalid-response",
    });
  });
});
