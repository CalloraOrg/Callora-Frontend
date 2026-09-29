import { useCallback, useEffect, useId, useRef, useState } from 'react';
import OpenAPIImport from '../components/OpenAPIImport';
import type { ParsedEndpoint } from '../components/OpenAPIImport';
import FormField from '../components/FormField';
import type { FieldStatus } from '../components/FormField';
import SessionExpiryBanner from '../components/SessionExpiryBanner';
import useDocumentTitle from '../hooks/useDocumentTitle';
import useFormPersistence from '../hooks/useFormPersistence';
import useSessionExpiry from '../hooks/useSessionExpiry';
import { generateIdempotencyKey } from '../services/idempotency';
import { submitPublishApi } from '../services/publishApi';
import type { PublishApiFieldErrors, PublishApiInput } from '../services/publishApi';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EndpointEntry = ParsedEndpoint & {
  id: string;
};

type PublishFormState = {
  apiName: string;
  baseUrl: string;
  category: string;
  description: string;
  pricePerCall: string;
  endpoints: EndpointEntry[];
};

type ValidatedFields = Exclude<keyof PublishFormState, 'description' | 'endpoints'>;

type TouchedState = Record<ValidatedFields, boolean>;

type ValidationErrors = Partial<Record<ValidatedFields, string>>;

const INITIAL_FORM: PublishFormState = {
  apiName: '',
  baseUrl: '',
  category: '',
  description: '',
  pricePerCall: '',
  endpoints: [],
};

const INITIAL_TOUCHED: TouchedState = {
  apiName: false,
  baseUrl: false,
  category: false,
  pricePerCall: false,
};

const CATEGORIES = [
  'AI & Machine Learning',
  'Data & Analytics',
  'Finance & Payments',
  'Weather & Environment',
  'Mapping & Location',
  'Communication',
  'Security',
  'Other',
];

/** localStorage key holding the in-progress publish draft. */
const DRAFT_STORAGE_KEY = 'callora:publish-api:draft';

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

function validateForm(form: PublishFormState): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!form.apiName.trim()) {
    errors.apiName = 'API name is required.';
  }

  if (!form.baseUrl.trim()) {
    errors.baseUrl = 'Base URL is required.';
  } else {
    try {
      const parsed = new URL(form.baseUrl);
      if (parsed.protocol !== 'https:') {
        errors.baseUrl = 'Base URL must use the https scheme.';
      }
    } catch {
      errors.baseUrl = 'Enter a valid URL (e.g. https://api.example.com).';
    }
  }

  if (!form.category) {
    errors.category = 'Please select a category.';
  }

  if (form.pricePerCall.trim() !== '') {
    const price = Number(form.pricePerCall);
    if (!Number.isFinite(price) || price < 0) {
      errors.pricePerCall = 'Price per call must be 0 or greater.';
    }
  }

  return errors;
}

function fieldStatus(
  field: ValidatedFields,
  errors: ValidationErrors,
  touched: TouchedState,
  submitAttempted: boolean,
): FieldStatus {
  const active = touched[field] || submitAttempted;
  if (!active) return 'idle';
  if (errors[field]) return 'error';
  return 'success';
}

// ---------------------------------------------------------------------------
// Draft persistence
// ---------------------------------------------------------------------------

/**
 * Shape guard for drafts restored from localStorage.
 *
 * A draft written by an older build may not match today's form shape, and
 * feeding that to the inputs would crash the page on the values alone (e.g.
 * `endpoints` no longer an array). Reject anything that does not look like a
 * `PublishFormState` and start blank instead.
 */
function isPublishFormDraft(candidate: unknown): candidate is PublishFormState {
  if (typeof candidate !== 'object' || candidate === null) return false;
  const draft = candidate as Record<string, unknown>;

  const stringFields = [
    'apiName',
    'baseUrl',
    'category',
    'description',
    'pricePerCall',
  ] as const;
  for (const field of stringFields) {
    if (typeof draft[field] !== 'string') return false;
  }

  if (!Array.isArray(draft.endpoints)) return false;
  return draft.endpoints.every((entry) => {
    if (typeof entry !== 'object' || entry === null) return false;
    const ep = entry as Record<string, unknown>;
    return typeof ep.id === 'string' && typeof ep.path === 'string' && typeof ep.method === 'string';
  });
}

// ---------------------------------------------------------------------------
// Server response mapping
// ---------------------------------------------------------------------------

/** Lowercase and strip separators so `base_url` matches `baseUrl`. */
function normalizeFieldKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Server field names -> form fields.
 *
 * The backend may speak snake_case while the form speaks camelCase, and it may
 * use a domain term where the form uses a UI one. Anything not listed here is
 * not silently dropped — see `toValidationErrors`.
 */
const FIELD_ALIASES: Record<string, ValidatedFields> = {
  apiname: 'apiName',
  name: 'apiName',
  title: 'apiName',
  displayname: 'apiName',
  baseurl: 'baseUrl',
  url: 'baseUrl',
  endpoint: 'baseUrl',
  homepage: 'baseUrl',
  category: 'category',
  pricepercall: 'pricePerCall',
  price: 'pricePerCall',
  pricing: 'pricePerCall',
};

/**
 * Map server field errors onto the form's `ValidationErrors` shape.
 *
 * Returns the mapped per-field messages plus any messages that had no
 * corresponding input, so the caller can surface them as a form-level error
 * instead of losing them.
 */
function toValidationErrors(fields: PublishApiFieldErrors): {
  mapped: ValidationErrors;
  unmapped: string[];
} {
  const mapped: ValidationErrors = {};
  const unmapped: string[] = [];

  for (const [key, message] of Object.entries(fields)) {
    const target = FIELD_ALIASES[normalizeFieldKey(key)];
    if (target) {
      // First message wins so a duplicate alias cannot overwrite itself.
      if (!mapped[target]) mapped[target] = message;
    } else {
      unmapped.push(message);
    }
  }

  return { mapped, unmapped };
}

// ---------------------------------------------------------------------------
// Payload shaping
// ---------------------------------------------------------------------------

/**
 * Build the request body from form state.
 *
 * UI-only fields (endpoint `id`) are stripped, strings are trimmed, and a blank
 * price becomes `null` rather than `0` so "set later" is distinguishable from
 * "free".
 */
function toPublishPayload(form: PublishFormState): PublishApiInput {
  const rawPrice = form.pricePerCall.trim();
  const parsedPrice = rawPrice === '' ? Number.NaN : Number(rawPrice);

  return {
    apiName: form.apiName.trim(),
    baseUrl: form.baseUrl.trim(),
    category: form.category,
    description: form.description,
    pricePerCall: Number.isFinite(parsedPrice) ? parsedPrice : null,
    endpoints: form.endpoints.map((ep) => ({
      path: ep.path,
      method: ep.method,
      ...(ep.summary ? { summary: ep.summary } : {}),
    })),
  };
}

// ---------------------------------------------------------------------------
// PublishApi page
// ---------------------------------------------------------------------------

/**
 * PublishApi — developer publish-flow page for Callora.
 *
 * Provides per-field inline validation (name, base URL, category, price per
 * call) with aria-invalid / aria-describedby wired for screen readers. Errors
 * appear only after a field is blurred or the form is submitted.
 *
 * Submitting actually POSTs the listing: the success screen is shown only
 * after the server accepts it, and the localStorage draft is kept until then
 * so a rejected submission never costs the provider their work.
 */
export default function PublishApi() {
  useDocumentTitle('Publish API');
  const { value: form, setValue: setForm, discard: discardDraft } = useFormPersistence(
    DRAFT_STORAGE_KEY,
    INITIAL_FORM,
    { isValid: isPublishFormDraft },
  );
  const [touched, setTouched] = useState<TouchedState>(INITIAL_TOUCHED);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /** Per-field messages returned by the server on the last attempt. */
  const [serverErrors, setServerErrors] = useState<ValidationErrors>({});
  /** Form-level failure that belongs to no single input. */
  const [formError, setFormError] = useState<string | null>(null);
  const [listingId, setListingId] = useState<string | null>(null);
  const importSectionId = useId();

  const { isExpired, dismiss: dismissExpiry } = useSessionExpiry();

  /**
   * Idempotency key for the current logical submission. Reused while the
   * payload is byte-identical, so a retry after a timeout cannot create a
   * second listing; regenerated as soon as the provider edits anything.
   */
  const idempotencyRef = useRef<{ serialized: string; key: string } | null>(null);

  /**
   * Authoritative in-flight flag.
   *
   * The `submitting` state below drives rendering, but state is not yet
   * updated when a second submit arrives in the same tick — two rapid clicks
   * would both read `false` from a stale closure and fire two POSTs. A ref
   * flips synchronously, so the second attempt is always rejected.
   */
  const submittingRef = useRef(false);

  // Never touch state after the page has gone away mid-request.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const clientErrors = validateForm(form);
  // Server messages take precedence so a field the backend rejected keeps
  // showing why until the provider edits it.
  const errors: ValidationErrors = { ...clientErrors, ...serverErrors };
  const isFormValid = Object.keys(clientErrors).length === 0;

  // ── Field change handlers ──────────────────────────────────────────────

  const handleField = useCallback(
    (field: keyof Omit<PublishFormState, 'endpoints'>) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
        // A server error on this field is now stale — drop it so the message
        // does not outlive the value it referred to.
        setServerErrors((prev) => {
          if (!(field in prev)) return prev;
          const next = { ...prev };
          delete next[field as ValidatedFields];
          return next;
        });
      },
    [setForm],
  );

  const handleBlur = useCallback(
    (field: ValidatedFields) => () => {
      setTouched((prev) => ({ ...prev, [field]: true }));
    },
    [],
  );

  // ── OpenAPI import handlers ────────────────────────────────────────────

  const handleImport = useCallback(
    (endpoints: ParsedEndpoint[]) => {
      setForm((prev) => {
        // Ids must stay unique: a restored draft can already hold ids that the
        // module-level counter has not reached yet, and duplicate React keys
        // would drop list entries.
        const taken = new Set(prev.endpoints.map((ep) => ep.id));
        const entries: EndpointEntry[] = endpoints.map((ep) => {
          let id = nextId();
          while (taken.has(id)) id = nextId();
          taken.add(id);
          return { ...ep, id };
        });
        return { ...prev, endpoints: [...prev.endpoints, ...entries] };
      });
      setImportOpen(false);
    },
    [setForm],
  );

  const handleRemoveEndpoint = useCallback(
    (id: string) => {
      setForm((prev) => ({
        ...prev,
        endpoints: prev.endpoints.filter((ep) => ep.id !== id),
      }));
    },
    [setForm],
  );

  // ── Submit ─────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      // Guard against a second POST from a double click, Enter key repeat, or a
      // submit event fired while the first is still in flight.
      if (submittingRef.current) return;

      setSubmitAttempted(true);
      // Touch all validated fields so errors become visible
      setTouched({ apiName: true, baseUrl: true, category: true, pricePerCall: true });
      setFormError(null);
      setServerErrors({});
      if (!isFormValid) return;

      const payload = toPublishPayload(form);
      const serialized = JSON.stringify(payload);
      if (idempotencyRef.current?.serialized !== serialized) {
        idempotencyRef.current = { serialized, key: generateIdempotencyKey() };
      }

      setSubmitting(true);
      submittingRef.current = true;
      try {
        const result = await submitPublishApi(payload, {
          idempotencyKey: idempotencyRef.current.key,
        });
        if (!mountedRef.current) return;

        switch (result.kind) {
          case 'success':
            // The server owns the record now. Drop the stored copy but keep the
            // in-memory form, since the success screen names the listing from
            // it and a reload must start blank rather than resurrect it.
            discardDraft();
            setListingId(result.listingId ?? null);
            setSubmitted(true);
            break;

          case 'fieldErrors': {
            const { mapped, unmapped } = toValidationErrors(result.fields);
            setServerErrors(mapped);
            setFormError(
              unmapped.length > 0
                ? `Please fix the highlighted fields. ${unmapped.join(' ')}`
                : 'Please fix the highlighted fields and submit again.',
            );
            break;
          }

          case 'unauthorized':
            // The service has already raised the session-expiry signal, and
            // the banner carries the explanation. This line is the in-form
            // breadcrumb that survives the banner being dismissed.
            setFormError('Sign in again to submit this listing.');
            break;

          case 'error':
            setFormError(result.message);
            break;
        }
      } finally {
        submittingRef.current = false;
        if (mountedRef.current) setSubmitting(false);
      }
    },
    [discardDraft, form, isFormValid],
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
            {listingId && (
              <p className="pa-success-body">
                Listing reference: <code className="pa-success-ref">{listingId}</code>
              </p>
            )}
            <button
              type="button"
              className="pa-btn-primary"
              onClick={() => {
                discardDraft(INITIAL_FORM);
                idempotencyRef.current = null;
                setTouched(INITIAL_TOUCHED);
                setSubmitAttempted(false);
                setSubmitted(false);
                setServerErrors({});
                setFormError(null);
                setListingId(null);
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
        {isExpired && <SessionExpiryBanner onDismiss={dismissExpiry} />}

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

            <FormField
              id="pa-api-name"
              label="API name"
              required
              error={errors.apiName}
              status={fieldStatus('apiName', errors, touched, submitAttempted)}
            >
              <input
                id="pa-api-name"
                type="text"
                className="pa-input"
                value={form.apiName}
                onChange={handleField('apiName')}
                onBlur={handleBlur('apiName')}
                placeholder="e.g. Weather Forecast API"
                required
                aria-required="true"
              />
            </FormField>

            <FormField
              id="pa-base-url"
              label="Base URL"
              required
              error={errors.baseUrl}
              status={fieldStatus('baseUrl', errors, touched, submitAttempted)}
            >
              <input
                id="pa-base-url"
                type="url"
                className="pa-input"
                value={form.baseUrl}
                onChange={handleField('baseUrl')}
                onBlur={handleBlur('baseUrl')}
                placeholder="https://api.example.com"
                required
                aria-required="true"
              />
            </FormField>

            <FormField
              id="pa-category"
              label="Category"
              required
              error={errors.category}
              status={fieldStatus('category', errors, touched, submitAttempted)}
            >
              <select
                id="pa-category"
                className="pa-input pa-select"
                value={form.category}
                onChange={handleField('category')}
                onBlur={handleBlur('category')}
                required
                aria-required="true"
              >
                <option value="">Select a category</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </FormField>

            <FormField
              id="pa-price"
              label="Price per call (USDC)"
              hint="Charged per successful API call. Leave blank to set later."
              error={errors.pricePerCall}
              status={fieldStatus('pricePerCall', errors, touched, submitAttempted)}
            >
              <input
                id="pa-price"
                type="text"
                inputMode="decimal"
                className="pa-input pa-input-narrow"
                value={form.pricePerCall}
                onChange={handleField('pricePerCall')}
                onBlur={handleBlur('pricePerCall')}
                placeholder="0.001"
              />
            </FormField>

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
            {formError && (
              <p className="pa-form-error" role="alert" aria-live="assertive">
                {formError}
              </p>
            )}
            <button
              type="submit"
              className="pa-btn-primary"
              disabled={submitting}
              aria-busy={submitting}
            >
              {submitting ? 'Submitting…' : 'Publish API'}
            </button>
            <p className="pa-form-note">
              Submission is reviewed before going live. API name, base URL, and
              category are required.
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
  .pa-textarea,
  .pa-select {
    min-height: 46px;
    padding: 10px 14px;
    border-radius: 12px;
    border: 1px solid var(--line, rgba(169,184,255,0.16));
    background: var(--surface-soft, rgba(255,255,255,0.04));
    color: var(--text, #f3f5fb);
    font-size: 0.95rem;
    font-family: inherit;
    resize: vertical;
    transition: border-color 180ms ease, box-shadow 180ms ease, background 180ms ease;
  }

  .pa-select {
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2393a0bf' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 14px center;
    padding-right: 36px;
    cursor: pointer;
  }

  .pa-select option {
    background: var(--surface-strong, #0e1427);
    color: var(--text, #f3f5fb);
  }

  .pa-input::placeholder,
  .pa-textarea::placeholder {
    color: var(--muted, #93a0bf);
  }

  .pa-input:focus-visible,
  .pa-textarea:focus-visible,
  .pa-select:focus-visible {
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

  .pa-form-error {
    flex: 1 1 100%;
    margin: 0;
    font-size: 0.85rem;
    color: var(--danger, #ff7d8d);
    line-height: 1.5;
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
    background: linear-gradient(135deg, var(--accent, #4e85ff), #6da6ff);
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

  .pa-success-ref {
    font-family: monospace;
    font-size: 0.88rem;
    padding: 2px 6px;
    border-radius: 5px;
    background: var(--surface-soft, rgba(255,255,255,0.06));
    border: 1px solid var(--line, rgba(169,184,255,0.16));
    color: var(--text, #f3f5fb);
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
