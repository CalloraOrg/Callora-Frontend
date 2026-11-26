import type { ParsedEndpoint } from '../../components/OpenAPIImport';
import type { FieldStatus } from '../../components/FormField';
import type { PublishApiFieldErrors, PublishApiInput } from '../../services/publishApi';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EndpointEntry = ParsedEndpoint & {
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

export type ValidatedFields = Exclude<keyof PublishFormState, 'endpoints'>;

export type TouchedState = Record<ValidatedFields, boolean>;

/**
 * `endpoints` is list-level: it covers both "no endpoints" and "duplicate
 * METHOD + path". Which rows are duplicates is derived from the list itself
 * (see `findDuplicateEndpointIds`), never stored, so it cannot go stale.
 */
export type ValidationErrors = Partial<Record<ValidatedFields | 'endpoints', string>>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** id of the endpoint list's error node, referenced by aria-describedby. */
export const ENDPOINTS_ERROR_ID = 'pa-endpoints-error';

export const INITIAL_FORM: PublishFormState = {
  apiName: '',
  baseUrl: '',
  category: '',
  description: '',
  pricePerCall: '',
  endpoints: [],
};

export const INITIAL_TOUCHED: TouchedState = {
  apiName: false,
  baseUrl: false,
  category: false,
  description: false,
  pricePerCall: false,
};

/** Maximum number of characters allowed in the API description. */
export const DESCRIPTION_MAX_LENGTH = 500;

/** Announce the remaining count only when this many characters (or fewer) remain. */
export const DESCRIPTION_ANNOUNCE_THRESHOLD = 50;

export const CATEGORIES = [
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
export const DRAFT_STORAGE_KEY = 'callora:publish-api:draft';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _idSeq = 0;
export function nextId() {
  _idSeq += 1;
  return `ep-${_idSeq}`;
}

export function methodBadgeClass(method: string): string {
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
export function findDuplicateEndpointIds(endpoints: EndpointEntry[]): Set<string> {
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

export function fieldStatus(
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
export const FIELD_ALIASES: Record<string, ValidatedFields> = {
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
