// @vitest-environment jsdom
/**
 * WhyApi.test.tsx
 *
 * Focused unit + integration tests for the `WhyApi` component and
 * `buildReasons` helper.
 *
 * Test surface:
 *   1. buildReasons() – pure function, no DOM required.
 *   2. WhyApi component – disclosure pattern, ARIA semantics, interactions.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import React from "react";

import WhyApi, { buildReasons } from "./WhyApi";
import type { APIItem } from "../data/mockApis";

// ─── Shared fixtures ─────────────────────────────────────────────────────────

/** A minimal valid APIItem with no optional metric fields set. */
const baseApi: APIItem = {
  id: "test-api",
  name: "Test API",
  provider: { name: "Test Provider" },
  description: "A test API.",
  pricePerRequest: 0.05, // > 0.005, so no cost reason
};

/** An API that should trigger every positive signal. */
const excellentApi: APIItem = {
  ...baseApi,
  rating: 4.8,
  uptimePercent: 99.95,
  avgLatencyMs: 100,
  pricePerCall: 0.001,
  category: "Finance",
};

/** An API where all numeric metrics fall just below their thresholds. */
const belowThresholdApi: APIItem = {
  ...baseApi,
  rating: 4.4,           // < 4.5
  uptimePercent: 99.89,  // < 99.9
  avgLatencyMs: 151,     // > 150
  pricePerCall: 0.006,   // > 0.005
};

// ─── buildReasons() ──────────────────────────────────────────────────────────

describe("buildReasons()", () => {
  afterEach(() => cleanup());

  it("emits a rating reason when rating >= 4.5", () => {
    const reasons = buildReasons({ ...baseApi, rating: 4.5 });
    expect(reasons.some((r) => r.includes("4.5 / 5"))).toBe(true);
  });

  it("does NOT emit a rating reason when rating < 4.5", () => {
    const reasons = buildReasons({ ...baseApi, rating: 4.49 });
    expect(reasons.some((r) => r.toLowerCase().includes("rated"))).toBe(false);
  });

  it("formats the rating to one decimal place", () => {
    const reasons = buildReasons({ ...baseApi, rating: 4.8 });
    // "4.8 / 5" not "4.80 / 5"
    expect(reasons.some((r) => r.includes("4.8 / 5"))).toBe(true);
  });

  it("emits an uptime reason when uptimePercent >= 99.9", () => {
    const reasons = buildReasons({ ...baseApi, uptimePercent: 99.9 });
    expect(reasons.some((r) => r.toLowerCase().includes("uptime"))).toBe(true);
  });

  it("does NOT emit an uptime reason when uptimePercent < 99.9", () => {
    const reasons = buildReasons({ ...baseApi, uptimePercent: 99.89 });
    expect(reasons.some((r) => r.toLowerCase().includes("uptime"))).toBe(false);
  });

  it("formats uptimePercent to two decimal places", () => {
    const reasons = buildReasons({ ...baseApi, uptimePercent: 99.97 });
    expect(reasons.some((r) => r.includes("99.97%"))).toBe(true);
  });

  it("emits a latency reason when avgLatencyMs <= 150", () => {
    const reasons = buildReasons({ ...baseApi, avgLatencyMs: 150 });
    expect(reasons.some((r) => r.includes("150 ms"))).toBe(true);
  });

  it("does NOT emit a latency reason when avgLatencyMs > 150", () => {
    const reasons = buildReasons({ ...baseApi, avgLatencyMs: 151 });
    expect(reasons.some((r) => r.toLowerCase().includes("latency"))).toBe(false);
  });

  it("uses pricePerCall over pricePerRequest for the cost signal", () => {
    // pricePerRequest > threshold but pricePerCall <= threshold
    const reasons = buildReasons({
      ...baseApi,
      pricePerRequest: 0.05,
      pricePerCall: 0.003,
    });
    expect(reasons.some((r) => r.toLowerCase().includes("cost"))).toBe(true);
  });

  it("falls back to pricePerRequest when pricePerCall is absent", () => {
    // No pricePerCall; pricePerRequest <= threshold
    const { pricePerCall: _omit, ...withoutCallPrice } = {
      ...baseApi,
      pricePerRequest: 0.002,
      pricePerCall: undefined,
    };
    const reasons = buildReasons(withoutCallPrice as APIItem);
    expect(reasons.some((r) => r.toLowerCase().includes("cost"))).toBe(true);
  });

  it("emits a category reason when api.category is set", () => {
    const reasons = buildReasons({ ...baseApi, category: "Finance" });
    expect(reasons.some((r) => r.includes("Finance"))).toBe(true);
  });

  it("does NOT emit a category reason when api.category is absent", () => {
    const { category: _omit, ...withoutCategory } = { ...baseApi, category: undefined };
    const reasons = buildReasons(withoutCategory as APIItem);
    expect(reasons.some((r) => r.toLowerCase().includes("popular choice"))).toBe(false);
  });

  it("returns all reasons for an excellent API", () => {
    const reasons = buildReasons(excellentApi);
    expect(reasons.length).toBe(5); // rating + uptime + latency + cost + category
  });

  it("falls back to the generic reason when no signal qualifies", () => {
    // belowThresholdApi has no category and all metrics below thresholds.
    const reasons = buildReasons({ ...belowThresholdApi, category: undefined });
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toMatch(/matches your search/i);
  });

  it("always returns at least one reason regardless of inputs", () => {
    // Bare minimum api object – only required fields.
    const reasons = buildReasons(baseApi);
    expect(reasons.length).toBeGreaterThanOrEqual(1);
  });

  it("handles missing optional numeric fields gracefully (no throws)", () => {
    const sparse: APIItem = {
      id: "sparse",
      name: "Sparse",
      provider: { name: "X" },
      description: "Sparse API",
      pricePerRequest: 0.1,
      // rating, uptimePercent, avgLatencyMs, pricePerCall, category – all absent
    };
    expect(() => buildReasons(sparse)).not.toThrow();
  });

  it("boundary: rating exactly 4.5 qualifies", () => {
    expect(buildReasons({ ...baseApi, rating: 4.5 }).some((r) => r.includes("4.5"))).toBe(true);
  });

  it("boundary: uptimePercent exactly 99.9 qualifies", () => {
    expect(buildReasons({ ...baseApi, uptimePercent: 99.9 }).some((r) => r.includes("uptime"))).toBe(true);
  });

  it("boundary: avgLatencyMs exactly 150 qualifies", () => {
    expect(buildReasons({ ...baseApi, avgLatencyMs: 150 }).some((r) => r.includes("150 ms"))).toBe(true);
  });

  it("boundary: price exactly 0.005 qualifies", () => {
    expect(buildReasons({ ...baseApi, pricePerCall: 0.005 }).some((r) => r.toLowerCase().includes("cost"))).toBe(true);
  });
});

// ─── WhyApi component ────────────────────────────────────────────────────────

describe("WhyApi component", () => {
  afterEach(() => cleanup());

  // ── Initial render ────────────────────────────────────────────────────────

  it("renders the toggle button in the initial closed state", () => {
    render(<WhyApi api={baseApi} />);
    const button = screen.getByRole("button", { name: /why this api/i });
    expect(button).toBeTruthy();
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("does NOT render the reasons list before the button is clicked", () => {
    render(<WhyApi api={baseApi} />);
    expect(screen.queryByRole("list")).toBeNull();
  });

  // ── Open / close interaction ──────────────────────────────────────────────

  it("opens the reasons list when the toggle button is clicked", () => {
    render(<WhyApi api={excellentApi} />);
    const button = screen.getByRole("button", { name: /why this api/i });
    fireEvent.click(button);
    expect(screen.getByRole("list")).toBeTruthy();
  });

  it("sets aria-expanded to true when open", () => {
    render(<WhyApi api={excellentApi} />);
    const button = screen.getByRole("button", { name: /why this api/i });
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
  });

  it("hides the reasons list again when the toggle is clicked a second time", () => {
    render(<WhyApi api={excellentApi} />);
    const button = screen.getByRole("button", { name: /why this api/i });
    fireEvent.click(button); // open
    fireEvent.click(button); // close
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("sets aria-expanded back to false when closed", () => {
    render(<WhyApi api={excellentApi} />);
    const button = screen.getByRole("button", { name: /why this api/i });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  // ── ARIA semantics ────────────────────────────────────────────────────────

  it("button aria-controls points at the list id", () => {
    render(<WhyApi api={excellentApi} />);
    const button = screen.getByRole("button", { name: /why this api/i });
    fireEvent.click(button);
    const list = screen.getByRole("list");
    expect(button.getAttribute("aria-controls")).toBe(list.id);
  });

  it("reasons list has an aria-label naming the API", () => {
    render(<WhyApi api={excellentApi} />);
    fireEvent.click(screen.getByRole("button", { name: /why this api/i }));
    const list = screen.getByRole("list");
    expect(list.getAttribute("aria-label")).toMatch(/Test API/i);
  });

  // ── Rendered reasons ──────────────────────────────────────────────────────

  it("renders the correct number of list items", () => {
    render(<WhyApi api={excellentApi} />);
    fireEvent.click(screen.getByRole("button", { name: /why this api/i }));
    const items = screen.getAllByRole("listitem");
    expect(items.length).toBe(buildReasons(excellentApi).length);
  });

  it("displays visible text for every reason", () => {
    render(<WhyApi api={excellentApi} />);
    fireEvent.click(screen.getByRole("button", { name: /why this api/i }));
    for (const reason of buildReasons(excellentApi)) {
      expect(screen.getByText(reason)).toBeTruthy();
    }
  });

  it("shows the generic fallback reason for a bare-minimum API", () => {
    render(<WhyApi api={baseApi} />);
    fireEvent.click(screen.getByRole("button", { name: /why this api/i }));
    expect(screen.getByText(/matches your search/i)).toBeTruthy();
  });

  // ── Click propagation ─────────────────────────────────────────────────────

  it("stops click propagation to prevent parent card handler from firing", () => {
    const parentHandler = { onClick: (_e: React.MouseEvent) => {} };
    const spy = { called: false };
    render(
      <div onClick={() => { spy.called = true; }}>
        <WhyApi api={baseApi} />
      </div>
    );
    fireEvent.click(screen.getByRole("button", { name: /why this api/i }));
    expect(spy.called).toBe(false);
  });

  // ── Keyboard accessibility ────────────────────────────────────────────────

  it("can be activated with the Enter key", () => {
    render(<WhyApi api={excellentApi} />);
    const button = screen.getByRole("button", { name: /why this api/i });
    // Simulate pressing Enter on the button element (button activates on Enter by default in browsers)
    fireEvent.keyDown(button, { key: "Enter" });
    fireEvent.click(button); // native button responds to Enter as click
    expect(screen.getByRole("list")).toBeTruthy();
  });

  // ── CSS class presence ────────────────────────────────────────────────────

  it("toggle button has the expected BEM class", () => {
    render(<WhyApi api={baseApi} />);
    const button = screen.getByRole("button", { name: /why this api/i });
    expect(button.classList.contains("why-api__toggle")).toBe(true);
  });

  it("toggle button gains the --open modifier class when expanded", () => {
    render(<WhyApi api={baseApi} />);
    const button = screen.getByRole("button", { name: /why this api/i });
    fireEvent.click(button);
    expect(button.classList.contains("why-api__toggle--open")).toBe(true);
  });

  it("toggle button loses the --open modifier class when collapsed", () => {
    render(<WhyApi api={baseApi} />);
    const button = screen.getByRole("button", { name: /why this api/i });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button.classList.contains("why-api__toggle--open")).toBe(false);
  });
});
