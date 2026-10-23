import { invalidateAccountCache } from "../utils/offlineApiCache";

const ACCOUNT_KEY = "callora_current_account";
const ACCOUNTS_KEY = "callora_known_accounts";

export type Account = {
  id: string;
  label: string;
  apiKey: string;
  timezone?: string;
};

type AccountState = {
  currentAccountId: string | null;
  accounts: Account[];
};

type Listener = () => void;

let state: AccountState = {
  currentAccountId: null,
  accounts: [],
};
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((fn) => fn());
}

function persist(stateToSave: AccountState): void {
  if (typeof window === "undefined") return;
  try {
    if (stateToSave.currentAccountId) {
      window.localStorage.setItem(ACCOUNT_KEY, stateToSave.currentAccountId);
    } else {
      window.localStorage.removeItem(ACCOUNT_KEY);
    }
    window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(stateToSave.accounts));
  } catch {
    /* ignore storage errors */
  }
}

function load(): void {
  if (typeof window === "undefined") return;
  try {
    const current = window.localStorage.getItem(ACCOUNT_KEY);
    const raw = window.localStorage.getItem(ACCOUNTS_KEY);
    const accounts = raw ? (JSON.parse(raw) as Account[]) : [];
    state = {
      currentAccountId: current,
      accounts: accounts,
    };
  } catch {
    /* ignore parse errors */
  }
}

load();

export function getCurrentAccount(): Account | null {
  const account = state.accounts.find((a) => a.id === state.currentAccountId) ?? null;
  return account;
}

export function getKnownAccounts(): Account[] {
  return [...state.accounts];
}

export function getAccountById(accountId: string): Account | undefined {
  return state.accounts.find((a) => a.id === accountId);
}

export function switchAccount(accountId: string): void {
  if (state.currentAccountId === accountId) return;
  const account = state.accounts.find((a) => a.id === accountId);
  if (!account) return;
  state.currentAccountId = accountId;
  persist(state);
  notify();
}

export function addAccount(account: Account): void {
  if (state.accounts.find((a) => a.id === account.id)) return;
  state.accounts.push(account);
  persist(state);
  notify();
}

let accountCounter = 0;

export function createAccount(label: string): Account {
  accountCounter += 1;
  const id = `account-${Date.now()}-${accountCounter}-${Math.random().toString(36).slice(2, 8)}`;
  const account: Account = { id, label, apiKey: `ck_live_${Math.random().toString(36).slice(2)}` };
  addAccount(account);
  return account;
}

export function removeAccount(accountId: string): boolean {
  const idx = state.accounts.findIndex((a) => a.id === accountId);
  if (idx === -1) return false;
  const wasCurrent = state.currentAccountId === accountId;
  state.accounts.splice(idx, 1);
  if (wasCurrent && state.accounts.length > 0) {
    state.currentAccountId = state.accounts[0].id;
  } else if (wasCurrent) {
    state.currentAccountId = null;
  }
  persist(state);
  invalidateAccountCache(accountId);
  notify();
  return true;
}

export function renameAccount(accountId: string, newLabel: string): boolean {
  if (!newLabel.trim()) return false;
  const account = state.accounts.find((a) => a.id === accountId);
  if (!account) return false;
  if (state.accounts.some((a) => a.id !== accountId && a.label === newLabel.trim())) return false;
  account.label = newLabel.trim();
  persist(state);
  notify();
  return true;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getCurrentAccountId(): string | null {
  return state.currentAccountId;
}

export function _reset(): void {
  state = {
    currentAccountId: null,
    accounts: [],
  };
  listeners.clear();
}

export function _load(): void {
  load();
}
