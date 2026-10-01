import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from "react";
import { fetchAuthenticatedAccount } from "../api/accountApi";
import { getCurrentAccount, switchAccount as doSwitchAccount, addAccount, getKnownAccounts, subscribe, removeAccount, renameAccount, createAccount, type Account } from "../state/accountStore";
import { invalidateAccountCache } from "../utils/offlineApiCache";

interface AccountContextValue {
  account: Account | null;
  timezone?: string;
  accounts: Account[];
  switchAccount: (accountId: string) => void;
  addAccount: (label: string) => void;
  removeAccount: (accountId: string) => void;
  renameAccount: (accountId: string, newLabel: string) => void;
}

const AccountContext = createContext<AccountContextValue>({
  account: null,
  accounts: [],
  switchAccount: () => {},
  addAccount: () => {},
  removeAccount: () => {},
  renameAccount: () => {},
});

export function AccountProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState(getCurrentAccount);
  const [accounts, setAccounts] = useState(getKnownAccounts);

  useEffect(() => {
    const controller = new AbortController();
    const syncFromStore = () => {
      setAccount(getCurrentAccount());
      setAccounts(getKnownAccounts());
    };
    const unsubscribe = subscribe(syncFromStore);

    // Discover the authenticated developer without blocking the app or
    // replacing the local add/rename/remove account model.
    void fetchAuthenticatedAccount(controller.signal)
      .then((authenticatedAccount) => {
        if (controller.signal.aborted || !authenticatedAccount) return;
        const hadCurrentAccount = getCurrentAccount() !== null;
        addAccount(authenticatedAccount);
        if (!hadCurrentAccount) {
          doSwitchAccount(authenticatedAccount.id);
        }
      })
      .catch((error: unknown) => {
        if (
          controller.signal.aborted ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          return;
        }
        // Keep existing non-secret local metadata on discovery failure.
      });

    return () => {
      controller.abort();
      unsubscribe();
    };
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

  const addAccountHandler = useCallback((label: string) => {
    const newAccount = createAccount(label);
    invalidateAccountCache(newAccount.id);
  }, []);

  const removeAccountHandler = useCallback((accountId: string) => {
    const current = getCurrentAccount();
    const isCurrent = current?.id === accountId;
    removeAccount(accountId);
    if (isCurrent) {
      const remaining = getKnownAccounts();
      if (remaining.length > 0) {
        invalidateAccountCache(accountId);
        switchAccountHandler(remaining[0].id);
      }
    }
  }, []);

  const renameAccountHandler = useCallback((accountId: string, newLabel: string) => {
    renameAccount(accountId, newLabel);
  }, []);

  return (
    <AccountContext.Provider
      value={{
        account,
        timezone: account?.timezone,
        accounts,
        switchAccount: switchAccountHandler,
        addAccount: addAccountHandler,
        removeAccount: removeAccountHandler,
        renameAccount: renameAccountHandler,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccountContext(): AccountContextValue {
  return useContext(AccountContext);
}
