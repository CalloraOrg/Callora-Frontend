import { useId } from "react";
import { useAccounts } from "../hooks/useAccount";

/**
 * AccountSwitcher — lets the user act as a different Callora account.
 *
 * Changing the selection re-keys every account-scoped request (balances today),
 * so switching accounts immediately re-reads that account's balances instead of
 * showing the previous account's numbers.
 *
 * Accessibility: a real `<label>` is bound to the native `<select>`, which
 * keeps the control keyboard operable, screen-reader labelled, and usable
 * without any custom key handling.
 */
export default function AccountSwitcher() {
  const { accounts, accountId, setAccountId } = useAccounts();
  const selectId = useId();

  return (
    <div className="account-switcher">
      <label className="account-switcher__label" htmlFor={selectId}>
        Account
      </label>
      <select
        id={selectId}
        className="account-switcher__select"
        value={accountId}
        onChange={(event) => setAccountId(event.target.value)}
      >
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
      </select>
    </div>
  );
}
