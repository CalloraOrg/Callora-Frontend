/**
 * ReviewsTab
 *
 * Standalone tab-panel component for the "Reviews" section of ApiDetailPage.
 *
 * Print behaviour (issue #580 – GrantFox FWC26 / Stellar Wave campaign)
 * ─────────────────────────────────────────────────────────────────────
 *  • The review-sort control, "Write a Review" button, and any other
 *    interactive chrome carry `no-print` so they are hidden when the page is
 *    sent to a printer or exported to PDF.
 *  • The RatingHistogram, every review card, and all author/date/body text
 *    have no `no-print` class – they are visible on paper.
 *  • The collapsible `.reviews-tab__sort-row` is rendered without a CSS
 *    `max-height` collapse in print media (see src/styles/print.css and the
 *    `@media print` block in src/index.css), so the full review list is always
 *    expanded when printed.
 *  • A print-only section heading (`reviews-tab__print-heading`) is injected
 *    via CSS `content` (see print.css) rather than a visible DOM node, keeping
 *    the screen layout unaffected.
 *
 * Accessibility
 * ─────────────
 *  • The panel wraps in a `<section>` with `role="tabpanel"` and an
 *    `aria-labelledby` pointing at the Reviews tab button rendered by the
 *    parent `<Tabs>` component.
 *  • Star-rating `<span>` elements carry descriptive `aria-label` attributes.
 *  • The "Verified Developer" badge uses an explicit `aria-label`; its inline
 *    SVG is marked `aria-hidden="true"`.
 *
 * Design tokens
 * ─────────────
 *  All colours reference CSS custom properties defined in
 *  `src/styles/tokens.css` / `src/index.css` so both dark-mode and light-mode
 *  (including the forced-light print override) work automatically.
 */

import React, { useState, useMemo, useEffect, useRef, useId } from "react";
import RatingHistogram from "../components/RatingHistogram";
import ReviewForm, { type ReviewDraft } from "../components/ReviewForm";
import {
  fetchEligibility,
  submitReview,
  ReviewApiError,
  isReviewAbortError,
  type ReviewEligibility,
} from "../api/reviewsApi";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Review {
  id: string;
  author: string;
  rating: number;
  date: string;
  body: string;
  verified?: boolean;
  pending?: boolean;
}

type ReviewSort = "newest" | "highest" | "lowest";

export interface ReviewsTabProps {
  /** All reviews for the current API, unsorted. */
  reviews: Review[];
  /** Pre-computed average rating (0–5). */
  averageRating: number;
  /** Callback for the "Write a Review" button.  No-op by default. */
  onWriteReview?: () => void;
  /** API identifier used to check eligibility and submit reviews. */
  apiId?: string;
  /** Optional external eligibility state (skips fetchEligibility when provided). */
  eligibility?: ReviewEligibility | null;
  /** Optional custom submission handler (defaults to submitReview(apiId, draft)). */
  onSubmitReview?: (
    draft: ReviewDraft,
    options?: { signal?: AbortSignal },
  ) => Promise<Review>;
  /** Optional notification callback (e.g. toast) for success/error feedback. */
  onNotify?: (message: string, variant: "success" | "error" | "warning") => void;
  /** Optional callback when the reviews list or average rating changes. */
  onReviewsChange?: (reviews: Review[], averageRating: number) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeAverageRating(list: Review[]): number {
  if (list.length === 0) return 0;
  const sum = list.reduce((acc, r) => acc + r.rating, 0);
  return Math.round((sum / list.length) * 10) / 10;
}

function defaultIneligibleMessage(eligibility: ReviewEligibility): string {
  if (eligibility.message) return eligibility.message;
  switch (eligibility.reason) {
    case "not_authenticated":
      return "Sign in to write a review.";
    case "not_subscribed":
      return "Subscribe to this API to write a review.";
    case "already_reviewed":
      return "You have already reviewed this API.";
    default:
      return "You are not currently eligible to review this API.";
  }
}

function StarRow({ rating }: { rating: number }) {
  return (
    <span
      role="img"
      aria-label={`${rating} out of 5 stars`}
      style={{ display: "flex", gap: 1 }}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          width="13"
          height="13"
          viewBox="0 0 20 20"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M10 1.5l2.39 4.84 5.34.78-3.87 3.77.91 5.32L10 13.77l-4.77 2.44.91-5.32L2.27 7.12l5.34-.78L10 1.5z"
            fill={i < rating ? "var(--accent)" : "var(--line)"}
          />
        </svg>
      ))}
    </span>
  );
}

function VerifiedBadge() {
  return (
    <span
      title="Has called this API in the last 30 days"
      aria-label="Verified Developer – has called this API in the last 30 days"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: "18px",
        background: "rgba(16, 185, 129, 0.12)",
        color: "var(--success)",
        border: "1px solid rgba(16, 185, 129, 0.3)",
        cursor: "default",
        whiteSpace: "nowrap",
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M2 6l3 3 5-5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Verified Developer
    </span>
  );
}

function PendingBadge() {
  return (
    <span
      aria-label="Pending confirmation"
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: "18px",
        background: "rgba(245, 158, 11, 0.14)",
        color: "var(--warning, #d97706)",
        border: "1px solid rgba(245, 158, 11, 0.35)",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      Pending
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

const ReviewsTab: React.FC<ReviewsTabProps> = ({
  reviews,
  averageRating,
  onWriteReview,
  apiId,
  eligibility: eligibilityProp,
  onSubmitReview,
  onNotify,
  onReviewsChange,
}) => {
  const [reviewSort, setReviewSort] = useState<ReviewSort>("newest");
  const [localReviews, setLocalReviews] = useState<Review[]>(reviews);
  const [localAverage, setLocalAverage] = useState<number>(averageRating);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draft, setDraft] = useState<ReviewDraft>({ rating: 0, body: "" });
  const [serverError, setServerError] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<string>("");
  const [fetchedEligibility, setFetchedEligibility] =
    useState<ReviewEligibility | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);

  const submitControllerRef = useRef<AbortController | null>(null);
  const submittingRef = useRef(false);
  const helperId = useId();

  const hasSubmissionCapability = Boolean(apiId || onSubmitReview);
  const effectiveEligibility: ReviewEligibility | null =
    eligibilityProp !== undefined ? eligibilityProp : fetchedEligibility;

  // Keep local state in sync when parent props change
  useEffect(() => {
    setLocalReviews(reviews);
    setLocalAverage(averageRating);
  }, [reviews, averageRating]);

  // Fetch eligibility when apiId is provided and eligibility is not controlled by parent
  useEffect(() => {
    if (!apiId || eligibilityProp !== undefined) return;
    const controller = new AbortController();
    setEligibilityLoading(true);
    fetchEligibility(apiId, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) {
          setFetchedEligibility(result);
        }
      })
      .catch((err) => {
        if (controller.signal.aborted || isReviewAbortError(err)) return;
        setFetchedEligibility({
          eligible: false,
          reason: "unknown",
          message:
            err instanceof Error
              ? err.message
              : "Unable to verify review eligibility.",
        });
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setEligibilityLoading(false);
        }
      });

    return () => controller.abort();
  }, [apiId, eligibilityProp]);

  // Abort any in-flight submission on unmount
  useEffect(() => {
    return () => {
      submitControllerRef.current?.abort();
    };
  }, []);

  const isIneligible =
    effectiveEligibility !== null && !effectiveEligibility.eligible;
  const ineligibleHelperText = isIneligible
    ? defaultIneligibleMessage(effectiveEligibility)
    : null;
  const writeButtonDisabled =
    isSubmitting || eligibilityLoading || isIneligible;

  const handleWriteClick = () => {
    onWriteReview?.();
    if (!hasSubmissionCapability) return;
    if (writeButtonDisabled) return;
    setServerError(null);
    setIsFormOpen((prev) => !prev);
  };

  const handleFormCancel = () => {
    setIsFormOpen(false);
    setServerError(null);
  };

  const handleFormSubmit = async (submittedDraft: ReviewDraft) => {
    if (submittingRef.current) return;
    if (!onSubmitReview && !apiId) return;

    submittingRef.current = true;
    setIsSubmitting(true);
    setServerError(null);

    const previousReviews = localReviews;
    const previousAverage = localAverage;
    const tempId = `pending-review-${Date.now()}`;
    const optimisticReview: Review = {
      id: tempId,
      author: "You",
      rating: submittedDraft.rating,
      date: new Date().toISOString(),
      body: submittedDraft.body,
      verified: true,
      pending: true,
    };

    const optimisticReviews = [optimisticReview, ...previousReviews];
    const optimisticAverage = computeAverageRating(optimisticReviews);

    setLocalReviews(optimisticReviews);
    setLocalAverage(optimisticAverage);
    setIsFormOpen(false);
    setLiveStatus("Submitting your review...");
    onReviewsChange?.(optimisticReviews, optimisticAverage);

    const controller = new AbortController();
    submitControllerRef.current = controller;

    try {
      const confirmed = onSubmitReview
        ? await onSubmitReview(submittedDraft, { signal: controller.signal })
        : await submitReview(apiId!, submittedDraft, {
            signal: controller.signal,
          });

      if (controller.signal.aborted) return;

      const confirmedReview: Review = { ...confirmed, pending: false };
      const finalReviews = optimisticReviews.map((r) =>
        r.id === tempId ? confirmedReview : r,
      );
      const finalAverage = computeAverageRating(finalReviews);

      setLocalReviews(finalReviews);
      setLocalAverage(finalAverage);
      setDraft({ rating: 0, body: "" });
      setFetchedEligibility({
        eligible: false,
        reason: "already_reviewed",
        message: "You have already reviewed this API.",
      });
      setLiveStatus("Your review has been published.");
      onNotify?.("Your review has been published.", "success");
      onReviewsChange?.(finalReviews, finalAverage);
    } catch (err) {
      if (controller.signal.aborted || isReviewAbortError(err)) return;

      // Roll back optimistic insert and restore draft
      setLocalReviews(previousReviews);
      setLocalAverage(previousAverage);
      setDraft(submittedDraft);
      setIsFormOpen(true);

      const message =
        err instanceof Error
          ? err.message
          : "Failed to submit review. Please try again.";
      setServerError(message);
      setLiveStatus(message);

      if (err instanceof ReviewApiError && err.code === "already_reviewed") {
        setFetchedEligibility({
          eligible: false,
          reason: "already_reviewed",
          message,
        });
      }

      onNotify?.(message, "error");
      onReviewsChange?.(previousReviews, previousAverage);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
      if (submitControllerRef.current === controller) {
        submitControllerRef.current = null;
      }
    }
  };

  // Derive rating distribution for the histogram
  const ratingDistribution = useMemo<Record<number, number> | undefined>(() => {
    if (localReviews.length === 0) return undefined;
    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    localReviews.forEach((r) => {
      const star = Math.min(5, Math.max(1, Math.round(r.rating)));
      dist[star] = (dist[star] ?? 0) + 1;
    });
    return dist;
  }, [localReviews]);

  // Stable sort – pending reviews stay at the top immediately
  const sortedReviews = useMemo(() => {
    return [...localReviews].sort((a, b) => {
      if (a.pending && !b.pending) return -1;
      if (!a.pending && b.pending) return 1;
      if (reviewSort === "highest") return b.rating - a.rating;
      if (reviewSort === "lowest") return a.rating - b.rating;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [localReviews, reviewSort]);

  const renderHeader = () => (
    <div className="api-detail-reviews-header no-print">
      <h3 style={{ margin: 0 }}>Developer Feedback</h3>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
        <button
          type="button"
          className="secondary-button no-print"
          onClick={handleWriteClick}
          disabled={writeButtonDisabled}
          aria-describedby={ineligibleHelperText ? helperId : undefined}
          aria-expanded={hasSubmissionCapability ? isFormOpen : undefined}
        >
          {isFormOpen ? "Close Review Form" : "Write a Review"}
        </button>
        {ineligibleHelperText && (
          <span
            id={helperId}
            style={{
              fontSize: 12,
              color: "var(--muted)",
            }}
          >
            {ineligibleHelperText}
          </span>
        )}
      </div>
    </div>
  );

  const renderLiveRegion = () => (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
      style={{
        position: "absolute",
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: "hidden",
        clip: "rect(0, 0, 0, 0)",
        whiteSpace: "nowrap",
        border: 0,
      }}
    >
      {liveStatus}
    </div>
  );

  // ── Empty state ────────────────────────────────────────────────────────────

  if (localReviews.length === 0) {
    return (
      <section
        id="panel-reviews"
        role="tabpanel"
        aria-labelledby="tab-reviews"
        tabIndex={0}
        className="reviews-tab"
        data-reviews-section
      >
        {renderLiveRegion()}
        {renderHeader()}

        {isFormOpen && (
          <ReviewForm
            initialRating={draft.rating}
            initialBody={draft.body}
            isSubmitting={isSubmitting}
            serverError={serverError}
            onSubmit={handleFormSubmit}
            onCancel={handleFormCancel}
          />
        )}

        {/* Empty placeholder – also hidden in print (no useful content) */}
        <div
          className="preview-card no-print"
          style={{
            padding: 40,
            textAlign: "center",
            borderStyle: "dashed",
            marginTop: 16,
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 16 }}>💬</div>
          <h4>No public reviews yet</h4>
          <p style={{ color: "var(--muted)", maxWidth: 400, margin: "0 auto" }}>
            Be the first to share your experience with this API.
          </p>
        </div>
      </section>
    );
  }

  // ── Reviews list ───────────────────────────────────────────────────────────

  return (
    <section
      id="panel-reviews"
      role="tabpanel"
      aria-labelledby="tab-reviews"
      tabIndex={0}
      className="reviews-tab"
      data-reviews-section
    >
      {renderLiveRegion()}
      {renderHeader()}

      {isFormOpen && (
        <ReviewForm
          initialRating={draft.rating}
          initialBody={draft.body}
          isSubmitting={isSubmitting}
          serverError={serverError}
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
        />
      )}

      {/* ── Rating histogram ─────────────────────────────────────────────── */}
      <div style={{ marginTop: 16 }}>
        <RatingHistogram
          rating={localAverage}
          distribution={ratingDistribution}
        />
      </div>

      {/* ── Sort control ─────────────────────────────────────────────────── */}
      <div
        className="reviews-tab__sort-row no-print"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <label
          htmlFor="review-sort"
          style={{ fontSize: 13, color: "var(--muted)", whiteSpace: "nowrap" }}
        >
          Sort by
        </label>
        <select
          id="review-sort"
          value={reviewSort}
          onChange={(e) => setReviewSort(e.target.value as ReviewSort)}
          style={{
            fontSize: 13,
            padding: "5px 10px",
            borderRadius: 6,
            border: "1px solid var(--line)",
            background: "var(--surface-soft)",
            color: "var(--text)",
            cursor: "pointer",
          }}
        >
          <option value="newest">Newest</option>
          <option value="highest">Highest rated</option>
          <option value="lowest">Lowest rated</option>
        </select>
      </div>

      {/* ── Review cards ─────────────────────────────────────────────────── */}
      <div className="reviews-tab__list" style={{ display: "grid", gap: 16 }}>
        {sortedReviews.map((review) => (
          <article
            key={review.id}
            className="preview-card reviews-tab__card"
            style={{
              padding: 20,
              opacity: review.pending ? 0.8 : 1,
            }}
            aria-label={`Review by ${review.author}`}
            data-pending={review.pending ? "true" : undefined}
          >
            {/* Author row */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 8,
                flexWrap: "wrap",
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: 14,
                    color: "var(--text)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {review.author}
                </span>
                {review.verified && <VerifiedBadge />}
                {review.pending && <PendingBadge />}
              </div>

              {/* Rating + date */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexShrink: 0,
                }}
              >
                <StarRow rating={review.rating} />
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--muted)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {new Date(review.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>

            {/* Review body */}
            <p
              style={{
                margin: 0,
                fontSize: 14,
                lineHeight: 1.6,
                color: "var(--muted)",
              }}
            >
              {review.body}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
};

export default ReviewsTab;
