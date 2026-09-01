import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from "react";
import { getCurrentAccount, switchAccount as doSwitchAccount, addAccount, getKnownAccounts, subscribe } from "../state/accountStore";
import { invalidateAccountCache } from "../utils/offlineApiCache";

const DEFAULT_ACCOUNTS = [
  { id: "account-1", label: "Account 1", apiKey: "ck_live_4e85ff1ed6a4ff73893a0bf73f2bb", timezone: "America/New_York" },
  { id: "account-2", label: "Account 2", apiKey: "ck_live_9a2bc33e7f5d991475c1cb84g3cc", timezone: "Europe/London" },
];

interface AccountContextValue {
  account: { id: string; label: string; apiKey: string; timezone?: string } | null;
  accounts: { id: string; label: string; apiKey: string; timezone?: string }[];
  switchAccount: (accountId: string) => void;
}

const AccountContext = createContext<AccountContextValue>({
  account: null,
  accounts: [],
  switchAccount: () => {},
});

export function AccountProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState(getCurrentAccount);
  const [accounts, setAccounts] = useState(getKnownAccounts);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const known = getKnownAccounts();
    if (known.length === 0) {
      DEFAULT_ACCOUNTS.forEach((acc) => addAccount(acc));
    }
    setAccounts(getKnownAccounts());
    setReady(true);
    const unsub = subscribe(() => {
      setAccount(getCurrentAccount());
      setAccounts(getKnownAccounts());
    });
    return unsub;
  }, []);

  const switchAccountHandler = useCallback(
    (accountId: string) => {
      const current = getCurrentAccount();
      if (current && current.id !== accountId) {
        invalidateAccountCache(current.id);
      }
      doSwitchAccount(accountId);
    },
    [],
  );

  if (!ready) return null;

  return (
    <AccountContext.Provider value={{ account, accounts, switchAccount: switchAccountHandler }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccountContext(): AccountContextValue {
  return useContext(AccountContext);
}
