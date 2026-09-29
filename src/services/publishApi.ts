/**
 * Publish API listing submission.
 *
 * Owns the wire protocol for the publish flow: it POSTs the listing payload
 * with an `Idempotency-Key`, bounds the request with a timeout, and translates
 * HTTP outcomes into a result the UI can act on. The page component never
 * touches `fetch` directly, so status handling stays unit-testable.
 */

import { API_BASE_URL } from '../config/constants';
import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  generateIdempotencyKey,
  isTimeoutError,
  runWithTimeout,
} from './idempotency';
import { signalExpiry } from './sessionExpiry';

/** Path the publish flow POSTs to. */
export const PUBLISH_API_PATH = '/v1/apis';

/** One endpoint entry as sent to the server (no UI-only fields). */
export type PublishEndpointInput = {
  path: string;
  method: string;
  summary?: string;
};

export type PublishApiInput = {
  apiName: string;
  baseUrl: string;
  category: string;
  description: string;
  /** `null` means "not priced yet", matching the blank-field affordance. */
  pricePerCall: number | null;
  endpoints: PublishEndpointInput[];
};

/** Field name -> message, using the server's own field names. */
export type PublishApiFieldErrors = Record<string, string>;

export type PublishApiResult =
  | { kind: 'success'; listingId?: string }
  | { kind: 'fieldErrors'; fields: PublishApiFieldErrors }
  | { kind: 'unauthorized' }
  | { kind: 'error'; message: string; retryable: boolean };

export type SubmitPublishApiOptions = {
  /** Reuse a key across retries of the same logical submission. */
  idempotencyKey?: string;
  timeoutMs?: number;
  /** Override the target URL. Defaults to {@link API_BASE_URL}. */
  url?: string;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Pull per-field messages out of an error body.
 *
 * Accepts the three shapes seen in practice — an object map under `errors`,
 * the same under `fieldErrors`, and an array of `{ field, message }` — and
 * ignores anything that is not a non-empty string so a malformed body degrades
 * to a form-level error instead of rendering `[object Object]`.
 */
export function extractFieldErrors(payload: unknown): PublishApiFieldErrors {
  if (!isRecord(payload)) return {};

  const fields: PublishApiFieldErrors = {};
  const add = (field: unknown, message: unknown) => {
    if (typeof field !== 'string' || field === '') return;
    if (typeof message !== 'string' || message.trim() === '') return;
    fields[field] = message;
  };

  const candidates = [payload.errors, payload.fieldErrors];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      for (const entry of candidate) {
        if (!isRecord(entry)) continue;
        add(entry.field, entry.message);
      }
    } else if (isRecord(candidate)) {
      for (const [field, message] of Object.entries(candidate)) {
        add(field, message);
      }
    }
  }

  return fields;
}

/** Best-effort human-readable message from an error body. */
function extractMessage(payload: unknown, fallback: string): string {
  if (isRecord(payload)) {
    for (const key of ['message', 'error', 'detail'] as const) {
      const value = payload[key];
      if (typeof value === 'string' && value.trim() !== '') return value;
    }
  }
  return fallback;
}

/** Parse a response body, tolerating empty or non-JSON payloads. */
async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return undefined;
  }
}

/** Extract a listing id from a success body under any of the usual names. */
function extractListingId(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;
  for (const key of ['id', 'apiId', 'listingId', 'api_id']) {
    const value = payload[key];
    if (typeof value === 'string' && value !== '') return value;
    if (typeof value === 'number') return String(value);
  }
  const nested = payload.api;
  if (isRecord(nested) && typeof nested.id === 'string') return nested.id;
  return undefined;
}

/**
 * POST a publish listing.
 *
 * Never throws for an HTTP-level problem — every outcome is a
 * {@link PublishApiResult} so the caller has one exhaustive branch. A 401
 * additionally fires {@link signalExpiry} so the session-expiry banner appears
 * wherever the app chooses to render it.
 */
export async function submitPublishApi(
  input: PublishApiInput,
  options: SubmitPublishApiOptions = {},
): Promise<PublishApiResult> {
  const {
    idempotencyKey = generateIdempotencyKey(),
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    url = `${API_BASE_URL}${PUBLISH_API_PATH}`,
    fetchImpl = globalThis.fetch,
  } = options;

  if (typeof fetchImpl !== 'function') {
    return {
      kind: 'error',
      message: 'Unable to reach the Callora API. Please try again.',
      retryable: true,
    };
  }

  let response: Response;
  try {
    response = await runWithTimeout(
      (signal) =>
        fetchImpl(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
          credentials: 'include',
          body: JSON.stringify(input),
          signal,
        }),
      timeoutMs,
    );
  } catch (error) {
    if (isTimeoutError(error)) {
      return {
        kind: 'error',
        message: 'The request timed out. Your draft is saved — please try again.',
        retryable: true,
      };
    }
    // Network failure, CORS rejection, or an aborted request.
    return {
      kind: 'error',
      message: 'Network error. Check your connection and try again.',
      retryable: true,
    };
  }

  const payload = await readJson(response);

  if (response.status === 401 || response.status === 419) {
    signalExpiry('unauthorized');
    return { kind: 'unauthorized' };
  }

  if (response.ok) {
    return { kind: 'success', listingId: extractListingId(payload) };
  }

  if (response.status >= 400 && response.status < 500) {
    const fields = extractFieldErrors(payload);
    if (Object.keys(fields).length > 0) {
      return { kind: 'fieldErrors', fields };
    }
    return {
      kind: 'error',
      message: extractMessage(
        payload,
        response.status === 429
          ? 'Too many submissions. Please wait a moment and try again.'
          : 'The server rejected this listing. Please review the details and try again.',
      ),
      retryable: response.status === 429,
    };
  }

  return {
    kind: 'error',
    message: extractMessage(
      payload,
      'The Callora API is unavailable right now. Your draft is saved — please try again.',
    ),
    retryable: true,
  };
}
