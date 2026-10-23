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

import React, { useState, useMemo } from "react";
import RatingHistogram from "../components/RatingHistogram";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Review {
  id: string;
  author: string;
  rating: number;
  date: string;
  body: string;
  verified?: boolean;
}

type ReviewSort = "newest" | "highest" | "lowest";

export interface ReviewsTabProps {
  /** All reviews for the current API, unsorted. */
  reviews: Review[];
  /** Pre-computed average rating (0–5). */
  averageRating: number;
  /** Callback for the "Write a Review" button.  No-op by default. */
  onWriteReview?: () => void;
}

// ── Helper: star row ──────────────────────────────────────────────────────────

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

// ── Helper: verified badge ────────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * ReviewsTab renders the developer-feedback panel for an API detail page.
 *
 * Print-safe design
 * ─────────────────
 * Elements that carry `no-print` are suppressed in `@media print`.
 * The sort control, action button, and empty-state CTA use this class.
 * Everything else (histogram, review cards, text) prints as-is.
 *
 * The outer `<section>` carries the class `reviews-tab` which the print
 * stylesheet uses to:
 *   1. Insert a decorative heading via `::before` (see print.css).
 *   2. Force all `.reviews-tab__card` children to `break-inside: avoid`.
 */
const ReviewsTab: React.FC<ReviewsTabProps> = ({
  reviews,
  averageRating,
  onWriteReview,
}) => {
  const [reviewSort, setReviewSort] = useState<ReviewSort>("newest");

  // Derive rating distribution for the histogram
  const ratingDistribution = useMemo<Record<number, number> | undefined>(() => {
    if (reviews.length === 0) return undefined;
    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((r) => {
      const star = Math.min(5, Math.max(1, Math.round(r.rating)));
      dist[star] = (dist[star] ?? 0) + 1;
    });
    return dist;
  }, [reviews]);

  // Stable sort – returns a new array so the original prop is never mutated
  const sortedReviews = useMemo(() => {
    return [...reviews].sort((a, b) => {
      if (reviewSort === "highest") return b.rating - a.rating;
      if (reviewSort === "lowest") return a.rating - b.rating;
      // "newest" – fall back to lexicographic ISO-date comparison
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [reviews, reviewSort]);

  // ── Empty state ────────────────────────────────────────────────────────────

  if (reviews.length === 0) {
    return (
      <section
        id="panel-reviews"
        role="tabpanel"
        aria-labelledby="tab-reviews"
        tabIndex={0}
        className="reviews-tab"
      >
        {/* Header: hidden when printing (no reviews = nothing to print) */}
        <div className="api-detail-reviews-header no-print">
          <h3 style={{ margin: 0 }}>Developer Feedback</h3>
          <button
            type="button"
            className="secondary-button no-print"
            onClick={onWriteReview}
          >
            Write a Review
          </button>
        </div>

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
    >
      {/* ── Section header ──────────────────────────────────────────────── */}
      {/*
       * The entire header row (title + CTA button) is hidden when printing.
       * The print stylesheet inserts a plain text heading via CSS ::before on
       * .reviews-tab so the printed page still has a visible section label.
       */}
      <div className="api-detail-reviews-header no-print">
        <h3 style={{ margin: 0 }}>Developer Feedback</h3>
        <button
          type="button"
          className="secondary-button"
          onClick={onWriteReview}
        >
          Write a Review
        </button>
      </div>

      {/* ── Rating histogram ─────────────────────────────────────────────── */}
      {/*
       * The histogram is intentionally left printable so readers can see the
       * rating distribution without needing access to the live page.
       */}
      <div style={{ marginTop: 16 }}>
        <RatingHistogram
          rating={averageRating}
          distribution={ratingDistribution}
        />
      </div>

      {/* ── Sort control ─────────────────────────────────────────────────── */}
      {/*
       * The sort <select> is interactive-only chrome; it is hidden in print
       * via `no-print`.  On screen it sits inside `.reviews-tab__sort-row`
       * which the print stylesheet also targets with `display: none` for extra
       * specificity.
       */}
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
      {/*
       * Each card carries `.reviews-tab__card` so the print stylesheet can
       * apply `break-inside: avoid` and force a white background with a
       * visible border for readability on paper.
       */}
      <div className="reviews-tab__list" style={{ display: "grid", gap: 16 }}>
        {sortedReviews.map((review) => (
          <article
            key={review.id}
            className="preview-card reviews-tab__card"
            style={{ padding: 20 }}
            aria-label={`Review by ${review.author}`}
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
