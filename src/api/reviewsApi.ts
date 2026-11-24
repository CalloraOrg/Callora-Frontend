/**
 * reviewsApi — API client for review eligibility checks and review submission.
 *
 * Assumed backend contract
 * ────────────────────────
 * 1. GET /api/apis/:id/reviews/eligibility
 *    - 200 OK:
 *        {
 *          eligible: boolean,
 *          reason?: "not_authenticated" | "not_subscribed" | "already_reviewed" | "unknown",
 *          message?: string
 *        }
 *    - 401 Unauthorized  -> normalized to { eligible: false, reason: "not_authenticated" }
 *    - 403 Forbidden     -> normalized to { eligible: false, reason: "not_subscribed" }
 *    - 409 Conflict      -> normalized to { eligible: false, reason: "already_reviewed" }
 *    - 429 / 5xx         -> throws ReviewApiError
 *
 * 2. POST /api/apis/:id/reviews
 *    - Request body: { rating: number (1..5), body: string }
 *    - 200 OK / 201 Created:
 *        { id, author, rating, date, body, verified? }
 *        (or wrapped as { review: { id, author, rating, date, body, verified? } })
 *    - 401 Unauthorized       -> ReviewApiError(code: "unauthorized")
 *    - 403 Forbidden          -> ReviewApiError(code: "not_subscribed")
 *    - 409 Conflict           -> ReviewApiError(code: "already_reviewed")
 *    - 422 Unprocessable      -> ReviewApiError(code: "validation", fieldErrors?)
 *    - 429 Too Many Requests  -> ReviewApiError(code: "rate_limited")
 *    - 5xx / other            -> ReviewApiError(code: "server")
 */

import { authFetch } from "../services/authFetch";

export type ReviewEligibilityReason =
  | "not_authenticated"
  | "not_subscribed"
  | "already_reviewed"
  | "unknown";

export interface ReviewEligibility {
  eligible: boolean;
  reason?: ReviewEligibilityReason;
  message?: string;
}

export interface SubmitReviewInput {
  rating: number;
  body: string;
}

export interface SubmittedReview {
  id: string;
  author: string;
  rating: number;
  date: string;
  body: string;
  verified?: boolean;
}

export type ReviewApiErrorCode =
  | "unauthorized"
  | "not_subscribed"
  | "already_reviewed"
  | "validation"
  | "rate_limited"
  | "network"
  | "server"
  | "invalid_response";

export class ReviewApiError extends Error {
  readonly code: ReviewApiErrorCode;
  readonly status?: number;
  readonly fieldErrors?: Record<string, string>;

  constructor(
    code: ReviewApiErrorCode,
    message: string,
    options?: { status?: number; fieldErrors?: Record<string, string>; cause?: unknown },
  ) {
    super(message);
    this.name = "ReviewApiError";
    this.code = code;
    this.status = options?.status;
    this.fieldErrors = options?.fieldErrors;
    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export function isReviewAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  return (error as { name?: unknown }).name === "AbortError";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const VALID_REASONS = new Set<ReviewEligibilityReason>([
  "not_authenticated",
  "not_subscribed",
  "already_reviewed",
  "unknown",
]);

function normalizeReason(value: unknown): ReviewEligibilityReason | undefined {
  if (typeof value !== "string") return undefined;
  return VALID_REASONS.has(value as ReviewEligibilityReason)
    ? (value as ReviewEligibilityReason)
    : "unknown";
}

async function safeReadJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function extractErrorDetails(payload: unknown): {
  message?: string;
  fieldErrors?: Record<string, string>;
} {
  if (!isRecord(payload)) return {};
  const message =
    typeof payload.message === "string" && payload.message.trim()
      ? payload.message.trim()
      : typeof payload.error === "string" && payload.error.trim()
        ? payload.error.trim()
        : undefined;

  const rawErrors = isRecord(payload.fieldErrors)
    ? payload.fieldErrors
    : isRecord(payload.errors)
      ? payload.errors
      : undefined;

  let fieldErrors: Record<string, string> | undefined;
  if (rawErrors) {
    const parsed: Record<string, string> = {};
    for (const [key, val] of Object.entries(rawErrors)) {
      if (typeof val === "string" && val.trim()) {
        parsed[key] = val.trim();
      } else if (Array.isArray(val) && typeof val[0] === "string" && val[0].trim()) {
        parsed[key] = val[0].trim();
      }
    }
    if (Object.keys(parsed).length > 0) {
      fieldErrors = parsed;
    }
  }

  return { message, fieldErrors };
}

function classifyHttpError(
  status: number,
  payload: unknown,
): ReviewApiError {
  const { message, fieldErrors } = extractErrorDetails(payload);

  switch (status) {
    case 401:
      return new ReviewApiError(
        "unauthorized",
        message ?? "Please sign in to write a review.",
        { status },
      );
    case 403:
      return new ReviewApiError(
        "not_subscribed",
        message ?? "Subscribe to this API before writing a review.",
        { status },
      );
    case 409:
      return new ReviewApiError(
        "already_reviewed",
        message ?? "You have already submitted a review for this API.",
        { status },
      );
    case 422:
      return new ReviewApiError(
        "validation",
        message ?? "Please check your rating and review text and try again.",
        { status, fieldErrors },
      );
    case 429:
      return new ReviewApiError(
        "rate_limited",
        message ?? "Too many requests. Please wait a moment and try again.",
        { status },
      );
    default:
      return new ReviewApiError(
        "server",
        message ?? `Review request failed (${status}). Please try again.`,
        { status },
      );
  }
}

function parseSubmittedReview(payload: unknown): SubmittedReview {
  const candidate =
    isRecord(payload) && isRecord(payload.review) ? payload.review : payload;

  if (
    !isRecord(candidate) ||
    typeof candidate.id !== "string" ||
    !candidate.id.trim() ||
    typeof candidate.author !== "string" ||
    !candidate.author.trim() ||
    typeof candidate.rating !== "number" ||
    !Number.isFinite(candidate.rating) ||
    candidate.rating < 1 ||
    candidate.rating > 5 ||
    typeof candidate.date !== "string" ||
    !candidate.date.trim() ||
    typeof candidate.body !== "string"
  ) {
    throw new ReviewApiError(
      "invalid_response",
      "The server returned an invalid review response.",
    );
  }

  return {
    id: candidate.id,
    author: candidate.author,
    rating: candidate.rating,
    date: candidate.date,
    body: candidate.body,
    ...(typeof candidate.verified === "boolean"
      ? { verified: candidate.verified }
      : {}),
  };
}

export async function fetchEligibility(
  apiId: string,
  options?: { signal?: AbortSignal },
): Promise<ReviewEligibility> {
  let response: Response;
  try {
    response = await authFetch(
      `/api/apis/${encodeURIComponent(apiId)}/reviews/eligibility`,
      {
        method: "GET",
        signal: options?.signal,
      },
    );
  } catch (err) {
    if (isReviewAbortError(err)) throw err;
    throw new ReviewApiError(
      "network",
      "Unable to check review eligibility. Please check your connection.",
      { cause: err },
    );
  }

  const payload = await safeReadJson(response);

  if (response.status === 401) {
    const { message } = extractErrorDetails(payload);
    return {
      eligible: false,
      reason: "not_authenticated",
      message: message ?? "Sign in to write a review.",
    };
  }

  if (response.status === 403) {
    const { message } = extractErrorDetails(payload);
    return {
      eligible: false,
      reason: "not_subscribed",
      message: message ?? "Subscribe to this API to write a review.",
    };
  }

  if (response.status === 409) {
    const { message } = extractErrorDetails(payload);
    return {
      eligible: false,
      reason: "already_reviewed",
      message: message ?? "You have already reviewed this API.",
    };
  }

  if (!response.ok) {
    throw classifyHttpError(response.status, payload);
  }

  if (!isRecord(payload) || typeof payload.eligible !== "boolean") {
    throw new ReviewApiError(
      "invalid_response",
      "The eligibility response was invalid.",
    );
  }

  return {
    eligible: payload.eligible,
    ...(payload.reason !== undefined
      ? { reason: normalizeReason(payload.reason) }
      : {}),
    ...(typeof payload.message === "string" && payload.message.trim()
      ? { message: payload.message.trim() }
      : {}),
  };
}

export async function submitReview(
  apiId: string,
  input: SubmitReviewInput,
  options?: { signal?: AbortSignal },
): Promise<SubmittedReview> {
  let response: Response;
  try {
    response = await authFetch(
      `/api/apis/${encodeURIComponent(apiId)}/reviews`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rating: input.rating,
          body: input.body,
        }),
        signal: options?.signal,
      },
    );
  } catch (err) {
    if (isReviewAbortError(err)) throw err;
    throw new ReviewApiError(
      "network",
      "Network error while submitting your review. Please try again.",
      { cause: err },
    );
  }

  const payload = await safeReadJson(response);

  if (!response.ok) {
    throw classifyHttpError(response.status, payload);
  }

  return parseSubmittedReview(payload);
}
