import React, { useState, useCallback } from "react";
import { signIn, signOut, useIsSignedIn, type AuthServiceErrorCode } from "../services/authService";
import { useSessionExpiry } from "../hooks/useSessionExpiry";

const WALLET_BTN_STYLE: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: 8,
  border: "1px solid var(--line, rgba(169,184,255,0.16))",
  background: "var(--surface-soft, rgba(255,255,255,0.04))",
  color: "var(--text, #f3f5fb)",
  fontSize: "0.82rem",
  fontWeight: 600,
  fontFamily: "inherit",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

/**
 * WalletSignInButton — topbar control that lets the user sign in with Freighter
 * or sign out. Manages its own loading / error state so the rest of the app
 * does not need to know about it.
 */
export function WalletSignInButton() {
  const isAuthenticated = useIsSignedIn();
  const { isExpired } = useSessionExpiry();
  const signedIn = isAuthenticated && !isExpired;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await signIn();
    } catch (err) {
      const code: AuthServiceErrorCode | undefined =
        err && typeof err === "object" && "code" in err
          ? (err as { code: AuthServiceErrorCode }).code
          : undefined;

      if (code === "SIGNATURE_REJECTED") {
        // User deliberately cancelled — don't show an error.
      } else {
        setError(
          err instanceof Error && err.message
            ? err.message
            : "Sign in failed. Try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await signOut();
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="wallet-signin-btn-wrap" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      {signedIn ? (
        <button
          type="button"
          className="wallet-signin-btn wallet-signin-btn--out"
          onClick={handleSignOut}
          disabled={loading}
          aria-busy={loading}
          aria-label="Sign out of Callora"
          style={WALLET_BTN_STYLE}
        >
          {loading ? "Signing out…" : "Sign out"}
        </button>
      ) : (
        <button
          type="button"
          className="wallet-signin-btn wallet-signin-btn--in"
          onClick={handleSignIn}
          disabled={loading}
          aria-busy={loading}
          aria-label="Sign in with Freighter wallet"
          style={{ ...WALLET_BTN_STYLE, background: "var(--accent, #4e85ff)", color: "#fff", border: "none" }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      )}
      {error && (
        <span
          role="alert"
          aria-live="polite"
          style={{ fontSize: "0.75rem", color: "var(--danger, #ff7d8d)", maxWidth: 220, textAlign: "right" }}
        >
          {error}
        </span>
      )}
    </div>
  );
}

export default WalletSignInButton;
