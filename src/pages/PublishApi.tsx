import SessionExpiryBanner from '../components/SessionExpiryBanner';
import useDocumentTitle from '../hooks/useDocumentTitle';
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

export type PublishFormState = {
  apiName: string;
  baseUrl: string;
  category: string;
  description: string;
  pricePerCall: string;
  endpoints: EndpointEntry[];
};

type ValidatedFields = Exclude<keyof PublishFormState, 'endpoints'>;

type TouchedState = Record<ValidatedFields, boolean>;

/**
 * `endpoints` is list-level: it covers both "no endpoints" and "duplicate
 * METHOD + path". Which rows are duplicates is derived from the list itself
 * (see `findDuplicateEndpointIds`), never stored, so it cannot go stale.
 */
type ValidationErrors = Partial<Record<ValidatedFields | 'endpoints', string>>;

/** id of the endpoint list's error node, referenced by aria-describedby. */
const ENDPOINTS_ERROR_ID = 'pa-endpoints-error';

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
  description: false,
  pricePerCall: false,
};

/** Maximum number of characters allowed in the API description. */
const DESCRIPTION_MAX_LENGTH = 500;

/** Announce the remaining count only when this many characters (or fewer) remain. */
const DESCRIPTION_ANNOUNCE_THRESHOLD = 50;

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

/**
 * Identity of an endpoint for uniqueness purposes.
 *
 * The method is upper-cased (the OpenAPI parser already does this; a draft
 * from an older build may not have). The path is compared exactly:
 * `/users` and `/users/:id` are different endpoints, and rewriting paths here
 * could merge definitions the provider meant to keep apart.
 */
export function endpointKey(ep: Pick<EndpointEntry, 'method' | 'path'>): string {
  return `${ep.method.toUpperCase()} ${ep.path}`;
}

/**
 * Ids of every endpoint whose METHOD + path appears more than once.
 *
 * Every member of a duplicate group is returned, not just the later ones, so
 * the provider sees all the rows involved and can choose which to remove.
 */
function findDuplicateEndpointIds(endpoints: EndpointEntry[]): Set<string> {
  const groups = new Map<string, string[]>();
  for (const ep of endpoints) {
    const key = endpointKey(ep);
    const ids = groups.get(key);
    if (ids) ids.push(ep.id);
    else groups.set(key, [ep.id]);
  }

  const duplicates = new Set<string>();
  for (const ids of groups.values()) {
    if (ids.length > 1) ids.forEach((id) => duplicates.add(id));
  }
  return duplicates;
}

export function validateEndpoints(endpoints: EndpointEntry[]): string | undefined {
  if (endpoints.length === 0) {
    return 'Add at least one endpoint before publishing. Use "Import spec" above to add them.';
  }

  const counts = new Map<string, number>();
  for (const ep of endpoints) {
    const key = endpointKey(ep);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const repeated = [...counts].filter(([, count]) => count > 1);
  if (repeated.length === 0) return undefined;

  const list = repeated.map(([key, count]) => `${key} (${count}×)`).join(', ');
  return `Each endpoint must have a unique method and path. Remove the duplicates: ${list}.`;
}

export function validateForm(form: PublishFormState): ValidationErrors {
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

  if (form.description.length > DESCRIPTION_MAX_LENGTH) {
    errors.description = `Description is over the maximum of ${DESCRIPTION_MAX_LENGTH} characters.`;
  }

  if (form.pricePerCall.trim() !== '') {
    const price = Number(form.pricePerCall);
    if (!Number.isFinite(price) || price < 0) {
      errors.pricePerCall = 'Price per call must be 0 or greater.';
    }
  }

  const endpointsError = validateEndpoints(form.endpoints);
  if (endpointsError) {
    errors.endpoints = endpointsError;
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
export function isPublishFormDraft(candidate: unknown): candidate is PublishFormState {
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
export function normalizeFieldKey(key: string): string {
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
export function toValidationErrors(fields: PublishApiFieldErrors): {
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
export function toPublishPayload(form: PublishFormState): PublishApiInput {
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
  const { value: form, setValue: setForm, discard: discardDraft, isRestored } =
    useFormPersistence(DRAFT_STORAGE_KEY, INITIAL_FORM, { isValid: isPublishFormDraft });
  const [touched, setTouched] = useState<TouchedState>(INITIAL_TOUCHED);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importFeedback, setImportFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /** Per-field messages returned by the server on the last attempt. */
  const [serverErrors, setServerErrors] = useState<ValidationErrors>({});
  /** Form-level failure that belongs to no single input. */
  const [formError, setFormError] = useState<string | null>(null);
  const [listingId, setListingId] = useState<string | null>(null);
  const importSectionId = useId();

  const descriptionLength = form.description.length;
  const descriptionRemaining = DESCRIPTION_MAX_LENGTH - descriptionLength;
  const descriptionOverLimit = descriptionRemaining < 0;
  const descriptionNearLimit =
    !descriptionOverLimit && descriptionRemaining <= DESCRIPTION_ANNOUNCE_THRESHOLD;

  /**
   * Throttled polite announcement of the remaining character count.
   *
   * Only updates when the field is within the near-limit threshold, and only
   * when the remaining count actually changes, so screen readers are not
   * spammed on every keystroke.
   */
  const [descriptionAnnouncement, setDescriptionAnnouncement] = useState('');
  const lastAnnouncedRemainingRef = useRef<number | null>(null);
  useEffect(() => {
    if (!descriptionNearLimit) {
      lastAnnouncedRemainingRef.current = null;
      setDescriptionAnnouncement('');
      return;
    }
    if (lastAnnouncedRemainingRef.current === descriptionRemaining) return;
    lastAnnouncedRemainingRef.current = descriptionRemaining;
    setDescriptionAnnouncement(
      `${descriptionRemaining} character${descriptionRemaining === 1 ? '' : 's'} remaining`,
    );
  }, [descriptionNearLimit, descriptionRemaining]);

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

  const clientErrors = useMemo(() => validateForm(form), [form]);
  // Server messages take precedence so a field the backend rejected keeps
  // showing why until the provider edits it.
  const errors: ValidationErrors = { ...clientErrors, ...serverErrors };
  const isFormValid = Object.keys(clientErrors).length === 0;
  const duplicateEndpointIds = useMemo(
    () => findDuplicateEndpointIds(form.endpoints),
    [form.endpoints],
  );
  // Rendered errors follow the rest of the form: nothing until a submit.
  const endpointsError = submitAttempted ? errors.endpoints : undefined;

  /** Focus target when a submit fails on the endpoint list alone. */
  const endpointsRef = useRef<HTMLFieldSetElement>(null);
  /** Bumped by a failed submit that should move focus to the endpoint list. */
  const [endpointFocusRequest, setEndpointFocusRequest] = useState(0);

  const hasUnsavedChanges = useMemo(
    () =>
      form.apiName !== '' ||
      form.baseUrl !== '' ||
      form.category !== '' ||
      form.description !== '' ||
      form.pricePerCall !== '' ||
      form.endpoints.length > 0,
    [form],
  );

  useBeforeUnload(hasUnsavedChanges);

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
      let importedCount = 0;
      let skippedCount = 0;
      setForm((prev) => {
        const takenIds = new Set(prev.endpoints.map((ep) => ep.id));
        const keys = new Set(prev.endpoints.map((ep) => endpointKey(ep)));
        const entries: EndpointEntry[] = [];
        for (const ep of endpoints) {
          const key = endpointKey(ep);
          if (keys.has(key)) {
            skippedCount += 1;
            continue;
          }
          keys.add(key);
          let id = nextId();
          while (takenIds.has(id)) id = nextId();
          takenIds.add(id);
          entries.push({ ...ep, id });
        }
        importedCount = entries.length;
        return { ...prev, endpoints: [...prev.endpoints, ...entries] };
      });
      setImportFeedback(
        importedCount === 0
          ? (endpoints.length === 0 ? 'No endpoints found in the specification.' : 'No new endpoints imported; duplicates were skipped.')
          : `${importedCount} endpoint${importedCount === 1 ? '' : 's'} imported${skippedCount > 0 ? `; ${skippedCount} duplicate${skippedCount === 1 ? '' : 's'} skipped` : ''}.`,
      );
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
      setTouched({ apiName: true, baseUrl: true, category: true, description: true, pricePerCall: true });
      setFormError(null);
      setServerErrors({});
      if (!isFormValid) {
        // The detail fields come first on the page. Only take focus to the
        // endpoint list when it is the sole problem, so a provider is never
        // pulled past an earlier error they have not seen yet.
        const onlyEndpointsInvalid =
          clientErrors.endpoints !== undefined && Object.keys(clientErrors).length === 1;
        if (onlyEndpointsInvalid) setEndpointFocusRequest((n) => n + 1);
        return;
      }

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
    [clientErrors, discardDraft, form, isFormValid],
  );

  // Runs after the render that fills in the endpoint error, so a screen reader
  // announces the description along with the focus move.
  useEffect(() => {
    if (endpointFocusRequest > 0) endpointsRef.current?.focus();
  }, [endpointFocusRequest]);

  const handleClearDraft = useCallback(() => {
    discardDraft(INITIAL_FORM);
    idempotencyRef.current = null;
    setTouched(INITIAL_TOUCHED);
    setSubmitAttempted(false);
    setServerErrors({});
    setFormError(null);
  }, [discardDraft]);

  // ── Success screen ─────────────────────────────────────────────────────

  if (submitted) {
    return (
      <PublishSuccessView
        apiName={form.apiName}
        listingId={listingId}
        onPublishAnother={handleResetAfterSubmit}
      />
    );
  }

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
          {importFeedback && (
            <p className="pa-import-feedback" role="status" aria-live="polite">
              {importFeedback}
            </p>
          )}
        </section>

        {/* ── Draft restored notice (with dismiss) ─────────────── */}
        {isRestored && (
          <div className="pa-draft-banner surface">
            <span aria-hidden="true">💾</span>
            <span>Your previous draft has been restored. Your form data is being saved automatically.</span>
            <button
              type="button"
              className="pa-btn-secondary pa-draft-dismiss"
              onClick={handleClearDraft}
            >
              Clear draft
            </button>
          </div>
        )}

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

            <FormField
              id="pa-description"
              label="Description"
              error={errors.description}
              status={fieldStatus('description', errors, touched, submitAttempted)}
              counter={{ current: descriptionLength, max: DESCRIPTION_MAX_LENGTH }}
            >
              <textarea
                id="pa-description"
                className="pa-textarea"
                value={form.description}
                onChange={handleField('description')}
                onBlur={handleBlur('description')}
                placeholder="Describe what your API does, its use cases, and any notable constraints."
                rows={4}
              />
            </FormField>
            {/* Throttled announcement: only speaks once fewer than 50 characters remain. */}
            <p id="pa-description-counter-live" className="sr-only" aria-live="polite" aria-atomic="true">
              {descriptionAnnouncement}
            </p>
          </fieldset>

          {/* ── Endpoint list ────────────────────────────────────── */}
          <fieldset
            ref={endpointsRef}
            className="pa-fieldset pa-endpoints-fieldset"
            aria-describedby={ENDPOINTS_ERROR_ID}
            tabIndex={-1}
          >
            Clear draft
          </button>
        </div>
      )}

      <form
        className="pa-form surface"
        onSubmit={handleSubmit}
        noValidate
        aria-label="Publish API form"
      >
        <BasicsStep
          form={form}
          errors={errors}
          touched={touched}
          submitAttempted={submitAttempted}
          descriptionLength={descriptionLength}
          descriptionAnnouncement={descriptionAnnouncement}
          onFieldChange={handleField}
          onFieldBlur={handleBlur}
          pricingSlot={
            <PricingStep
              pricePerCall={form.pricePerCall}
              errors={errors}
              touched={touched}
              submitAttempted={submitAttempted}
              onChange={handleField('pricePerCall')}
              onBlur={handleBlur('pricePerCall')}
            />
          }
        />

        <EndpointEditor
          endpoints={form.endpoints}
          submitAttempted={submitAttempted}
          duplicateEndpointIds={duplicateEndpointIds}
          endpointsError={endpointsError}
          endpointsRef={endpointsRef}
          onRemoveEndpoint={handleRemoveEndpoint}
        />

        <ReviewSummary formError={formError} submitting={submitting} />
      </form>
    </div>
  );
}
