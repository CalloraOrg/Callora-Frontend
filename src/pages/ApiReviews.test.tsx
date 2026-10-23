import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ApiReviews from "./ApiReviews";

describe("ApiReviews", () => {
  it("renders the real reviews empty state", () => {
    render(<ApiReviews />);
    expect(screen.getByText("No public reviews yet")).toBeInTheDocument();
  });

  it("forwards review data and the write callback", () => {
    const onWriteReview = vi.fn();
    render(<ApiReviews reviews={[{ id: "r1", author: "Ada", rating: 5, date: "2026-01-01", body: "Great" }]} averageRating={5} onWriteReview={onWriteReview} />);
    expect(screen.getByText("Ada")).toBeInTheDocument();
    screen.getByRole("button", { name: /write a review/i }).click();
    expect(onWriteReview).toHaveBeenCalledOnce();
  });
});
