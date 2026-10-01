import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import LiveRegion from "../components/LiveRegion";
import StatusBadge from "../components/StatusBadge";
import TokenEditor from "../components/TokenEditor";
import useCopy from "../hooks/useCopy";
import useDocumentTitle from "../hooks/useDocumentTitle";
import {
  evaluateContrastPair,
  type ContrastCheckResult,
} from "../utils/contrast";

/** How long (ms) the copy/download status stays visible before clearing. */
const STATUS_DURATION_MS = 2_000;

const DEFAULT_TOKENS = {
  primary: "#4e85ff",
  accent: "#1ed6a4",
  surface: "#0f172a",
};

type TokenKey = keyof typeof DEFAULT_TOKENS;

/**
 * Foreground used by the preview cards. The playground only exposes the
 * primary / accent / surface triple, so "text on surface" is measured against
 * the fixed preview text colour rather than against an editable token.
 */
const PREVIEW_TEXT_COLOR = "#ffffff";

export default function ThemePlayground() {
  useDocumentTitle('Theme Playground');
  const [tokens, setTokens] = useState(DEFAULT_TOKENS);
  const { copied, handleCopy } = useCopy();
  // Set when a copy attempt is rejected (clipboard unavailable/denied);
  // cleared on the next successful copy so the download fallback stays
  // offered while the clipboard is unusable.
  const [copyFailed, setCopyFailed] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-clear the status message; cancelled on unmount to avoid updates
  // on an unmounted component.
  useEffect(() => {
    return () => {
      if (statusTimerRef.current !== null) {
        clearTimeout(statusTimerRef.current);
        statusTimerRef.current = null;
      }
    };
  }, []);

  const scheduleStatusClear = () => {
    if (statusTimerRef.current !== null) {
      clearTimeout(statusTimerRef.current);
    }
    statusTimerRef.current = setTimeout(() => {
      setAnnouncement("");
      statusTimerRef.current = null;
    }, STATUS_DURATION_MS);
  };

  const [exportWarning, setExportWarning] = useState<string | null>(null);

  // The two readability pairs the exported palette must satisfy. Ratios are
  // computed with the shared `contrast.ts` helpers so the playground and the
  // automated WCAG suites cannot drift apart.
  const contrastChecks: ContrastCheckResult[] = useMemo(
    () => [
      evaluateContrastPair(
        "text-on-surface",
        "Text on surface",
        PREVIEW_TEXT_COLOR,
        tokens.surface,
      ),
      evaluateContrastPair(
        "accent-on-surface",
        "Accent on surface",
        tokens.accent,
        tokens.surface,
      ),
    ],
    [tokens.surface, tokens.accent],
  );

  const cssPreview = useMemo(
    () =>
      [
        ":root {",
        `  --theme-primary: ${tokens.primary};`,
        `  --theme-accent: ${tokens.accent};`,
        `  --theme-surface: ${tokens.surface};`,
        "}",
      ].join("\n"),
    [tokens],
  );

  const previewStyle = useMemo(
    () =>
      ({
        "--theme-primary": tokens.primary,
        "--theme-accent": tokens.accent,
        "--theme-surface": tokens.surface,
      }) as CSSProperties,
    [tokens],
  );

  const handleTokenChange = (key: TokenKey, value: string) => {
    // A stale warning would be misleading once a token changes.
    setExportWarning(null);
    setTokens((current) => ({ ...current, [key]: value }));
  };

  const resetTokens = () => {
    setExportWarning(null);
    setTokens(DEFAULT_TOKENS);
  };

  const exportCss = async () => {
    const failing = contrastChecks.filter((check) => !check.passes);

    // Warn, never block: a designer may deliberately export a work-in-progress
    // palette, but they should not do it without knowing it fails AA.
    setExportWarning(
      failing.length === 0
        ? null
        : `Exported palette fails WCAG AA for: ${failing
            .map((check) => check.label)
            .join(", ")}.`,
    );

    const success = await handleCopy(cssPreview);

    if (success) {
      setCopyFailed(false);
      setAnnouncement("Theme CSS copied to clipboard");
      scheduleStatusClear();
    } else {
      setCopyFailed(true);
      setAnnouncement(
        "Copying to the clipboard failed. Use the Download .css button instead.",
      );
      scheduleStatusClear();
    }
  };

  const downloadCss = () => {
    // Anchor click + Blob keeps the export fully client-side (no network, no
    // third-party involvement); the object URL is revoked immediately after
    // the click is dispatched.
    const url = URL.createObjectURL(
      new Blob([cssPreview], { type: "text/css" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "callora-theme.css";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    setAnnouncement("Theme CSS downloaded as callora-theme.css");
    scheduleStatusClear();
  };

  return (
    <section className="theme-playground surface" style={previewStyle}>
      <div className="theme-playground__header">
        <div>
          <p className="eyebrow">Theme playground</p>
          <h1>Theme playground</h1>
          <p className="theme-playground__copy">
            Adjust the core color tokens and preview how the UI responds in real
            time.
          </p>
        </div>
        <div className="theme-playground__actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => void exportCss()}
            aria-label={copied ? "Export CSS — copied" : undefined}
          >
            {copied ? "Copied" : "Export CSS"}
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={resetTokens}
          >
            Reset to defaults
          </button>
        </div>
      </div>

      {exportWarning && (
        <p
          className="theme-playground__export-warning"
          data-testid="contrast-export-warning"
          role="status"
        >
          {exportWarning}
        </p>
      )}

      {/* Announces copy success/failure and download outcomes to screen
          readers (WCAG 2.1 SC 4.1.3). */}
      <LiveRegion
        message={announcement}
        assertive={copyFailed}
      />

      {copyFailed && (
        <p className="theme-playground__export-error" role="alert">
          Couldn't copy to your clipboard. Use the{' '}
          <button
            className="theme-playground__download-btn"
            type="button"
            onClick={downloadCss}
          >
            Download .css
          </button>{' '}
          fallback instead.
        </p>
      )}

      <div className="theme-playground__layout">
        <div
          className="theme-playground__editor"
          aria-label="Theme token editor"
        >
          <TokenEditor
            label="Primary"
            tokenKey="primary"
            value={tokens.primary}
            onChange={(value) => handleTokenChange("primary", value)}
          />
          <TokenEditor
            label="Accent"
            tokenKey="accent"
            value={tokens.accent}
            onChange={(value) => handleTokenChange("accent", value)}
            contrast={contrastChecks[1]}
          />
          <TokenEditor
            label="Surface"
            tokenKey="surface"
            value={tokens.surface}
            onChange={(value) => handleTokenChange("surface", value)}
            contrast={contrastChecks[0]}
          />
        </div>

        <div className="theme-playground__preview" aria-label="Theme preview">
          <div className="theme-playground__card">
            <div className="theme-playground__card-header">
              <span className="theme-playground__pill">Preview</span>
              <span className="theme-playground__pill theme-playground__pill--muted">
                Live
              </span>
            </div>
            <h2>GrantFox campaign concept</h2>
            <p>
              Use this sandbox to tune a new visual direction while preserving
              accessible contrast.
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem",
                marginBottom: "1rem",
              }}
            >
              <StatusBadge status="operational" label="Live" />
              <StatusBadge status="warning" label="Needs review" />
              <StatusBadge status="error" label="Blocked" />
            </div>
            <div className="theme-playground__actions-inline">
              <button
                className="primary-button"
                type="button"
                aria-label="Preview action"
                style={{
                  backgroundColor: tokens.primary,
                  borderColor: tokens.primary,
                }}
              >
                Preview action
              </button>
              <button
                className="secondary-button"
                type="button"
                style={{ borderColor: tokens.accent, color: tokens.accent }}
              >
                Secondary action
              </button>
            </div>
          </div>

          <div className="theme-playground__card theme-playground__card--compact">
            <h3>Suggested usage</h3>
            <ul>
              <li>Primary color for core buttons</li>
              <li>Accent color for highlights and status</li>
              <li>Surface color for panels and cards</li>
            </ul>
          </div>

          <pre className="theme-playground__css-preview">{cssPreview}</pre>

          <Link className="theme-playground__link" to="/dashboard">
            Go back to dashboard
          </Link>
        </div>
      </div>
    </section>
  );
}
