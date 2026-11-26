import { useEffect, useState } from "react";
import { analytics } from "../services/AnalyticsService";
import { getPref, PREFS_CHANGED_EVENT, setPref } from "../utils/userPrefs";

/**
 * Non-blocking, keyboard-accessible analytics consent banner.
 * Shown until the user explicitly chooses Accept or Decline
 * (`analyticsConsentDecided === true`), so declining never re-prompts.
 */
export function ConsentBanner() {
  const [decided, setDecided] = useState<boolean>(() =>
    getPref("analyticsConsentDecided"),
  );

  useEffect(() => {
    const sync = () => {
      setDecided(getPref("analyticsConsentDecided"));
    };
    window.addEventListener(PREFS_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener(PREFS_CHANGED_EVENT, sync);
    };
  }, []);

  if (decided) {
    return null;
  }

  const handleAccept = () => {
    setPref("analyticsConsent", true);
    setPref("analyticsConsentDecided", true);
    setDecided(true);
  };

  const handleDecline = () => {
    setPref("analyticsConsent", false);
    setPref("analyticsConsentDecided", true);
    analytics.clearQueue();
    setDecided(true);
  };

  return (
    <aside
      role="region"
      aria-label="Analytics consent"
      className="consent-banner no-print"
      style={{
        position: "fixed",
        bottom: "1rem",
        left: "1rem",
        right: "1rem",
        maxWidth: "34rem",
        zIndex: 40,
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        padding: "1rem 1.25rem",
        borderRadius: "12px",
        background: "var(--surface, #141923)",
        color: "var(--text, #f5f7fb)",
        border: "1px solid var(--border, rgba(255, 255, 255, 0.12))",
        boxShadow: "var(--shadow, 0 12px 32px rgba(0, 0, 0, 0.35))",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <strong style={{ fontSize: "0.95rem" }}>Privacy-first analytics</strong>
        <p
          style={{
            margin: 0,
            fontSize: "0.85rem",
            color: "var(--muted, #9aa4b2)",
            lineHeight: 1.45,
          }}
        >
          Help us improve Callora with anonymous route and deposit-funnel
          metrics. We never collect wallet addresses, amounts, tokens, or
          transaction hashes.
        </p>
      </div>
      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
        <button
          type="button"
          className="ghost-button"
          onClick={handleDecline}
        >
          Decline
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={handleAccept}
        >
          Accept
        </button>
      </div>
    </aside>
  );
}

/**
 * Header/settings toggle that reads and writes `analyticsConsent` via `setPref`.
 */
export function AnalyticsToggle() {
  const [enabled, setEnabled] = useState<boolean>(() =>
    getPref("analyticsConsent"),
  );

  useEffect(() => {
    const sync = () => {
      setEnabled(getPref("analyticsConsent"));
    };
    window.addEventListener(PREFS_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener(PREFS_CHANGED_EVENT, sync);
    };
  }, []);

  const handleToggle = () => {
    const next = !enabled;
    setPref("analyticsConsent", next);
    setPref("analyticsConsentDecided", true);
    if (!next) {
      analytics.clearQueue();
    }
    setEnabled(next);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label="Analytics"
      title={enabled ? "Analytics enabled (click to disable)" : "Analytics disabled (click to enable)"}
      className="ghost-button analytics-toggle"
      onClick={handleToggle}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.4rem",
        fontSize: "0.8rem",
        padding: "0.35rem 0.65rem",
      }}
    >
      <span>Analytics</span>
      <span
        aria-hidden="true"
        style={{
          fontSize: "0.72rem",
          fontWeight: 600,
          opacity: 0.85,
        }}
      >
        {enabled ? "On" : "Off"}
      </span>
    </button>
  );
}

export default ConsentBanner;
