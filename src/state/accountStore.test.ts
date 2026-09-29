import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { getCurrentAccount, getKnownAccounts, switchAccount, addAccount, subscribe, _reset, _load } from "./accountStore";

const ACCOUNT_1 = { id: "account-1", label: "Account 1", apiKey: "ck_live_aaa" };
const ACCOUNT_2 = { id: "account-2", label: "Account 2", apiKey: "ck_live_bbb" };

beforeEach(() => {
  localStorage.clear();
  _reset();
});

afterEach(() => {
  localStorage.clear();
  _reset();
});

describe("accountStore", () => {
  it("starts with no current account when storage is empty", () => {
    expect(getCurrentAccount()).toBeNull();
  });

  it("adds and retrieves accounts", () => {
    addAccount(ACCOUNT_1);
    expect(getKnownAccounts()).toContainEqual(ACCOUNT_1);
  });

  it("switches account and returns the new account", () => {
    addAccount(ACCOUNT_1);
    addAccount(ACCOUNT_2);
    switchAccount(ACCOUNT_2.id);
    expect(getCurrentAccount()?.id).toBe("account-2");
  });

  it("does not switch to unknown account", () => {
    addAccount(ACCOUNT_1);
    switchAccount("unknown");
    expect(getCurrentAccount()).toBeNull();
  });

  it("is idempotent when switching to the same account", () => {
    addAccount(ACCOUNT_1);
    switchAccount(ACCOUNT_1.id);
    switchAccount(ACCOUNT_1.id);
    expect(getCurrentAccount()?.id).toBe("account-1");
  });

  it("notifies subscribers on account change", () => {
    addAccount(ACCOUNT_1);
    const listener = vi.fn();
    subscribe(listener);
    switchAccount(ACCOUNT_1.id);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not notify when switching to same account", () => {
    addAccount(ACCOUNT_1);
    const listener = vi.fn();
    subscribe(listener);
    switchAccount(ACCOUNT_1.id);
    switchAccount(ACCOUNT_1.id);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("handles duplicate addAccount gracefully", () => {
    addAccount(ACCOUNT_1);
    addAccount(ACCOUNT_1);
    expect(getKnownAccounts().filter((a) => a.id === ACCOUNT_1.id).length).toBe(1);
  });

  it("recovers from corrupt localStorage on load", () => {
    localStorage.setItem("callora_known_accounts", "not-json");
    _load();
    expect(getKnownAccounts()).toEqual([]);
  });
});
