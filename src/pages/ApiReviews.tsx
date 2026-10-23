import React from "react";

import ReviewsTab, { type Review } from "./ReviewsTab";

export interface ApiReviewsProps {
  reviews?: Review[];
  averageRating?: number;
  onWriteReview?: () => void;
}

/** Compatibility wrapper for callers of the old page name. */
export const ApiReviews: React.FC<ApiReviewsProps> = ({
  reviews = [],
  averageRating = 0,
  onWriteReview,
}) => (
  <ReviewsTab
    reviews={reviews}
    averageRating={averageRating}
    onWriteReview={onWriteReview}
  />
);

export default ApiReviews;
