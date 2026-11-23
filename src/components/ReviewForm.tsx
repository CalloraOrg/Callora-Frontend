import React, { useState, useRef, useEffect, useId } from "react";
import StarRating from "./StarRating";

export const MIN_REVIEW_LENGTH = 10;
export const MAX_REVIEW_LENGTH = 1000;

export interface ReviewDraft {
  rating: number;
  body: string;
}

export interface ReviewFormProps {
  /** Initial rating (e.g. restored draft after failed submission). */
  initialRating?: number;
  /** Initial review text (e.g. restored draft after failed submission). */
  initialBody?: string;
  /** Whether a submission is currently in flight. */
  isSubmitting?: boolean;
  /** Optional server-side error message to display. */
  serverError?: string | null;
  /** Optional status announcement (e.g. success) for the live region. */
  statusMessage?: string | null;
  /** Called with validated rating & trimmed body. */
  onSubmit: (draft: ReviewDraft) => void | Promise<void>;
  /** Called when the user cancels or presses Escape. */
  onCancel: () => void;
}

export default function ReviewForm({
  initialRating = 0,
  initialBody = "",
  isSubmitting = false,
  serverError = null,
  statusMessage = null,
  onSubmit,
  onCancel,
}: ReviewFormProps) {
  const [rating, setRating] = useState<number>(initialRating);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [body, setBody] = useState<string>(initialBody);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [localSubmitting, setLocalSubmitting] = useState(false);

  const submittingRef = useRef(false);
  const starRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const formId = useId();
  const ratingLabelId = `${formId}-rating-label`;
  const ratingErrorId = `${formId}-rating-error`;
  const bodyId = `${formId}-body`;
  const bodyErrorId = `${formId}-body-error`;
  const bodyCounterId = `${formId}-body-counter`;

  const busy = isSubmitting || localSubmitting;

  // Sync draft when restored externally (e.g. after rollback)
  useEffect(() => {
    setRating(initialRating);
  }, [initialRating]);

  useEffect(() => {
    setBody(initialBody);
  }, [initialBody]);

  // Focus first star button on mount for keyboard accessibility
  useEffect(() => {
    const targetIdx = initialRating >= 1 && initialRating <= 5 ? initialRating - 1 : 0;
    starRefs.current[targetIdx]?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === "Escape" && !busy) {
      e.preventDefault();
      onCancel();
    }
  };

  const handleStarKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    starValue: number,
  ) => {
    if (busy) return;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      next = Math.min(5, starValue + 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      next = Math.max(1, starValue - 1);
    } else if (e.key === "Home") {
      next = 1;
    } else if (e.key === "End") {
      next = 5;
    }

    if (next !== null) {
      e.preventDefault();
      setRating(next);
      setRatingError(null);
      starRefs.current[next - 1]?.focus();
    }
  };

  const validate = (): boolean => {
    let valid = true;
    const trimmed = body.trim();

    if (rating < 1 || rating > 5) {
      setRatingError("Please select a star rating between 1 and 5.");
      valid = false;
    } else {
      setRatingError(null);
    }

    if (trimmed.length === 0) {
      setBodyError("Please write a review before submitting.");
      valid = false;
    } else if (trimmed.length < MIN_REVIEW_LENGTH) {
      setBodyError(
        `Review must be at least ${MIN_REVIEW_LENGTH} characters (currently ${trimmed.length}).`,
      );
      valid = false;
    } else if (trimmed.length > MAX_REVIEW_LENGTH) {
      setBodyError(
        `Review must be ${MAX_REVIEW_LENGTH} characters or fewer (currently ${trimmed.length}).`,
      );
      valid = false;
    } else {
      setBodyError(null);
    }

    if (!valid) {
      if (rating < 1 || rating > 5) {
        starRefs.current[0]?.focus();
      } else {
        textareaRef.current?.focus();
      }
    }

    return valid;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy || submittingRef.current) return;
    if (!validate()) return;

    submittingRef.current = true;
    setLocalSubmitting(true);
    try {
      await onSubmit({ rating, body: body.trim() });
    } finally {
      submittingRef.current = false;
      setLocalSubmitting(false);
    }
  };

  const activeRating = hoverRating || rating;
  const trimmedLength = body.trim().length;
  const isOverLimit = trimmedLength > MAX_REVIEW_LENGTH;

  const liveAnnouncement =
    serverError ||
    ratingError ||
    bodyError ||
    statusMessage ||
    "";

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      noValidate
      className="preview-card review-form no-print"
      aria-label="Write a review"
      style={{
        padding: 20,
        marginTop: 16,
        marginBottom: 16,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {/* Live region for screen-reader announcements */}
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
        {liveAnnouncement}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h4 style={{ margin: 0, fontSize: 16 }}>Write a Review</h4>
        {activeRating > 0 && (
          <StarRating value={activeRating} decimals={1} />
        )}
      </div>

      {/* Star rating selector */}
      <div>
        <span
          id={ratingLabelId}
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 6,
            color: "var(--text)",
          }}
        >
          Rating <span aria-hidden="true">*</span>
        </span>
        <div
          role="radiogroup"
          aria-labelledby={ratingLabelId}
          aria-describedby={ratingError ? ratingErrorId : undefined}
          aria-invalid={ratingError ? "true" : undefined}
          style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
          onMouseLeave={() => setHoverRating(0)}
        >
          {[1, 2, 3, 4, 5].map((star) => {
            const selected = rating === star;
            const filled = star <= activeRating;
            const tabIndex =
              rating === 0 ? (star === 1 ? 0 : -1) : selected ? 0 : -1;

            return (
              <button
                key={star}
                ref={(el) => {
                  starRefs.current[star - 1] = el;
                }}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`${star} ${star === 1 ? "star" : "stars"}`}
                tabIndex={tabIndex}
                disabled={busy}
                onClick={() => {
                  setRating(star);
                  setRatingError(null);
                }}
                onMouseEnter={() => setHoverRating(star)}
                onKeyDown={(e) => handleStarKeyDown(e, star)}
                style={{
                  background: "transparent",
                  border: "1px solid transparent",
                  borderRadius: 6,
                  padding: "4px 6px",
                  fontSize: 22,
                  lineHeight: 1,
                  cursor: busy ? "not-allowed" : "pointer",
                  color: filled ? "var(--rating-color, #f59e0b)" : "var(--line, #94a3b8)",
                }}
              >
                <span aria-hidden="true">{filled ? "★" : "☆"}</span>
              </button>
            );
          })}
        </div>
        {ratingError && (
          <p
            id={ratingErrorId}
            role="alert"
            style={{
              margin: "6px 0 0",
              fontSize: 12,
              color: "var(--danger, #ef4444)",
            }}
          >
            {ratingError}
          </p>
        )}
      </div>

      {/* Review text */}
      <div>
        <label
          htmlFor={bodyId}
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 6,
            color: "var(--text)",
          }}
        >
          Your review <span aria-hidden="true">*</span>
        </label>
        <textarea
          ref={textareaRef}
          id={bodyId}
          value={body}
          disabled={busy}
          rows={4}
          placeholder="Share your experience with this API's reliability, documentation, and performance..."
          aria-invalid={bodyError ? "true" : undefined}
          aria-describedby={
            bodyError ? `${bodyErrorId} ${bodyCounterId}` : bodyCounterId
          }
          onChange={(e) => {
            setBody(e.target.value);
            if (bodyError) setBodyError(null);
          }}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "10px 12px",
            borderRadius: 8,
            border: `1px solid ${bodyError || isOverLimit ? "var(--danger, #ef4444)" : "var(--line)"}`,
            background: "var(--surface-soft)",
            color: "var(--text)",
            fontSize: 14,
            lineHeight: 1.5,
            resize: "vertical",
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
            marginTop: 4,
            fontSize: 12,
          }}
        >
          <span
            id={bodyCounterId}
            style={{
              color: isOverLimit ? "var(--danger, #ef4444)" : "var(--muted)",
            }}
          >
            {trimmedLength} / {MAX_REVIEW_LENGTH} characters (min {MIN_REVIEW_LENGTH})
          </span>
        </div>
        {bodyError && (
          <p
            id={bodyErrorId}
            role="alert"
            style={{
              margin: "6px 0 0",
              fontSize: 12,
              color: "var(--danger, #ef4444)",
            }}
          >
            {bodyError}
          </p>
        )}
      </div>

      {/* Server error banner */}
      {serverError && (
        <div
          role="alert"
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            fontSize: 13,
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.35)",
            color: "var(--danger, #ef4444)",
          }}
        >
          {serverError}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button
          type="button"
          className="secondary-button"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="primary-button"
          disabled={busy}
          aria-busy={busy ? "true" : undefined}
        >
          {busy ? "Submitting..." : "Submit Review"}
        </button>
      </div>
    </form>
  );
}
