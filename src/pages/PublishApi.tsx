import { useCallback, useId, useState } from 'react';
import OpenAPIImport from '../components/OpenAPIImport';
import type { ParsedEndpoint } from '../components/OpenAPIImport';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EndpointEntry = ParsedEndpoint & {
  /** Stable key for React lists. */
  id: string;
};

type PublishFormState = {
  apiName: string;
  baseUrl: string;
  description: string;
  pricePerCall: string;
  endpoints: EndpointEntry[];
};

const INITIAL_FORM: PublishFormState = {
  apiName: '',
  baseUrl: '',
  description: '',
  pricePerCall: '',
  endpoints: [],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _idSeq = 0;
function nextId() {
  _idSeq += 1;
  return `ep-${_idSeq}`;
}

function methodBadgeClass(method: string): string {
  const m = method.toLowerCase();
  if (m === 'get') return 'pa-badge pa-badge-get';
  if (m === 'post') return 'pa-badge pa-badge-post';
  if (m === 'put') return 'pa-badge pa-badge-put';
  if (m === 'delete') return 'pa-badge pa-badge-delete';
  if (m === 'patch') return 'pa-badge pa-badge-patch';
  return 'pa-badge pa-badge-default';
}

// ---------------------------------------------------------------------------
// PublishApi page
// ---------------------------------------------------------------------------

/**
 * PublishApi — publish flow page for Callora.
 *
 * Lets developers describe and publish an API on the marketplace.
 * Includes an OpenAPI import section that pre-populates the endpoint list
 * without altering any other publish-flow behaviour or auto-submitting.
 */
export default function PublishApi() {
  const [form, setForm] = useState<PublishFormState>(INITIAL_FORM);
  const [importOpen, setImportOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const importSectionId = useId();

  // ── Form field handlers ────────────────────────────────────────────────

  const handleField = useCallback(
    (field: keyof Omit<PublishFormState, 'endpoints'>) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
      },
    [],
  );

  // ── OpenAPI import handlers ────────────────────────────────────────────

  const handleImport = useCallback((endpoints: ParsedEndpoint[]) => {
    const entries: EndpointEntry[] = endpoints.map((ep) => ({
      ...ep,
      id: nextId(),
    }));

    setForm((prev) => ({
      ...prev,
      // Merge: replace the endpoint list with imported endpoints (preserves
      // any manually added endpoints already in the list).
      endpoints: [...prev.endpoints, ...entries],
    }));

    setImportOpen(false);
  }, []);

  const handleRemoveEndpoint = useCallback((id: string) => {
    setForm((prev) => ({
      ...prev,
      endpoints: prev.endpoints.filter((ep) => ep.id !== id),
    }));
  }, []);

  // ── Submit ─────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setSubmitted(true);
    },
    [],
  );

  // ── Success screen ─────────────────────────────────────────────────────

  if (submitted) {
    return (
      <>
        <style>{STYLES}</style>
        <div className="pa-shell">
          <div className="pa-success surface" role="alert" aria-live="polite">
            <span className="pa-success-icon" aria-hidden="true">🎉</span>
            <h1 className="pa-success-title">API submitted for review</h1>
            <p className="pa-success-body">
              <strong>{form.apiName || 'Your API'}</strong> has been submitted and is
              pending review. You&apos;ll receive a notification once it&apos;s live on
              the marketplace.
            </p>
            <button
              type="button"
              className="pa-btn-primary"
              onClick={() => {
                setForm(INITIAL_FORM);
                setSubmitted(false);
                setImportOpen(false);
              }}
            >
              Publish another API
            </button>
          </div>
        </div>
      </>
    );
  }

  // ── Main form ──────────────────────────────────────────────────────────

  return (
    <>
      <style>{STYLES}</style>
      <div className="pa-shell">
        <header className="pa-page-header">
          <p className="pa-eyebrow">Developer tools</p>
          <h1 className="pa-title">Publish your API</h1>
          <p className="pa-subtitle">
            List your API on the Callora marketplace with per-request USDC pricing.
            Fill in the details below, optionally import endpoints from an OpenAPI
            spec, then submit for review.
          </p>
        </header>

        {/* ── OpenAPI import toggle ──────────────────────────────── */}
        <section className="pa-import-section surface" aria-labelledby={importSectionId}>
          <div className="pa-import-header">
            <div>
              <h2 id={importSectionId} className="pa-section-title">
                Import from OpenAPI spec
              </h2>
              <p className="pa-section-hint">
                Upload a <code>.json</code>, <code>.yaml</code>, or{' '}
                <code>.yml</code> file to pre-fill the endpoint list.
              </p>
            </div>
            <button
              type="button"
              className={importOpen ? 'pa-btn-secondary' : 'pa-btn-accent'}
              aria-expanded={importOpen}
              aria-controls={`${importSectionId}-body`}
              onClick={() => setImportOpen((o) => !o)}
            >
              {importOpen ? 'Close importer' : 'Import spec'}
            </button>
          </div>

          {importOpen && (
            <div id={`${importSectionId}-body`} className="pa-import-body">
              <OpenAPIImport
                onImport={handleImport}
                onCancel={() => setImportOpen(false)}
              />
            </div>
          )}
        </section>

        {/* ── Publish form ───────────────────────────────────────── */}
        <form
          className="pa-form surface"
          onSubmit={handleSubmit}
          noValidate
          aria-label="Publish API form"
        >
          <fieldset className="pa-fieldset">
            <legend className="pa-legend">API details</legend>

            <div className="pa-field">
              <label className="pa-label" htmlFor="pa-api-name">
                API name <span aria-hidden="true">*</span>
              </label>
              <input
                id="pa-api-name"
                type="text"
                className="pa-input"
                value={form.apiName}
                onChange={handleField('apiName')}
                placeholder="e.g. Weather Forecast API"
                required
                aria-required="true"
              />
            </div>

            <div className="pa-field">
              <label className="pa-label" htmlFor="pa-base-url">
                Base URL <span aria-hidden="true">*</span>
              </label>
              <input
                id="pa-base-url"
                type="url"
                className="pa-input"
                value={form.baseUrl}
                onChange={handleField('baseUrl')}
                placeholder="https://api.example.com"
                required
                aria-required="true"
              />
            </div>

            <div className="pa-field">
              <label className="pa-label" htmlFor="pa-price">
                Price per call (USDC)
              </label>
              <input
                id="pa-price"
                type="text"
                inputMode="decimal"
                className="pa-input pa-input-narrow"
                value={form.pricePerCall}
                onChange={handleField('pricePerCall')}
                placeholder="0.001"
                aria-describedby="pa-price-hint"
              />
              <p id="pa-price-hint" className="pa-field-hint">
                Charged per successful API call. Leave blank to set later.
              </p>
            </div>

            <div className="pa-field">
              <label className="pa-label" htmlFor="pa-description">
                Description
              </label>
              <textarea
                id="pa-description"
                className="pa-textarea"
                value={form.description}
                onChange={handleField('description')}
                placeholder="Describe what your API does, its use cases, and any notable constraints."
                rows={4}
              />
            </div>
          </fieldset>

          {/* ── Endpoint list ────────────────────────────────────── */}
          <fieldset className="pa-fieldset">
            <legend className="pa-legend">
              Endpoints
              {form.endpoints.length > 0 && (
                <span className="pa-legend-count" aria-label={`${form.endpoints.length} endpoints`}>
                  {form.endpoints.length}
                </span>
              )}
            </legend>

            {form.endpoints.length === 0 ? (
              <p className="pa-endpoints-empty">
                No endpoints added yet. Use &ldquo;Import spec&rdquo; above to populate
                this list automatically.
              </p>
            ) : (
              <ul
                className="pa-endpoint-list"
                aria-label={`${form.endpoints.length} imported endpoints`}
              >
                {form.endpoints.map((ep) => (
                  <li key={ep.id} className="pa-endpoint-item">
                    <span
                      className={methodBadgeClass(ep.method)}
                      aria-label={`HTTP ${ep.method}`}
                    >
                      {ep.method}
                    </span>
                    <code className="pa-endpoint-path">{ep.path}</code>
                    {ep.summary && (
                      <span className="pa-endpoint-summary">{ep.summary}</span>
                    )}
                    <button
                      type="button"
                      className="pa-remove-btn"
                      onClick={() => handleRemoveEndpoint(ep.id)}
                      aria-label={`Remove endpoint ${ep.method} ${ep.path}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>

          <div className="pa-form-footer">
            <button
              type="submit"
              className="pa-btn-primary"
              disabled={!form.apiName.trim() || !form.baseUrl.trim()}
            >
              Publish API
            </button>
            <p className="pa-form-note">
              Submission is reviewed before going live. API name and base URL are
              required.
            </p>
          </div>
        </form>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const STYLES = `
  .pa-shell {
    max-width: 760px;
    margin: 0 auto;
    display: grid;
    gap: 24px;
    padding: 8px 0 48px;
  }

  .pa-page-header {
    padding: 0 4px;
  }

  .pa-eyebrow {
    margin: 0 0 8px;
    font-size: 0.72rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--accent-strong, #1ed6a4);
  }

  .pa-title {
    margin: 0 0 12px;
    font-size: clamp(1.8rem, 3vw, 2.4rem);
    font-weight: 700;
    line-height: 1.1;
    color: var(--text, #f3f5fb);
  }

  .pa-subtitle {
    margin: 0;
    font-size: 1rem;
    color: var(--muted, #93a0bf);
    line-height: 1.65;
    max-width: 600px;
  }

  /* ── Import section ─────────────────────────────────────────────────── */

  .pa-import-section {
    padding: 22px 24px;
  }

  .pa-import-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .pa-section-title {
    margin: 0 0 4px;
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--text, #f3f5fb);
  }

  .pa-section-hint {
    margin: 0;
    font-size: 0.875rem;
    color: var(--muted, #93a0bf);
  }

  .pa-section-hint code {
    font-size: 0.82rem;
    padding: 1px 4px;
    border-radius: 4px;
    background: var(--surface-soft, rgba(255,255,255,0.06));
    border: 1px solid var(--line, rgba(169,184,255,0.16));
    color: var(--accent, #4e85ff);
  }

  .pa-import-body {
    margin-top: 20px;
  }

  /* ── Form ───────────────────────────────────────────────────────────── */

  .pa-form {
    padding: 28px 24px;
    display: grid;
    gap: 28px;
  }

  .pa-fieldset {
    border: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 18px;
  }

  .pa-legend {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 4px;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--muted, #93a0bf);
    padding-bottom: 10px;
    border-bottom: 1px solid var(--line, rgba(169,184,255,0.16));
    width: 100%;
  }

  .pa-legend-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    border-radius: 999px;
    background: rgba(78, 133, 255, 0.18);
    color: var(--accent, #4e85ff);
    font-size: 0.72rem;
    font-weight: 700;
  }

  .pa-field {
    display: grid;
    gap: 6px;
  }

  .pa-label {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--text, #f3f5fb);
  }

  .pa-label span {
    color: var(--danger, #ff7d8d);
    margin-left: 2px;
  }

  .pa-input,
  .pa-textarea {
    min-height: 46px;
    padding: 10px 14px;
    border-radius: 12px;
    border: 1px solid var(--line, rgba(169,184,255,0.16));
    background: var(--surface-soft, rgba(255,255,255,0.04));
    color: var(--text, #f3f5fb);
    font-size: 0.95rem;
    font-family: inherit;
    resize: vertical;
    transition: border-color 180ms ease, box-shadow 180ms ease;
  }

  .pa-input::placeholder,
  .pa-textarea::placeholder {
    color: var(--muted, #93a0bf);
  }

  .pa-input:focus-visible,
  .pa-textarea:focus-visible {
    outline: 2px solid var(--accent, #4e85ff);
    outline-offset: 0;
    box-shadow: var(--focus-ring, 0 0 0 3px rgba(78,133,255,0.55));
    border-color: var(--accent, #4e85ff);
  }

  .pa-input-narrow {
    max-width: 200px;
  }

  .pa-textarea {
    min-height: 110px;
  }

  .pa-field-hint {
    margin: 0;
    font-size: 0.82rem;
    color: var(--muted, #93a0bf);
  }

  /* ── Endpoint list in form ──────────────────────────────────────────── */

  .pa-endpoints-empty {
    padding: 16px;
    margin: 0;
    font-size: 0.9rem;
    color: var(--muted, #93a0bf);
    border: 1px dashed var(--line, rgba(169,184,255,0.16));
    border-radius: 10px;
    text-align: center;
  }

  .pa-endpoint-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 6px;
  }

  .pa-endpoint-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-radius: 10px;
    border: 1px solid var(--line, rgba(169,184,255,0.12));
    background: var(--surface-soft, rgba(255,255,255,0.03));
    font-size: 0.88rem;
    transition: background 120ms ease;
  }

  .pa-endpoint-item:hover {
    background: rgba(78,133,255,0.05);
  }

  .pa-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 62px;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    flex-shrink: 0;
    border: 1px solid transparent;
  }

  .pa-badge-get    { background: var(--method-get-bg); color: var(--method-get-color); border-color: var(--method-get-border); }
  .pa-badge-post   { background: var(--method-post-bg); color: var(--method-post-color); border-color: var(--method-post-border); }
  .pa-badge-put    { background: var(--method-put-bg); color: var(--method-put-color); border-color: var(--method-put-border); }
  .pa-badge-delete { background: var(--method-delete-bg); color: var(--method-delete-color); border-color: var(--method-delete-border); }
  .pa-badge-patch  { background: var(--method-patch-bg); color: var(--method-patch-color); border-color: var(--method-patch-border); }
  .pa-badge-default { background: var(--surface-soft); color: var(--muted); border-color: var(--line); }

  .pa-endpoint-path {
    font-family: monospace;
    font-size: 0.85rem;
    color: var(--text, #f3f5fb);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .pa-endpoint-summary {
    font-size: 0.82rem;
    color: var(--muted, #93a0bf);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .pa-remove-btn {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--muted, #93a0bf);
    font-size: 0.8rem;
    cursor: pointer;
    margin-left: auto;
    transition: background 120ms ease, color 120ms ease;
  }

  .pa-remove-btn:hover {
    background: rgba(255,125,141,0.12);
    color: var(--danger, #ff7d8d);
    border-color: rgba(255,125,141,0.2);
  }

  .pa-remove-btn:focus-visible {
    outline: 2px solid var(--accent, #4e85ff);
    outline-offset: 2px;
    box-shadow: var(--focus-ring, 0 0 0 3px rgba(78,133,255,0.55));
  }

  /* ── Form footer ────────────────────────────────────────────────────── */

  .pa-form-footer {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    padding-top: 4px;
  }

  .pa-form-note {
    margin: 0;
    font-size: 0.82rem;
    color: var(--muted, #93a0bf);
  }

  /* ── Buttons ────────────────────────────────────────────────────────── */

  .pa-btn-primary,
  .pa-btn-secondary,
  .pa-btn-accent {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 22px;
    border-radius: 12px;
    font-size: 0.95rem;
    font-weight: 700;
    cursor: pointer;
    border: 1px solid transparent;
    transition: transform 180ms ease, opacity 180ms ease, background 180ms ease;
    white-space: nowrap;
  }

  .pa-btn-primary {
    background: linear-gradient(135deg, #4e85ff, #6da6ff);
    color: #ffffff;
  }

  .pa-btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  .pa-btn-primary:not(:disabled):hover,
  .pa-btn-primary:not(:disabled):focus-visible {
    transform: translateY(-1px);
    opacity: 0.92;
  }

  .pa-btn-primary:focus-visible,
  .pa-btn-secondary:focus-visible,
  .pa-btn-accent:focus-visible {
    outline: 2px solid var(--accent, #4e85ff);
    outline-offset: 2px;
    box-shadow: var(--focus-ring, 0 0 0 3px rgba(78,133,255,0.55));
  }

  .pa-btn-secondary {
    background: var(--surface-soft, rgba(255,255,255,0.06));
    color: var(--text, #f3f5fb);
    border-color: var(--line, rgba(169,184,255,0.16));
  }

  .pa-btn-secondary:hover {
    background: var(--line, rgba(169,184,255,0.16));
    transform: translateY(-1px);
  }

  .pa-btn-accent {
    background: rgba(78, 133, 255, 0.14);
    color: var(--accent, #4e85ff);
    border-color: rgba(78, 133, 255, 0.3);
  }

  .pa-btn-accent:hover {
    background: rgba(78, 133, 255, 0.24);
    transform: translateY(-1px);
  }

  /* ── Success screen ─────────────────────────────────────────────────── */

  .pa-success {
    max-width: 520px;
    margin: 48px auto;
    padding: 36px 32px;
    text-align: center;
    display: grid;
    gap: 16px;
    place-items: center;
  }

  .pa-success-icon {
    font-size: 2.5rem;
  }

  .pa-success-title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text, #f3f5fb);
  }

  .pa-success-body {
    margin: 0;
    font-size: 0.95rem;
    color: var(--muted, #93a0bf);
    line-height: 1.6;
  }

  /* ── Responsive ─────────────────────────────────────────────────────── */

  @media (max-width: 600px) {
    .pa-shell {
      padding: 4px 0 32px;
    }

    .pa-import-header {
      flex-direction: column;
    }

    .pa-form {
      padding: 20px 16px;
    }

    .pa-import-section {
      padding: 18px 16px;
    }

    .pa-endpoint-item {
      flex-wrap: wrap;
    }

    .pa-endpoint-path,
    .pa-endpoint-summary {
      flex: 1 1 100%;
    }

    .pa-form-footer {
      flex-direction: column;
      align-items: flex-start;
    }

    .pa-btn-primary {
      width: 100%;
    }
  }
`;
