import { useState } from "react";
import { isSensitiveKey } from "../utils/snapshotUrl";

/**
 * TestInBrowser
 *
 * Renders a one-click inline test runner affordance for a single API endpoint.
 * Clicking "Test in browser" expands a panel where the user can fill in query
 * parameters and fire a live GET/POST request directly from the page.
 *
 * Accessibility: the trigger button has an aria-expanded attribute and the
 * panel is labelled via aria-labelledby so it is announced correctly by
 * screen readers (WCAG 2.1 AA).
 *
 * SECURITY: parameter inputs whose names look like credentials (API keys,
 * tokens, passwords, etc.) are rendered as password-type inputs so the values
 * are masked in the UI and excluded from browser autocomplete suggestions.
 * This prevents secrets from being visible on screen, saved by the browser,
 * or leaked via shoulder-surfing.
 */
import { useApiCache } from "../hooks/useApiCache";

export interface EndpointParam {
  name: string;
  type: string;
  required: boolean;
}

export interface TestInBrowserProps {
  /** Full URL of the endpoint, e.g. "https://api.example.com/v1/forecast" */
  endpointUrl: string;
  /** HTTP method, e.g. "GET" */
  method: string;
  /** List of query / body parameters for this endpoint */
  params?: EndpointParam[];
}

interface RunResult {
  status: number;
  body: string;
}

export default function TestInBrowser({
  endpointUrl,
  method,
  params = [],
}: TestInBrowserProps) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { get, set } = useApiCache<RunResult>();

  const panelId = `tib-panel-${endpointUrl.replace(/[^a-z0-9]/gi, "-")}`;
  const triggerId = `tib-trigger-${endpointUrl.replace(/[^a-z0-9]/gi, "-")}`;
  const cacheKey = `${method}:${endpointUrl}`;

  function handleChange(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function handleRun() {
    setRunning(true);
    setResult(null);
    setError(null);

    try {
      let url = endpointUrl;
      let fetchInit: RequestInit = { method };

      if (method.toUpperCase() === "GET" || method.toUpperCase() === "DELETE") {
        const qs = new URLSearchParams(
          Object.entries(values).filter(([, v]) => v !== ""),
        ).toString();
        if (qs) url += (url.includes("?") ? "&" : "?") + qs;
      } else {
        fetchInit.headers = { "Content-Type": "application/json" };
        fetchInit.body = JSON.stringify(
          Object.fromEntries(Object.entries(values).filter(([, v]) => v !== "")),
        );
      }

      const isCacheable = method.toUpperCase() === "GET";
      const cached = isCacheable ? get(cacheKey) : null;
      if (cached) {
        setResult(cached);
        return;
      }

      const response = await fetch(url, fetchInit);
      const text = await response.text();
      let body: string;
      try {
        body = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        body = text;
      }
      const runResult: RunResult = { status: response.status, body };
      setResult(runResult);
      if (isCacheable) {
        set(cacheKey, runResult);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="tib-root" style={{ marginTop: 12 }}>
      {/* Trigger button */}
      <button
        id={triggerId}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        className="ghost-button tib-trigger"
        onClick={() => {
          setOpen((o) => !o);
          setResult(null);
          setError(null);
        }}
        style={{
          fontSize: 13,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {/* Play icon */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 7l6 3-6 3V7z" fill="currentColor" />
        </svg>
        {open ? "Close test runner" : "Test in browser"}
      </button>

      {/* Inline test panel */}
      {open && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={triggerId}
          className="tib-panel"
          style={{
            marginTop: 12,
            padding: 16,
            borderRadius: 8,
            border: "1px solid var(--border-subtle)",
            background: "var(--bg-subtle)",
          }}
        >
          <p
            style={{
              margin: "0 0 12px 0",
              fontSize: 12,
              color: "var(--muted)",
            }}
          >
            Fill in parameters below, then click <strong>Run</strong> to send a
            live request from your browser.
          </p>

          {/* Parameter inputs */}
          {params.length > 0 ? (
            <div
              style={{ display: "grid", gap: 10, marginBottom: 14 }}
              aria-label="Endpoint parameters"
            >
              {params.map((p) => {
                // Mask inputs whose parameter name looks like a credential so
                // the value is hidden in the UI and not offered by browser
                // autocomplete.  Uses the same pattern list as snapshotUrl so
                // the masking and redaction logic stay in sync.
                const sensitive = isSensitiveKey(p.name);
                return (
                <label
                  key={p.name}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 2fr",
                    gap: 8,
                    alignItems: "center",
                    fontSize: 13,
                  }}
                >
                  <span>
                    <code style={{ color: "var(--accent)" }}>{p.name}</code>
                    {p.required && (
                      <span
                        aria-label="required"
                        style={{ color: "#ef4444", marginLeft: 2 }}
                      >
                        *
                      </span>
                    )}
                    <span
                      style={{
                        display: "block",
                        fontSize: 11,
                        color: "var(--muted)",
                      }}
                    >
                      {p.type}
                      {sensitive && (
                        <span
                          aria-label="sensitive — value will be masked"
                          style={{ marginLeft: 4, color: "var(--warning, #f59e0b)" }}
                          title="This parameter looks like a credential and will be masked"
                        >
                          🔒
                        </span>
                      )}
                    </span>
                  </span>
                  <input
                    type={sensitive ? "password" : "text"}
                    placeholder={p.required ? "Required" : "Optional"}
                    value={values[p.name] ?? ""}
                    onChange={(e) => handleChange(p.name, e.target.value)}
                    aria-label={`${p.name} parameter value${sensitive ? " (sensitive — masked)" : ""}`}
                    autoComplete={sensitive ? "new-password" : "off"}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: "1px solid var(--border-subtle)",
                      background: "var(--bg-card, #fff)",
                      color: "var(--text-main)",
                      fontSize: 13,
                    }}
                  />
                </label>
                );
              })}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
              No parameters defined for this endpoint.
            </p>
          )}

          {/* Run button */}
          <button
            type="button"
            className="primary-button tib-run"
            onClick={handleRun}
            disabled={running}
            style={{ fontSize: 13 }}
            aria-busy={running}
          >
            {running ? "Running…" : "Run"}
          </button>

          {/* Error */}
          {error && (
            <div
              role="alert"
              style={{
                marginTop: 12,
                padding: "10px 14px",
                borderRadius: 6,
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "#ef4444",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          {/* Response */}
          {result && (
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background:
                      result.status >= 200 && result.status < 300
                        ? "rgba(16,185,129,0.12)"
                        : "rgba(239,68,68,0.12)",
                    color:
                      result.status >= 200 && result.status < 300
                        ? "#10b981"
                        : "#ef4444",
                    border:
                      result.status >= 200 && result.status < 300
                        ? "1px solid rgba(16,185,129,0.3)"
                        : "1px solid rgba(239,68,68,0.3)",
                  }}
                  aria-label={`HTTP status ${result.status}`}
                >
                  {result.status}
                </span>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  Response
                </span>
              </div>
              <pre
                aria-label="Response body"
                style={{
                  margin: 0,
                  padding: "12px 14px",
                  borderRadius: 6,
                  background: "var(--bg-code, #0f172a)",
                  color: "var(--text-code, #e2e8f0)",
                  fontSize: 12,
                  overflowX: "auto",
                  maxHeight: 240,
                  overflowY: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {result.body || "(empty response)"}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
