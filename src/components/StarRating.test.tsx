// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import StarRating, { formatRating } from "./StarRating";

describe("formatRating", () => {
  afterEach(() => cleanup());

  it("pads whole numbers to one decimal by default", () => {
    expect(formatRating(4)).toBe("4.0");
    expect(formatRating(5)).toBe("5.0");
  });

  it("rounds half-up consistently", () => {
    expect(formatRating(4.25, 1)).toBe("4.3");
    expect(formatRating(4.24, 1)).toBe("4.2");
  });

  it("supports a 0-decimal display", () => {
    expect(formatRating(4.6, 0)).toBe("5");
    expect(formatRating(4.4, 0)).toBe("4");
  });

  it("clamps out-of-range values to 0–5", () => {
    expect(formatRating(-2)).toBe("0.0");
    expect(formatRating(9)).toBe("5.0");
  });

  it("treats non-finite input as 0", () => {
    expect(formatRating(NaN)).toBe("0.0");
    expect(formatRating(Infinity)).toBe("0.0");
  });
});

describe("StarRating", () => {
  afterEach(() => cleanup());

  it("renders an accessible label with the padded value", () => {
    render(<StarRating value={4} />);
    expect(screen.getByRole("img", { name: "Rated 4.0 out of 5" })).toBeTruthy();
  });

  it("shows the padded number in the visible label", () => {
    render(<StarRating value={4.6} />);
    expect(screen.getByText("4.6")).toBeTruthy();
  });

  it("can hide the numeric label", () => {
    render(<StarRating value={4.6} hideNumber />);
    expect(screen.queryByText("4.6")).toBeNull();
  });
});
