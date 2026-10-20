import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { getCurrentAccount, getKnownAccounts, getCurrentAccountId, switchAccount, addAccount, subscribe, _reset, _load, removeAccount, renameAccount, createAccount } from "./accountStore";

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

  it("removes an account", () => {
    addAccount(ACCOUNT_1);
    addAccount(ACCOUNT_2);
    expect(getKnownAccounts().length).toBe(2);
    expect(removeAccount(ACCOUNT_1.id)).toBe(true);
    expect(getKnownAccounts().length).toBe(1);
    expect(getKnownAccounts()[0].id).toBe("account-2");
  });

  it("returns false when removing non-existent account", () => {
    expect(removeAccount("nonexistent")).toBe(false);
  });

  it("switches to another account when current account is removed", () => {
    addAccount(ACCOUNT_1);
    addAccount(ACCOUNT_2);
    switchAccount(ACCOUNT_1.id);
    expect(getCurrentAccount()?.id).toBe("account-1");
    removeAccount(ACCOUNT_1.id);
    expect(getCurrentAccount()?.id).toBe("account-2");
  });

  it("sets currentAccountId to null when removing the only account", () => {
    addAccount(ACCOUNT_1);
    switchAccount(ACCOUNT_1.id);
    removeAccount(ACCOUNT_1.id);
    expect(getCurrentAccountId()).toBeNull();
  });

  it("renames an account", () => {
    addAccount(ACCOUNT_1);
    expect(renameAccount(ACCOUNT_1.id, "New Label")).toBe(true);
    expect(getKnownAccounts()[0].label).toBe("New Label");
  });

  it("rejects empty label on rename", () => {
    addAccount(ACCOUNT_1);
    expect(renameAccount(ACCOUNT_1.id, "")).toBe(false);
    expect(renameAccount(ACCOUNT_1.id, "   ")).toBe(false);
  });

  it("rejects duplicate label on rename", () => {
    addAccount(ACCOUNT_1);
    addAccount(ACCOUNT_2);
    expect(renameAccount(ACCOUNT_1.id, "Account 2")).toBe(false);
    expect(getKnownAccounts()[0].label).toBe("Account 1");
  });

  it("returns false when renaming non-existent account", () => {
    expect(renameAccount("nonexistent", "New Label")).toBe(false);
  });

  it("creates an account with createAccount", () => {
    const account = createAccount("My Account");
    expect(account.label).toBe("My Account");
    expect(account.id).toBeTruthy();
    expect(getKnownAccounts().length).toBe(1);
  });

  it("creates accounts with unique ids via createAccount", () => {
    const a1 = createAccount("First");
    const a2 = createAccount("Second");
    expect(a1.id).not.toBe(a2.id);
    expect(getKnownAccounts().length).toBe(2);
  });
});
