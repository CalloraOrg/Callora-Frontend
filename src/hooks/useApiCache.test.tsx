import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AccountProvider, useAccountContext } from "./useAccountContext";
import { _reset } from "../state/accountStore";
import { useApiCache } from "./useApiCache";

const ACCOUNT_A = "account-1";
const ACCOUNT_B = "account-2";
const CACHE_KEY = "dashboard";

function wrapper({ children }: { children: React.ReactNode }) {
  return <AccountProvider>{children}</AccountProvider>;
}

function useCacheWithAccountSwitcher() {
  const cache = useApiCache<{ value: string }>();
  const { account, accounts, switchAccount } = useAccountContext();

  return { ...cache, account, accounts, switchAccount };
}

beforeEach(() => {
  localStorage.clear();
  _reset();
});

afterEach(() => {
  localStorage.clear();
  _reset();
});

describe("useApiCache", () => {
  it("does nothing when no account is active", async () => {
    const { result } = renderHook(() => useCacheWithAccountSwitcher(), { wrapper });

    await waitFor(() => expect(result.current.accounts).toHaveLength(2));

    act(() => {
      result.current.set(CACHE_KEY, { value: "ignored" });
      result.current.invalidate(CACHE_KEY);
    });

    expect(result.current.accountId).toBeNull();
    expect(result.current.get(CACHE_KEY)).toBeNull();
    expect(localStorage.getItem("callora_api_cache_account-1_dashboard")).toBeNull();
  });

  it("round-trips and invalidates a value for the active account", async () => {
    const { result } = renderHook(() => useCacheWithAccountSwitcher(), { wrapper });

    await waitFor(() => expect(result.current.accounts).toHaveLength(2));
    act(() => result.current.switchAccount(ACCOUNT_A));
    await waitFor(() => expect(result.current.accountId).toBe(ACCOUNT_A));

    act(() => result.current.set(CACHE_KEY, { value: "cached" }));
    expect(result.current.get(CACHE_KEY)).toEqual({ value: "cached" });

    act(() => result.current.invalidate(CACHE_KEY));
    expect(result.current.get(CACHE_KEY)).toBeNull();
  });

  it("keeps cache values isolated when switching accounts", async () => {
    const { result } = renderHook(() => useCacheWithAccountSwitcher(), { wrapper });

    await waitFor(() => expect(result.current.accounts).toHaveLength(2));
    act(() => result.current.switchAccount(ACCOUNT_A));
    await waitFor(() => expect(result.current.accountId).toBe(ACCOUNT_A));

    act(() => result.current.set(CACHE_KEY, { value: "account-a" }));
    expect(result.current.get(CACHE_KEY)).toEqual({ value: "account-a" });

    act(() => result.current.switchAccount(ACCOUNT_B));
    await waitFor(() => expect(result.current.accountId).toBe(ACCOUNT_B));
    expect(result.current.get(CACHE_KEY)).toBeNull();

    act(() => result.current.set(CACHE_KEY, { value: "account-b" }));
    expect(result.current.get(CACHE_KEY)).toEqual({ value: "account-b" });
  });
});