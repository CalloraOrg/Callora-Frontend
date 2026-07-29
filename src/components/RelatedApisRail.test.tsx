// @vitest-environment jsdom

/**
 * Tests for RelatedApisRail
 *
 * Covers:
 *  - Renders labelled region and heading
 *  - Returns null when no related APIs exist
 *  - Excludes the current API from results
 *  - Category match produces results
 *  - Tag match produces results
 *  - Respects limit prop
 *  - Sort order: higher score first, then higher rating
 *  - onSelect callback fires with the correct API
 *  - Default navigation (window.location.href) when onSelect is not provided
 *  - Missing optional fields (category, rating) render without error
 *
 * getRelatedApis unit tests:
 *  - Excludes current API
 *  - Score: +2 for same category
 *  - Score: +1 per shared tag
 *  - Filters out zero-score items
 *  - Sorts by score desc then rating desc
 *  - Respects limit cap
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RelatedApisRail, { getRelatedApis } from "./RelatedApisRail";
import type { APIItem } from "../data/mockApis";

// ── Factories ────────────────────────────────────────────────────────────────

function makeApi(overrides: Partial<APIItem>): APIItem {
  return {
    id: "default",
    name: "Default API",
    provider: { name: "Acme" },
    description: "A test API",
    pricePerRequest: 0.01,
    tags: [],
    ...overrides,
  };
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const current = makeApi({
  id: "current",
  name: "Current API",
  category: "Data & Analytics",
  tags: ["weather", "geo"],
  rating: 4.5,
});

const sameCategory = makeApi({
  id: "same-cat",
  name: "Same Category API",
  category: "Data & Analytics",
  tags: ["finance"],
  rating: 4.0,
  pricePerRequest: 0.005,
});

const sharedTag = makeApi({
  id: "shared-tag",
  name: "Shared Tag API",
  category: "Communication",
  tags: ["weather", "sms"],
  rating: 3.8,
  pricePerRequest: 0.002,
});

const noRelation = makeApi({
  id: "no-rel",
  name: "Unrelated API",
  category: "Payment Processing",
  tags: ["payments"],
  rating: 4.9,
  pricePerRequest: 0.001,
});

const allApis = [current, sameCategory, sharedTag, noRelation];

// ── getRelatedApis unit tests ─────────────────────────────────────────────────

describe("getRelatedApis", () => {
  it("excludes the current API", () => {
    const result = getRelatedApis(current, allApis, 10);
    expect(result.every((api) => api.id !== "current")).toBe(true);
  });

  it("includes APIs sharing the same category", () => {
    const result = getRelatedApis(current, allApis, 10);
    expect(result.map((a) => a.id)).toContain("same-cat");
  });

  it("includes APIs sharing at least one tag", () => {
    const result = getRelatedApis(current, allApis, 10);
    expect(result.map((a) => a.id)).toContain("shared-tag");
  });

  it("excludes APIs with no category or tag match", () => {
    const result = getRelatedApis(current, allApis, 10);
    expect(result.map((a) => a.id)).not.toContain("no-rel");
  });

  it("scores same-category higher than tag-only match", () => {
    const result = getRelatedApis(current, allApis, 10);
    const sameCatIdx = result.findIndex((a) => a.id === "same-cat");
    const sharedTagIdx = result.findIndex((a) => a.id === "shared-tag");
    // same-cat gets +2, shared-tag gets +1 → same-cat appears first
    expect(sameCatIdx).toBeLessThan(sharedTagIdx);
  });

  it("accumulates +1 per shared tag", () => {
    const highTagMatch = makeApi({
      id: "high-tag",
      name: "High Tag",
      category: "Other",
      tags: ["weather", "geo"], // 2 shared tags → score = 2
      rating: 1.0,
    });
    const lowTagMatch = makeApi({
      id: "low-tag",
      name: "Low Tag",
      category: "Other",
      tags: ["weather"], // 1 shared tag → score = 1
      rating: 5.0,
    });
    const result = getRelatedApis(current, [current, highTagMatch, lowTagMatch], 10);
    expect(result[0].id).toBe("high-tag");
    expect(result[1].id).toBe("low-tag");
  });

  it("breaks score ties using rating desc", () => {
    const highRating = makeApi({
      id: "high-r",
      name: "High Rating",
      category: "Data & Analytics", // same cat → score 2
      tags: [],
      rating: 4.9,
    });
    const lowRating = makeApi({
      id: "low-r",
      name: "Low Rating",
      category: "Data & Analytics", // same cat → score 2
      tags: [],
      rating: 2.0,
    });
    const result = getRelatedApis(current, [current, highRating, lowRating], 10);
    expect(result[0].id).toBe("high-r");
  });

  it("respects the limit parameter", () => {
    const result = getRelatedApis(current, allApis, 1);
    expect(result).toHaveLength(1);
  });

  it("returns empty array when no related APIs exist", () => {
    const result = getRelatedApis(current, [current, noRelation], 10);
    expect(result).toHaveLength(0);
  });

  it("handles an empty allApis array", () => {
    const result = getRelatedApis(current, [], 10);
    expect(result).toHaveLength(0);
  });

  it("handles missing tags and category gracefully", () => {
    const noFields = makeApi({ id: "bare", name: "Bare API" });
    expect(() => getRelatedApis(current, [current, noFields], 10)).not.toThrow();
  });
});

// ── RelatedApisRail component tests ──────────────────────────────────────────

describe("RelatedApisRail", () => {
  afterEach(() => cleanup());

  it("renders a labelled section and heading when related APIs exist", () => {
    render(
      <RelatedApisRail currentApi={current} allApis={allApis} />,
    );
    expect(
      screen.getByRole("region", { name: /related apis/i }),
    ).toBeTruthy();
    expect(screen.getByText("Related APIs")).toBeTruthy();
  });

  it("returns null when no related APIs are found", () => {
    const { container } = render(
      <RelatedApisRail currentApi={current} allApis={[current, noRelation]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders cards for related APIs", () => {
    render(<RelatedApisRail currentApi={current} allApis={allApis} />);
    expect(screen.getByText("Same Category API")).toBeTruthy();
    expect(screen.getByText("Shared Tag API")).toBeTruthy();
  });

  it("does NOT render a card for the current API", () => {
    render(<RelatedApisRail currentApi={current} allApis={allApis} />);
    const buttons = screen.getAllByRole("button");
    const buttonTexts = buttons.map((b) => b.textContent ?? "");
    expect(buttonTexts.some((t) => t.includes("Current API"))).toBe(false);
  });

  it("does NOT render unrelated APIs", () => {
    render(<RelatedApisRail currentApi={current} allApis={allApis} />);
    expect(screen.queryByText("Unrelated API")).toBeNull();
  });

  it("respects the limit prop", () => {
    render(
      <RelatedApisRail currentApi={current} allApis={allApis} limit={1} />,
    );
    // Only 1 card button (plus the "Browse all APIs" link)
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
  });

  it("calls onSelect with the correct API when a card is clicked", () => {
    const onSelect = vi.fn();
    render(
      <RelatedApisRail
        currentApi={current}
        allApis={allApis}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /same category api/i }),
    );
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0].id).toBe("same-cat");
  });

  it("shows the price per request on each card", () => {
    render(<RelatedApisRail currentApi={current} allApis={allApis} />);
    // sameCategory has pricePerRequest 0.005 → formatPrice → "0.005"
    expect(screen.getByText(/0\.005/)).toBeTruthy();
  });

  it("shows rating when present", () => {
    render(<RelatedApisRail currentApi={current} allApis={allApis} />);
    expect(screen.getByLabelText(/4\.0 out of 5 stars/)).toBeTruthy();
  });

  it("renders without error when category is absent", () => {
    const noCategory = makeApi({
      id: "no-cat",
      name: "No Category API",
      tags: ["weather"], // shared tag → shows up
    });
    expect(() =>
      render(<RelatedApisRail currentApi={current} allApis={[current, noCategory]} />),
    ).not.toThrow();
  });

  it("renders without error when rating is absent", () => {
    const noRating = makeApi({
      id: "no-rating",
      name: "No Rating API",
      category: "Data & Analytics", // same category
      rating: undefined,
    });
    expect(() =>
      render(
        <RelatedApisRail currentApi={current} allApis={[current, noRating]} />,
      ),
    ).not.toThrow();
    expect(screen.getByText("No Rating API")).toBeTruthy();
  });

  it("each card has a descriptive aria-label", () => {
    render(<RelatedApisRail currentApi={current} allApis={allApis} />);
    expect(
      screen.getByRole("button", {
        name: /view details for same category api by acme/i,
      }),
    ).toBeTruthy();
  });

  it("renders a 'Browse all APIs' footer link", () => {
    render(<RelatedApisRail currentApi={current} allApis={allApis} />);
    expect(
      screen.getByRole("link", { name: /browse all apis/i }),
    ).toBeTruthy();
  });

  describe("navigation behaviour without onSelect", () => {
    beforeEach(() => {
      // jsdom does not fully implement navigation; stub assignment
      Object.defineProperty(window, "location", {
        value: { href: "" },
        writable: true,
      });
    });

    it("sets window.location.href when onSelect is not provided", () => {
      render(<RelatedApisRail currentApi={current} allApis={allApis} />);
      fireEvent.click(
        screen.getByRole("button", { name: /same category api/i }),
      );
      expect(window.location.href).toBe("/details/same-cat");
    });
  });
});
