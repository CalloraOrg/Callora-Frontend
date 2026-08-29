import { useEffect, useState } from "react";
import { QuotaStore, quotaStore } from "../state/quotaStore";
import { useQuotaStore } from "../hooks/useQuotaStore";
import "./QuotaManager.css";

export interface QuotaManagerProps {
  /** Store instance to bind to. Defaults to the shared singleton. */
  store?: QuotaStore;
  /** When provided, the manager tracks this account and switches on change. */
  accountId?: string;
  /** Accounts offered in the account switcher (issue #995: account-switch). */
  accounts?: string[];
  className?: string;
}

function parseQuota(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/**
 * QuotaManager — renders quota state from the race-safe {@link QuotaStore}.
 *
 * Guarantees (issue #995):
 *  - Never reports an unconfirmed mutation as successful: while a submit is
 *    in-flight the status reads "Saving…", not "Saved".
 *  - Explicitly renders loading, stale (updated elsewhere), error, and retry
 *    states, plus an account switcher for the account-switch lifecycle.
 *  - The displayed value always reflects authoritative server state; the input
 *    is only an optimistic draft.
 */
export default function QuotaManager({
  store = quotaStore,
  accountId,
  accounts,
  className,
}: QuotaManagerProps) {
  const state = useQuotaStore(store);
  const activeId = state.currentAccountId || accountId || "";
  const slice = activeId
    ? state.slices[activeId] ?? store.getSlice(activeId)
    : store.getSlice(activeId);

  const [draft, setDraft] = useState<string>(
    slice.value !== null ? String(slice.value) : "",
  );

  // Track the active account.
  useEffect(() => {
    if (accountId) {
      void store.selectAccount(accountId);
    }
  }, [accountId, store]);

  // Keep the editable draft in sync with authoritative state, but don't fight
  // the user while they are actively typing a new value.
  const authoritative = slice.value !== null ? String(slice.value) : "";
  useEffect(() => {
    if (slice.pendingStatus !== "submitting") {
      setDraft(authoritative);
    }
  }, [authoritative, slice.pendingStatus]);

  const switchAccount = (next: string) => {
    void store.selectAccount(next);
  };

  const handleSave = () => {
    const value = parseQuota(draft);
    void store.update(value);
  };

  const isLoading = slice.loadStatus === "loading" && slice.value === null;
  const isError = slice.loadStatus === "error";
  const isStale = slice.loadStatus === "stale";
  const isSaving = slice.pendingStatus === "submitting";
  const pendingError = slice.pendingStatus === "error" ? slice.pendingError : null;

  return (
    <section
      className={`quota-manager${className ? ` ${className}` : ""}`}
      aria-labelledby="quota-manager-title"
    >
      <header className="quota-manager__header">
        <h2 id="quota-manager-title" className="quota-manager__title">
          Quota
        </h2>
        {accounts && accounts.length > 0 && (
          <label className="quota-manager__account-switch">
            <span className="quota-manager__visually-hidden">Account</span>
            <select
              value={activeId}
              onChange={(e) => switchAccount(e.target.value)}
              aria-label="Select account"
            >
              {accounts.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      {isLoading && (
        <p className="quota-manager__status quota-manager__status--loading" role="status">
          Loading quota…
        </p>
      )}

      {isError && (
        <div className="quota-manager__error" role="alert">
          <p>Could not load quota{slice.loadError ? `: ${slice.loadError}` : "."}</p>
          <button
            type="button"
            className="quota-manager__retry"
            onClick={() => void store.refresh()}
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {isStale && (
            <p
              className="quota-manager__status quota-manager__status--stale"
              role="status"
            >
              Updated in another tab — review the latest value.
              <button
                type="button"
                className="quota-manager__link"
                onClick={() => void store.refresh()}
              >
                Refresh
              </button>
            </p>
          )}

          <div className="quota-manager__field">
            <label htmlFor="quota-manager-input">Requests per window</label>
            <input
              id="quota-manager-input"
              type="text"
              inputMode="numeric"
              value={draft}
              disabled={isSaving}
              onChange={(e) => setDraft(e.target.value)}
              aria-describedby="quota-manager-status"
            />
          </div>

          <div
            id="quota-manager-status"
            className="quota-manager__status-row"
            aria-live="polite"
          >
            {isSaving && (
              <span className="quota-manager__status quota-manager__status--saving">
                Saving…
              </span>
            )}
            {!isSaving && slice.loadStatus === "ready" && !pendingError && (
              <span className="quota-manager__status quota-manager__status--ready">
                Synced{slice.lastSyncedAt ? " just now" : ""}.
              </span>
            )}
            {pendingError && (
              <span
                className="quota-manager__status quota-manager__status--error"
                role="alert"
              >
                {pendingError}
              </span>
            )}
          </div>

          <div className="quota-manager__actions">
            <button
              type="button"
              className="quota-manager__save"
              onClick={handleSave}
              disabled={isSaving || isStale}
            >
              {isSaving ? "Saving…" : "Save quota"}
            </button>
            {pendingError && (
              <button
                type="button"
                className="quota-manager__retry"
                onClick={() => void store.retry()}
              >
                Retry
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
