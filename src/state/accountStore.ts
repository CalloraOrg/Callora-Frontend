import { invalidateAccountCache } from "../utils/offlineApiCache";

const ACCOUNT_KEY = "callora_current_account";
const ACCOUNTS_KEY = "callora_known_accounts";

export type Account = {
  id: string;
  label: string;
  timezone?: string;
};

type AccountInput = Account & {
  // Compatibility-only input for historical/test objects. Credential material
  // is deliberately discarded before the account enters application state.
  apiKey?: unknown;
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

function sanitizeAccount(account: AccountInput): Account | null {
  if (
    typeof account.id !== "string" ||
    !account.id.trim() ||
    typeof account.label !== "string" ||
    !account.label.trim()
  ) {
    return null;
  }

  const safe: Account = { id: account.id, label: account.label };
  if (typeof account.timezone === "string" && account.timezone.trim()) {
    safe.timezone = account.timezone;
  }
  return safe;
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
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    const accounts = Array.isArray(parsed)
      ? parsed
          .map((item) =>
            item && typeof item === "object"
              ? sanitizeAccount(item as AccountInput)
              : null,
          )
          .filter((account): account is Account => account !== null)
      : [];

    state = {
      currentAccountId:
        current && accounts.some((account) => account.id === current)
          ? current
          : null,
      accounts,
    };

    // Purge legacy credential-shaped fields while preserving local metadata.
    persist(state);
  } catch {
    state = { currentAccountId: null, accounts: [] };
  }
}

load();

export function getCurrentAccount(): Account | null {
  const account = state.accounts.find((a) => a.id === state.currentAccountId) ?? null;
  return account;
}

export function getKnownAccounts(): Account[] {
  return state.accounts.map((account) => ({ ...account }));
}

export function getAccountById(accountId: string): Account | undefined {
  const account = state.accounts.find((candidate) => candidate.id === accountId);
  return account ? { ...account } : undefined;
}

export function switchAccount(accountId: string): void {
  if (state.currentAccountId === accountId) return;
  const account = state.accounts.find((a) => a.id === accountId);
  if (!account) return;
  state.currentAccountId = accountId;
  persist(state);
  notify();
}

export function addAccount(account: AccountInput): void {
  const safe = sanitizeAccount(account);
  if (!safe || state.accounts.some((candidate) => candidate.id === safe.id)) {
    return;
  }
  state.accounts.push(safe);
  persist(state);
  notify();
}

let accountCounter = 0;

export function createAccount(label: string): Account {
  accountCounter += 1;
  const id = `account-${Date.now()}-${accountCounter}-${Math.random().toString(36).slice(2, 8)}`;
  const account: Account = { id, label };
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
