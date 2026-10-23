import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAccount, useAccountId, useSwitchAccount, useInvalidateCache, useRemoveAccount, useRenameAccount } from "./useAccount";
import { addAccount, switchAccount, _reset, getKnownAccounts } from "../state/accountStore";
import { getCache, setCache, invalidateAccountCache } from "../utils/offlineApiCache";

let ACCOUNT_1: { id: string; label: string; apiKey: string };
let ACCOUNT_2: { id: string; label: string; apiKey: string };

beforeEach(() => {
  localStorage.clear();
  _reset();
  ACCOUNT_1 = { id: "account-1", label: "Account 1", apiKey: "ck_live_aaa" };
  ACCOUNT_2 = { id: "account-2", label: "Account 2", apiKey: "ck_live_bbb" };
});

afterEach(() => {
  localStorage.clear();
  _reset();
});

describe("useAccount", () => {
  it("returns null when no account is set", () => {
    const { result } = renderHook(() => useAccount());
    expect(result.current).toBeNull();
  });

  it("returns current account after switch", () => {
    addAccount(ACCOUNT_1);
    addAccount(ACCOUNT_2);
    const { result } = renderHook(() => useAccount());
    act(() => switchAccount(ACCOUNT_1.id));
    expect(result.current?.id).toBe("account-1");
  });
});

describe("useAccountId", () => {
  it("returns null when no account is set", () => {
    const { result } = renderHook(() => useAccountId());
    expect(result.current).toBeNull();
  });

  it("returns account id after switch", () => {
    addAccount(ACCOUNT_1);
    const { result } = renderHook(() => useAccountId());
    act(() => switchAccount(ACCOUNT_1.id));
    expect(result.current).toBe("account-1");
  });
});

describe("useSwitchAccount", () => {
  it("switches account and invalidates previous account cache", () => {
    addAccount(ACCOUNT_1);
    addAccount(ACCOUNT_2);
    setCache(ACCOUNT_1.id, "key-1", { value: "old" });
    const { result } = renderHook(() => useSwitchAccount());
    act(() => result.current(ACCOUNT_1.id));
    act(() => result.current(ACCOUNT_2.id));
    expect(getCache(ACCOUNT_1.id, "key-1")).toBeNull();
    expect(getCache(ACCOUNT_2.id, "key-1")).toBeNull();
  });

  it("does not invalidate when switching to the same account", () => {
    addAccount(ACCOUNT_1);
    setCache(ACCOUNT_1.id, "key-1", { value: "same" });
    const { result } = renderHook(() => useSwitchAccount());
    act(() => result.current(ACCOUNT_1.id));
    expect(getCache(ACCOUNT_1.id, "key-1")).toEqual({ value: "same" });
  });
});

describe("useInvalidateCache", () => {
  it("invalidates cache for the given account", () => {
    addAccount(ACCOUNT_1);
    setCache(ACCOUNT_1.id, "key-1", { value: 1 });
    const { result } = renderHook(() => useInvalidateCache());
    act(() => result.current(ACCOUNT_1.id));
    expect(getCache(ACCOUNT_1.id, "key-1")).toBeNull();
  });
});

describe("useRemoveAccount", () => {
  it("removes an account and invalidates its cache", () => {
    addAccount(ACCOUNT_1);
    setCache(ACCOUNT_1.id, "key-1", { value: 1 });
    const { result } = renderHook(() => useRemoveAccount());
    act(() => result.current(ACCOUNT_1.id));
    expect(getKnownAccounts().length).toBe(0);
    expect(getCache(ACCOUNT_1.id, "key-1")).toBeNull();
  });
});

describe("useRenameAccount", () => {
  it("renames an account", () => {
    addAccount(ACCOUNT_1);
    const { result } = renderHook(() => useRenameAccount());
    act(() => { result.current(ACCOUNT_1.id, "New Name"); });
    expect(getKnownAccounts()[0].label).toBe("New Name");
  });

  it("returns false for empty label", () => {
    addAccount(ACCOUNT_1);
    const { result } = renderHook(() => useRenameAccount());
    act(() => { result.current(ACCOUNT_1.id, ""); });
    expect(getKnownAccounts()[0].label).toBe("Account 1");
  });

  it("returns false for duplicate label", () => {
    addAccount(ACCOUNT_1);
    addAccount(ACCOUNT_2);
    const { result } = renderHook(() => useRenameAccount());
    act(() => { result.current(ACCOUNT_1.id, "Account 2"); });
    expect(getKnownAccounts()[0].label).toBe("Account 1");
  });
});
