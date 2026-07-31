import { FormEvent, useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import LiveRegion from "../components/LiveRegion";
import useDocumentTitle from "../hooks/useDocumentTitle";

/**
 * LoginPage — issue #530 (GrantFox FWC26 / Stellar Wave campaign).
 *
 * Mock sign-in surface that announces every status change through a polite
 * `aria-live` region so screen-reader users hear submitting / success / error
 * updates without relying on visual cues alone (WCAG 2.1 AA).
 *
 * Accessibility:
 * - Single `role="status"` live region via shared `LiveRegion` (`aria-live="polite"`).
 * - Form fields use associated labels; validation errors are linked with `aria-describedby`.
 * - Submit button exposes busy state via `aria-busy` / `disabled` while in flight.
 * - Focus moves to the visible status banner after submit so keyboard users land on feedback.
 *
 * Design-token + dark-mode:
 * - Colors and borders use CSS custom properties (`--surface`, `--text`, `--accent`, …).
 * - No hardcoded hex values; ThemeProvider light/dark tokens apply automatically.
 */

export type LoginStatus = "idle" | "submitting" | "success" | "error";

export interface LoginPageProps {
  /**
   * Async sign-in handler. Resolves on success; rejects on failure.
   * Defaults to a short mock delay that succeeds for any non-empty credentials.
   */
  onSubmit?: (email: string, password: string) => Promise<void>;
  /** Destination after a successful sign-in. Defaults to `/dashboard`. */
  successRedirect?: string;
}

const STATUS_ANNOUNCEMENTS: Record<LoginStatus, string> = {
  idle: "",
  submitting: "Signing in. Please wait.",
  success: "Sign-in successful. Redirecting to your dashboard.",
  error: "Sign-in failed. Check your email and password, then try again.",
};

const STATUS_BANNER: Record<Exclude<LoginStatus, "idle">, string> = {
  submitting: "Signing in…",
  success: "Signed in successfully",
  error: "Sign-in failed",
};

async function defaultSignIn(email: string, password: string): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, 400));
  if (!email.trim() || !password.trim()) {
    throw new Error("Email and password are required.");
  }
}

export default function LoginPage({
  onSubmit = defaultSignIn,
  successRedirect = "/dashboard",
}: LoginPageProps) {
  const navigate = useNavigate();
  useDocumentTitle(
    "Sign in – Callora",
    "Sign in to Callora to manage API usage, deposits, and marketplace listings.",
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<LoginStatus>("idle");
  const [errorDetail, setErrorDetail] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [announcement, setAnnouncement] = useState("");

  const statusBannerRef = useRef<HTMLDivElement>(null);
  const submittingRef = useRef(false);

  const announce = useCallback((next: LoginStatus, detail = "") => {
    const base = STATUS_ANNOUNCEMENTS[next];
    setAnnouncement(detail ? `${base} ${detail}`.trim() : base);
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setFieldError("Enter both email and password to continue.");
      setStatus("idle");
      setAnnouncement("Enter both email and password to continue.");
      return;
    }

    submittingRef.current = true;
    setFieldError("");
    setErrorDetail("");
    setStatus("submitting");
    announce("submitting");

    // Move focus to the status banner so keyboard / SR users hear the update.
    requestAnimationFrame(() => {
      statusBannerRef.current?.focus();
    });

    try {
      await onSubmit(trimmedEmail, password);
      setStatus("success");
      announce("success");
      window.setTimeout(() => {
        navigate(successRedirect);
      }, 600);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.";
      setErrorDetail(message);
      setStatus("error");
      announce("error", message);
    } finally {
      submittingRef.current = false;
    }
  };

  const isBusy = status === "submitting";
  const showBanner = status !== "idle";

  return (
    <div
      className="login-page"
      style={{
        padding: "clamp(16px, 4vw, 32px) 0",
        maxWidth: "440px",
        margin: "0 auto",
      }}
    >
      <header style={{ marginBottom: "28px" }}>
        <p className="eyebrow">Callora account</p>
        <h1
          style={{
            margin: "0 0 10px",
            fontSize: "clamp(1.75rem, 3vw, 2.25rem)",
            fontWeight: 700,
            color: "var(--text)",
          }}
        >
          Sign in
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: "1rem",
            color: "var(--muted)",
            lineHeight: 1.65,
          }}
        >
          Access your vault, marketplace listings, and API usage with your
          Callora credentials.
        </p>
      </header>

      <section
        className="surface"
        style={{
          borderRadius: "16px",
          padding: "clamp(20px, 4vw, 28px)",
          border: "1px solid var(--line)",
        }}
        aria-labelledby="login-form-heading"
      >
        <h2
          id="login-form-heading"
          style={{
            margin: "0 0 20px",
            fontSize: "1.05rem",
            fontWeight: 600,
            color: "var(--text)",
          }}
        >
          Account credentials
        </h2>

        {showBanner && (
          <div
            ref={statusBannerRef}
            tabIndex={-1}
            data-testid="login-status-banner"
            data-status={status}
            style={{
              marginBottom: "16px",
              padding: "12px 14px",
              borderRadius: "10px",
              border: "1px solid var(--line)",
              background: "var(--surface-soft)",
              color: "var(--text)",
              outline: "none",
            }}
          >
            <strong>{STATUS_BANNER[status as Exclude<LoginStatus, "idle">]}</strong>
            {status === "error" && errorDetail && (
              <p
                className="error-text"
                style={{ margin: "6px 0 0", color: "var(--danger)" }}
              >
                {errorDetail}
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <label className="field-label" htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (fieldError) setFieldError("");
            }}
            disabled={isBusy || status === "success"}
            aria-invalid={Boolean(fieldError)}
            aria-describedby={
              fieldError ? "login-field-error" : "login-email-help"
            }
            style={{
              width: "100%",
              marginBottom: "4px",
              padding: "10px 12px",
              borderRadius: "10px",
              border: "1px solid var(--line)",
              background: "var(--surface-soft)",
              color: "var(--text)",
              boxSizing: "border-box",
            }}
          />
          <p
            id="login-email-help"
            className="helper-text"
            style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: "0.875rem" }}
          >
            Use the email associated with your Callora account.
          </p>

          <label className="field-label" htmlFor="login-password">
            Password
          </label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (fieldError) setFieldError("");
            }}
            disabled={isBusy || status === "success"}
            aria-invalid={Boolean(fieldError)}
            aria-describedby={fieldError ? "login-field-error" : undefined}
            style={{
              width: "100%",
              marginBottom: fieldError ? "8px" : "20px",
              padding: "10px 12px",
              borderRadius: "10px",
              border: "1px solid var(--line)",
              background: "var(--surface-soft)",
              color: "var(--text)",
              boxSizing: "border-box",
            }}
          />

          {fieldError && (
            <p
              id="login-field-error"
              className="error-text"
              role="alert"
              style={{ margin: "0 0 16px", color: "var(--danger)" }}
            >
              {fieldError}
            </p>
          )}

          <button
            type="submit"
            className="primary-button"
            disabled={isBusy || status === "success"}
            aria-busy={isBusy}
            data-testid="login-submit"
            style={{ width: "100%" }}
          >
            {isBusy ? "Signing in…" : status === "success" ? "Signed in" : "Sign in"}
          </button>
        </form>
      </section>

      {/* Screen-reader status announcements (polite aria-live) */}
      <LiveRegion
        message={announcement}
        regionId="login-status"
        aria-live="polite"
      />
    </div>
  );
}
