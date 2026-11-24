import React, { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { APP_ROUTES } from "../config/constants";
import { useSessionExpiry } from "../hooks/useSessionExpiry";
import {
  signIn,
  useIsSignedIn,
  type AuthServiceErrorCode,
} from "../services/authService";
import { clearSessionExpiry } from "../services/sessionExpiry";

/** sessionStorage key holding the post-sign-in return target. */
export const RETURN_TO_STORAGE_KEY = "callora-auth-return-to";

const SENTINEL_ORIGIN = "https://callora.invalid";

/**
 * Validate that a candidate return target is a same-origin relative path
 * (preserving query string and hash). Rejects protocol-relative URLs
 * (`//evil.com`), absolute URLs (`https://evil.com`), backslash tricks
 * (`/\evil.com`), and control characters, falling back to the dashboard.
 */
export function sanitizeReturnTo(raw: string | null | undefined): string {
  if (typeof raw !== "string") return APP_ROUTES.dashboard;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return APP_ROUTES.dashboard;
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return APP_ROUTES.dashboard;
  }
  // eslint-disable-next-line no-control-regex -- intentionally rejects ASCII control characters in returnTo paths
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) {
    return APP_ROUTES.dashboard;
  }

  try {
    const parsed = new URL(trimmed, SENTINEL_ORIGIN);
    if (parsed.origin !== SENTINEL_ORIGIN) {
      return APP_ROUTES.dashboard;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return APP_ROUTES.dashboard;
  }
}

function readStoredReturnTo(): string | null {
  try {
    return sessionStorage.getItem(RETURN_TO_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredReturnTo(value: string): void {
  try {
    sessionStorage.setItem(RETURN_TO_STORAGE_KEY, value);
  } catch {
    // sessionStorage unavailable (e.g. private browsing) — degrade gracefully.
  }
}

function clearStoredReturnTo(): void {
  try {
    sessionStorage.removeItem(RETURN_TO_STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
}

export interface RequireAuthProps {
  children: React.ReactNode;
}

/**
 * Route guard for authenticated pages (Billing, My APIs, Publish, Webhook Deliveries).
 *
 * When the visitor is signed out — or their session expires mid-session — renders
 * a sign-in prompt instead of the protected page so no protected API calls fire.
 * After a successful Freighter sign-in, navigates back to the validated return URL.
 */
export default function RequireAuth({ children }: RequireAuthProps) {
  const signedIn = useIsSignedIn();
  const { isExpired } = useSessionExpiry();
  const isAuthenticated = signedIn && !isExpired;

  const location = useLocation();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stateReturnTo =
    location.state &&
    typeof location.state === "object" &&
    "returnTo" in location.state &&
    typeof (location.state as { returnTo?: unknown }).returnTo === "string"
      ? (location.state as { returnTo: string }).returnTo
      : null;

  const currentTarget = `${location.pathname}${location.search}${location.hash}`;

  useEffect(() => {
    if (!isAuthenticated) {
      const candidate = stateReturnTo ?? currentTarget;
      writeStoredReturnTo(sanitizeReturnTo(candidate));
    }
  }, [isAuthenticated, stateReturnTo, currentTarget]);

  const handleSignIn = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await signIn();
      clearSessionExpiry();
      const target = sanitizeReturnTo(
        stateReturnTo ?? readStoredReturnTo() ?? currentTarget,
      );
      clearStoredReturnTo();
      navigate(target, { replace: true });
    } catch (err) {
      const code: AuthServiceErrorCode | undefined =
        err && typeof err === "object" && "code" in err
          ? (err as { code: AuthServiceErrorCode }).code
          : undefined;

      if (code === "SIGNATURE_REJECTED") {
        // User cancelled the Freighter prompt — stay on this screen without an error.
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
  }, [currentTarget, navigate, stateReturnTo]);

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <section
      className="surface require-auth-prompt"
      aria-labelledby="require-auth-heading"
      style={{
        maxWidth: 520,
        margin: "3rem auto",
        padding: "2rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      <p className="eyebrow">Authentication Required</p>
      <h1 id="require-auth-heading" style={{ margin: 0 }}>
        {isExpired ? "Your session has expired" : "Sign in to continue"}
      </h1>
      <p style={{ margin: 0, color: "var(--muted, #9aa4bf)" }}>
        {isExpired
          ? "Your session is no longer valid. Reconnect your Freighter wallet to return to this page."
          : "This page requires an authenticated Callora session. Connect your Freighter wallet to continue."}
      </p>

      {error && (
        <p
          role="alert"
          aria-live="polite"
          style={{
            margin: 0,
            color: "var(--danger, #ff7d8d)",
            fontSize: "0.9rem",
          }}
        >
          {error}
        </p>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
        <button
          type="button"
          className="primary-button"
          onClick={handleSignIn}
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? "Connecting…" : "Connect Freighter"}
        </button>
        <Link to={APP_ROUTES.marketplace} className="link-nav">
          Back to Marketplace
        </Link>
      </div>
    </section>
  );
}
