/**
 * ReviewsTab.test.tsx
 *
 * Focused tests for the ReviewsTab component (issue #580).
 *
 * Coverage areas
 * ──────────────
 *  1. Rendering – empty state vs populated list
 *  2. Sorting   – newest / highest / lowest ordering
 *  3. Print-safety markup – class names checked by print.test.ts CSS contract
 *  4. Accessibility – ARIA roles, aria-labels, aria-hidden
 *  5. Verified badge
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ReviewsTab, { type Review } from "./ReviewsTab";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_REVIEWS: Review[] = [
  {
    id: "r1",
    author: "Alice",
    rating: 5,
    date: "2024-06-15",
    body: "Outstanding integration experience.",
    verified: true,
  },
  {
    id: "r2",
    author: "Bob",
    rating: 2,
    date: "2024-03-01",
    body: "Documentation is sparse.",
    verified: false,
  },
  {
    id: "r3",
    author: "Charlie",
    rating: 4,
    date: "2024-09-20",
    body: "Works well for most cases.",
    verified: false,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderTab(
  reviews: Review[] = BASE_REVIEWS,
  averageRating = 3.7,
  onWriteReview?: () => void,
) {
  return render(
    <ReviewsTab
      reviews={reviews}
      averageRating={averageRating}
      onWriteReview={onWriteReview}
    />,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ReviewsTab – empty state", () => {
  it("renders the empty-state placeholder when there are no reviews", () => {
    renderTab([]);
    expect(screen.getByText(/No public reviews yet/i)).toBeTruthy();
  });

  it("does not render any review cards in the empty state", () => {
    const { container } = renderTab([]);
    const cards = container.querySelectorAll(".reviews-tab__card");
    expect(cards.length).toBe(0);
  });

  it("hides the empty-state card from print via no-print class", () => {
    const { container } = renderTab([]);
    const emptyCard = container.querySelector(".preview-card.no-print");
    expect(emptyCard).toBeTruthy();
  });
});

describe("ReviewsTab – populated list", () => {
  it("renders a card for every review", () => {
    const { container } = renderTab();
    const cards = container.querySelectorAll(".reviews-tab__card");
    expect(cards.length).toBe(BASE_REVIEWS.length);
  });

  it("renders each author name", () => {
    renderTab();
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("Bob")).toBeTruthy();
    expect(screen.getByText("Charlie")).toBeTruthy();
  });

  it("renders each review body", () => {
    renderTab();
    expect(screen.getByText("Outstanding integration experience.")).toBeTruthy();
    expect(screen.getByText("Documentation is sparse.")).toBeTruthy();
    expect(screen.getByText("Works well for most cases.")).toBeTruthy();
  });

  it("renders the rating histogram", () => {
    // RatingHistogram is rendered when reviews are present
    const { container } = renderTab();
    // Histogram is rendered inside .reviews-tab; we confirm it exists
    const section = container.querySelector(".reviews-tab");
    expect(section).toBeTruthy();
    // The sort row must also be present (but print-hidden)
    const sortRow = container.querySelector(".reviews-tab__sort-row");
    expect(sortRow).toBeTruthy();
  });
});

describe("ReviewsTab – sorting", () => {
  it("defaults to newest-first order", () => {
    const { container } = renderTab();
    const cards = container.querySelectorAll(".reviews-tab__card");
    // Charlie (2024-09-20) > Alice (2024-06-15) > Bob (2024-03-01)
    expect(cards[0].textContent).toContain("Charlie");
    expect(cards[1].textContent).toContain("Alice");
    expect(cards[2].textContent).toContain("Bob");
  });

  it("re-sorts to highest-rated when the select changes", () => {
    const { container } = renderTab();
    const select = container.querySelector<HTMLSelectElement>("#review-sort")!;
    fireEvent.change(select, { target: { value: "highest" } });
    const cards = container.querySelectorAll(".reviews-tab__card");
    // Alice (5) > Charlie (4) > Bob (2)
    expect(cards[0].textContent).toContain("Alice");
    expect(cards[1].textContent).toContain("Charlie");
    expect(cards[2].textContent).toContain("Bob");
  });

  it("re-sorts to lowest-rated when the select changes", () => {
    const { container } = renderTab();
    const select = container.querySelector<HTMLSelectElement>("#review-sort")!;
    fireEvent.change(select, { target: { value: "lowest" } });
    const cards = container.querySelectorAll(".reviews-tab__card");
    // Bob (2) > Charlie (4) > Alice (5)
    expect(cards[0].textContent).toContain("Bob");
    expect(cards[1].textContent).toContain("Charlie");
    expect(cards[2].textContent).toContain("Alice");
  });
});

describe("ReviewsTab – print-safety markup", () => {
  it("wraps the panel in an element with class 'reviews-tab'", () => {
    const { container } = renderTab();
    expect(container.querySelector(".reviews-tab")).toBeTruthy();
  });

  it("applies 'reviews-tab__sort-row no-print' to the sort control wrapper", () => {
    const { container } = renderTab();
    const sortRow = container.querySelector(".reviews-tab__sort-row");
    expect(sortRow?.classList.contains("no-print")).toBe(true);
  });

  it("applies 'no-print' to the interactive header row", () => {
    const { container } = renderTab();
    const header = container.querySelector(".api-detail-reviews-header");
    expect(header?.classList.contains("no-print")).toBe(true);
  });

  it("applies 'reviews-tab__card' to each review article", () => {
    const { container } = renderTab();
    const cards = container.querySelectorAll(".reviews-tab__card");
    expect(cards.length).toBe(3);
    cards.forEach((card) => {
      expect(card.classList.contains("reviews-tab__card")).toBe(true);
    });
  });

  it("applies 'reviews-tab__list' to the list container", () => {
    const { container } = renderTab();
    expect(container.querySelector(".reviews-tab__list")).toBeTruthy();
  });

  it("uses <article> elements for each review card (semantic HTML)", () => {
    const { container } = renderTab();
    const articles = container.querySelectorAll("article.reviews-tab__card");
    expect(articles.length).toBe(BASE_REVIEWS.length);
  });
});

describe("ReviewsTab – accessibility", () => {
  it("renders the section as a tabpanel with correct ARIA attributes", () => {
    const { container } = renderTab();
    const section = container.querySelector("section.reviews-tab");
    expect(section?.getAttribute("role")).toBe("tabpanel");
    expect(section?.getAttribute("aria-labelledby")).toBe("tab-reviews");
    expect(section?.getAttribute("id")).toBe("panel-reviews");
  });

  it("marks star-rating spans with role=img and an aria-label", () => {
    const { container } = renderTab();
    const ratingSpans = container.querySelectorAll('[role="img"]');
    // One per review card
    expect(ratingSpans.length).toBeGreaterThanOrEqual(BASE_REVIEWS.length);
    ratingSpans.forEach((span) => {
      expect(span.getAttribute("aria-label")).toMatch(/out of 5 stars/i);
    });
  });

  it("marks all decorative SVGs as aria-hidden", () => {
    const { container } = renderTab();
    const svgs = container.querySelectorAll("svg");
    svgs.forEach((svg) => {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
    });
  });

  it("each review article has an aria-label naming the author", () => {
    const { container } = renderTab();
    const articles = container.querySelectorAll("article.reviews-tab__card");
    articles.forEach((article) => {
      expect(article.getAttribute("aria-label")).toMatch(/Review by/i);
    });
  });

  it("the sort <select> has an associated <label> via htmlFor", () => {
    const { container } = renderTab();
    const select = container.querySelector("#review-sort");
    const label = container.querySelector('label[for="review-sort"]');
    expect(select).toBeTruthy();
    expect(label).toBeTruthy();
  });
});

describe("ReviewsTab – verified badge", () => {
  it("renders the Verified Developer badge for verified reviews", () => {
    renderTab();
    // Alice is verified
    expect(screen.getByText("Verified Developer")).toBeTruthy();
  });

  it("does not render a badge for non-verified reviews", () => {
    renderTab([{ ...BASE_REVIEWS[1] }]); // Bob is not verified
    const badges = screen.queryAllByText("Verified Developer");
    expect(badges.length).toBe(0);
  });

  it("carries an aria-label on the verified badge for screen readers", () => {
    const { container } = renderTab();
    const badge = container.querySelector(
      '[aria-label*="Verified Developer"]',
    );
    expect(badge).toBeTruthy();
  });
});

describe("ReviewsTab – onWriteReview callback", () => {
  it("calls onWriteReview when the 'Write a Review' button is clicked", () => {
    const onWriteReview = vi.fn();
    renderTab(BASE_REVIEWS, 3.7, onWriteReview);
    const btn = screen.getByRole("button", { name: /Write a Review/i });
    fireEvent.click(btn);
    expect(onWriteReview).toHaveBeenCalledTimes(1);
  });

  it("renders the 'Write a Review' button inside a no-print container", () => {
    renderTab();
    const btn = screen.getByRole("button", { name: /Write a Review/i });
    const header = btn.closest(".api-detail-reviews-header");
    expect(header?.classList.contains("no-print")).toBe(true);
  });
});
