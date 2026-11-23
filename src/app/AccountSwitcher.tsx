import { useState } from "react";
import { useAccountContext } from "../hooks/useAccountContext";

export function AccountSwitcher() {
  const { account, accounts, switchAccount, addAccount, removeAccount, renameAccount } = useAccountContext();
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [addError, setAddError] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameLabel, setRenameLabel] = useState("");
  const [renameError, setRenameError] = useState("");

  if (accounts.length === 0) return null;

  const handleAdd = () => {
    setAddError("");
    const trimmed = newLabel.trim();
    if (!trimmed) {
      setAddError("Label cannot be empty.");
      return;
    }
    if (accounts.some((a) => a.label === trimmed)) {
      setAddError("Label must be unique.");
      return;
    }
    addAccount(trimmed);
    setNewLabel("");
    setShowAdd(false);
    setOpen(false);
  };

  const handleRemoveCurrent = () => {
    if (account) {
      removeAccount(account.id);
    }
    setOpen(false);
  };

  const startRename = (acc: { id: string; label: string }) => {
    setRenamingId(acc.id);
    setRenameLabel(acc.label);
    setRenameError("");
  };

  const handleRename = (accId: string) => {
    setRenameError("");
    const trimmed = renameLabel.trim();
    if (!trimmed) {
      setRenameError("Label cannot be empty.");
      return;
    }
    if (accounts.some((a) => a.id !== accId && a.label === trimmed)) {
      setRenameError("Label must be unique.");
      return;
    }
    renameAccount(accId, trimmed);
    setRenamingId(null);
    setRenameLabel("");
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className="ghost-button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
        style={{ fontSize: 13 }}
      >
        {account ? account.label : "Switch account"}
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label="Accounts"
          style={{
            position: "absolute",
            right: 0,
            top: "100%",
            marginTop: 8,
            padding: 8,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            listStyle: "none",
            minWidth: 180,
            zIndex: 1000,
          }}
        >
          {accounts.map((acc) => (
            <li key={acc.id} style={{ marginBottom: 2 }}>
              {renamingId === acc.id ? (
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <input
                    type="text"
                    value={renameLabel}
                    onChange={(e) => setRenameLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(acc.id);
                    }}
                    style={{ flex: 1, fontSize: 13, padding: "4px 6px" }}
                    autoFocus
                    aria-label="Rename account"
                  />
                  <button type="button" onClick={() => handleRename(acc.id)} style={{ fontSize: 12 }}>
                    OK
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingId(null);
                      setRenameLabel("");
                    }}
                    style={{ fontSize: 12 }}
                  >
                    Cancel
                  </button>
                  {renameError && <span style={{ color: "red", fontSize: 11 }}>{renameError}</span>}
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span
                    role="option"
                    aria-selected={account?.id === acc.id}
                    onClick={() => {
                      switchAccount(acc.id);
                      setOpen(false);
                    }}
                    style={{
                      padding: "8px 12px",
                      cursor: "pointer",
                      borderRadius: 4,
                      background: account?.id === acc.id ? "var(--accent)" : "transparent",
                      color: account?.id === acc.id ? "#fff" : "var(--text)",
                      fontSize: 13,
                      flex: 1,
                    }}
                  >
                    {acc.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => startRename(acc)}
                    style={{ fontSize: 11, padding: "2px 6px", marginLeft: 4 }}
                    aria-label={`Rename ${acc.label}`}
                  >
                    Rename
                  </button>
                </div>
              )}
            </li>
          ))}
          {showAdd ? (
            <li style={{ borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 4 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAdd();
                  }}
                  placeholder="Account label"
                  style={{ fontSize: 13, padding: "4px 6px" }}
                  autoFocus
                  aria-label="New account label"
                />
                <button type="button" onClick={handleAdd} style={{ fontSize: 12 }}>
                  Add
                </button>
                {addError && <span style={{ color: "red", fontSize: 11 }}>{addError}</span>}
              </div>
            </li>
          ) : (
            <li style={{ borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => {
                  setShowAdd(true);
                  setAddError("");
                }}
                style={{ fontSize: 13, cursor: "pointer", background: "transparent", border: "none", color: "var(--accent)" }}
              >
                + Add account
              </button>
            </li>
          )}
          {account && (
            <li style={{ borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={handleRemoveCurrent}
                style={{ fontSize: 13, cursor: "pointer", background: "transparent", border: "none", color: "var(--accent)" }}
              >
                Remove {account.label}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export default AccountSwitcher;
