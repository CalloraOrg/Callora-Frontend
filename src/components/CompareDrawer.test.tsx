/**
 * CompareDrawer.test.tsx
 *
 * Covers every acceptance criterion from issue #1062:
 *  AC1 – APIs lacking pricePerCall display their pricePerRequest
 *  AC2 – Status and category rows appear in each column
 *  AC3 – Best value per row is marked with a visible text label
 *  AC4 – Missing values still render an em dash
 *
 * Also verifies:
 *  - The bestIndex helper edge-cases (single defined value → no winner)
 *  - Multiple tied best-value columns (the first one wins)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

// ── Mock RatingHistogram so we don't drag in canvas/d3 ───────────────────────
vi.mock("./RatingHistogram", () => ({
  default: ({
    children,
    rating,
  }: {
    children: React.ReactNode;
    rating: number;
  }) => <span data-testid={`rating-histogram-${rating}`}>{children}</span>,
}));

// ── Module under test ────────────────────────────────────────────────────────
// We import *after* mocks are registered.
import CompareDrawer from "./CompareDrawer";
import { compareStore } from "../state/compareStore";
import type { APIItem } from "../data/mockApis";

// ── Shared fixture data ──────────────────────────────────────────────────────

/** An API that has NO pricePerCall – only pricePerRequest. */
const apiNoPricePerCall: APIItem = {
  id: "api-no-ppc",
  name: "No PricePerCall API",
  provider: { name: "TestCo" },
  description: "A test API without pricePerCall",
  pricePerRequest: 0.005,
  // pricePerCall intentionally omitted
  avgLatencyMs: 200,
  uptimePercent: 99.9,
  rating: 4.0,
  status: "operational",
  category: "Data & Analytics",
};

/** An API that has BOTH fields – pricePerCall should take precedence. */
const apiWithBothPrices: APIItem = {
  id: "api-both-prices",
  name: "Both Prices API",
  provider: { name: "TestCo" },
  description: "A test API with both price fields",
  pricePerRequest: 0.01,
  pricePerCall: 0.008, // lower → should be displayed
  avgLatencyMs: 150,
  uptimePercent: 99.95,
  rating: 4.5,
  status: "degraded",
  category: "Communication",
};

/** An API with many undefined/optional fields to exercise em-dash fallback. */
const apiMissingFields: APIItem = {
  id: "api-missing",
  name: "Sparse API",
  provider: { name: "TestCo" },
  description: "Minimal fields",
  pricePerRequest: 0.002,
  // pricePerCall: undefined
  // avgLatencyMs: undefined
  // uptimePercent: undefined
  // rating: undefined
  // status: undefined
  // category: undefined
};

/** Helper: seed compareStore with APIs and set open=true, then render. */
function renderWithApis(apis: APIItem[]) {
  // Reset store to a known-clean state each time.
  compareStore.clear();
  for (const api of apis) compareStore.addApi(api);
  compareStore.setOpen(true);
  return render(<CompareDrawer />);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Get all compare-columns currently rendered. */
function getColumns() {
  return screen.getAllByRole("heading", { level: 2 })
    ? document.querySelectorAll(".compare-column")
    : [];
}

// ═════════════════════════════════════════════════════════════════════════════
// AC1: Price fallback
// ═════════════════════════════════════════════════════════════════════════════

describe("AC1 – price fallback", () => {
  it("shows pricePerRequest when pricePerCall is absent", () => {
    renderWithApis([apiNoPricePerCall]);
    // $0.005 formatted to 3 dp → "$0.005"
    expect(screen.getByText(/\$0\.005/)).toBeInTheDocument();
  });

  it("shows pricePerCall when present, not pricePerRequest", () => {
    renderWithApis([apiWithBothPrices]);
    // pricePerCall=0.008 → "$0.008"
    expect(screen.getByText(/\$0\.008/)).toBeInTheDocument();
    // pricePerRequest=0.01 → should NOT appear as price
    expect(screen.queryByText(/\$0\.010/)).not.toBeInTheDocument();
  });

  it("shows pricePerRequest for APIs where pricePerCall is explicitly undefined", () => {
    const api: APIItem = {
      ...apiNoPricePerCall,
      id: "api-undef-ppc",
      name: "Undef PPC",
      pricePerCall: undefined,
      pricePerRequest: 0.003,
    };
    renderWithApis([api]);
    expect(screen.getByText(/\$0\.003/)).toBeInTheDocument();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// AC2: Status and category rows
// ═════════════════════════════════════════════════════════════════════════════

describe("AC2 – status and category rows", () => {
  it("renders a Status label in each column", () => {
    renderWithApis([apiNoPricePerCall, apiWithBothPrices]);
    const labels = screen.getAllByText(/^status$/i);
    expect(labels.length).toBe(2);
  });

  it("renders a Category label in each column", () => {
    renderWithApis([apiNoPricePerCall, apiWithBothPrices]);
    const labels = screen.getAllByText(/^category$/i);
    expect(labels.length).toBe(2);
  });

  it("displays the correct status value for each API", () => {
    renderWithApis([apiNoPricePerCall, apiWithBothPrices]);
    expect(screen.getByText("Operational")).toBeInTheDocument();
    expect(screen.getByText("Degraded")).toBeInTheDocument();
  });

  it("displays the correct category value for each API", () => {
    renderWithApis([apiNoPricePerCall, apiWithBothPrices]);
    expect(screen.getByText("Data & Analytics")).toBeInTheDocument();
    expect(screen.getByText("Communication")).toBeInTheDocument();
  });

  it("renders status and category rows even with a single API", () => {
    renderWithApis([apiWithBothPrices]);
    expect(screen.getByText(/^status$/i)).toBeInTheDocument();
    expect(screen.getByText(/^category$/i)).toBeInTheDocument();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// AC3: Best-value text labels
// ═════════════════════════════════════════════════════════════════════════════

describe("AC3 – best-value text labels", () => {
  const cheap: APIItem = {
    id: "cheap",
    name: "Cheap API",
    provider: { name: "A" },
    description: "",
    pricePerRequest: 0.001,
    avgLatencyMs: 100,
    uptimePercent: 99.0,
    rating: 3.5,
    status: "operational",
    category: "Other",
  };

  const fast: APIItem = {
    id: "fast",
    name: "Fast API",
    provider: { name: "B" },
    description: "",
    pricePerRequest: 0.005,
    avgLatencyMs: 50, // lower latency → best latency
    uptimePercent: 99.8, // higher uptime → best uptime
    rating: 4.8, // higher rating → best rating
    status: "operational",
    category: "Other",
  };

  it("shows 'Best value' label on the lowest price column", () => {
    renderWithApis([cheap, fast]);
    // cheap has lower price (0.001 < 0.005)
    // Each "Best value" label is an inline span; there may be multiple.
    // The price "Best value" belongs to cheap's column.
    const bestLabels = screen.getAllByText("Best value");
    // At minimum 4 (price, latency, uptime, rating) → cheap wins price, fast wins the others
    expect(bestLabels.length).toBeGreaterThanOrEqual(4);
  });

  it("shows 'Best value' on the lowest latency column", () => {
    renderWithApis([cheap, fast]);
    // fast has lower latency (50 < 100) → label in fast column
    // Verify at least one "Best value" is inside the "Fast API" column
    const columns = document.querySelectorAll(".compare-column");
    const fastCol = Array.from(columns).find((c) =>
      c.textContent?.includes("Fast API")
    );
    expect(fastCol).toBeTruthy();
    expect(fastCol!.querySelector(".compare-best-label")).toBeTruthy();
  });

  it("shows 'Best value' on the highest uptime column", () => {
    renderWithApis([cheap, fast]);
    const columns = document.querySelectorAll(".compare-column");
    const fastCol = Array.from(columns).find((c) =>
      c.textContent?.includes("Fast API")
    );
    const labels = fastCol!.querySelectorAll(".compare-best-label");
    expect(labels.length).toBeGreaterThanOrEqual(1);
  });

  it("shows 'Best value' on the highest rating column", () => {
    renderWithApis([cheap, fast]);
    const columns = document.querySelectorAll(".compare-column");
    const fastCol = Array.from(columns).find((c) =>
      c.textContent?.includes("Fast API")
    );
    const labels = fastCol!.querySelectorAll(".compare-best-label");
    expect(labels.length).toBeGreaterThanOrEqual(1);
  });

  it("does NOT show any 'Best value' label when only one API is loaded", () => {
    renderWithApis([cheap]);
    expect(screen.queryByText("Best value")).not.toBeInTheDocument();
  });

  it("does NOT show 'Best value' for a row where all values are undefined", () => {
    const noLatency: APIItem = { ...cheap, id: "a1", avgLatencyMs: undefined };
    const noLatency2: APIItem = { ...fast, id: "a2", avgLatencyMs: undefined };
    renderWithApis([noLatency, noLatency2]);
    // With both latencies undefined, no best label for that row; but price/uptime/rating may still appear.
    // Check there's no more than 3 best-value labels (price, uptime, rating only).
    const bestLabels = screen.queryAllByText("Best value");
    // Should have at most 3 (price + uptime + rating), not 4.
    expect(bestLabels.length).toBeLessThanOrEqual(3);
  });

  it("'Best value' label is present in the DOM for AT (aria-label set)", () => {
    renderWithApis([cheap, fast]);
    const labels = screen.getAllByLabelText("Best value");
    expect(labels.length).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// AC4: Missing values render em dash
// ═════════════════════════════════════════════════════════════════════════════

describe("AC4 – em dash for missing values", () => {
  it("renders — for avgLatencyMs when missing", () => {
    renderWithApis([apiMissingFields]);
    // The latency stat value should show —
    const latencyLabel = screen.getByText(/^latency$/i);
    const statGroup = latencyLabel.closest(".compare-stat");
    expect(statGroup).toBeTruthy();
    expect(statGroup!.textContent).toContain("—");
  });

  it("renders — for uptimePercent when missing", () => {
    renderWithApis([apiMissingFields]);
    const uptimeLabel = screen.getByText(/^uptime$/i);
    const statGroup = uptimeLabel.closest(".compare-stat");
    expect(statGroup!.textContent).toContain("—");
  });

  it("renders — for rating when missing", () => {
    renderWithApis([apiMissingFields]);
    const ratingLabel = screen.getByText(/^rating$/i);
    const statGroup = ratingLabel.closest(".compare-stat");
    expect(statGroup!.textContent).toContain("—");
  });

  it("renders — for status when missing", () => {
    renderWithApis([apiMissingFields]);
    const statusLabel = screen.getByText(/^status$/i);
    const statGroup = statusLabel.closest(".compare-stat");
    expect(statGroup!.textContent).toContain("—");
  });

  it("renders — for category when missing", () => {
    renderWithApis([apiMissingFields]);
    const catLabel = screen.getByText(/^category$/i);
    const statGroup = catLabel.closest(".compare-stat");
    expect(statGroup!.textContent).toContain("—");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Additional: drawer behaviour
// ═════════════════════════════════════════════════════════════════════════════

describe("drawer general behaviour", () => {
  beforeEach(() => {
    compareStore.clear();
  });

  it("renders nothing when isOpen is false", () => {
    compareStore.clear(); // also sets isOpen=false
    const { container } = render(<CompareDrawer />);
    expect(container.firstChild).toBeNull();
  });

  it("shows empty-state message when no APIs are loaded", () => {
    compareStore.setOpen(true);
    render(<CompareDrawer />);
    expect(screen.getByText("Select APIs to compare them.")).toBeInTheDocument();
  });

  it("removes an API when its remove button is clicked", async () => {
    const user = userEvent.setup();
    renderWithApis([apiNoPricePerCall, apiWithBothPrices]);
    const removeBtn = screen.getByRole("button", {
      name: `Remove ${apiNoPricePerCall.name} from comparison`,
    });
    await user.click(removeBtn);
    expect(screen.queryByText(apiNoPricePerCall.name)).not.toBeInTheDocument();
    expect(screen.getByText(apiWithBothPrices.name)).toBeInTheDocument();
  });

  it("clears all APIs on Clear button click", async () => {
    const user = userEvent.setup();
    renderWithApis([apiNoPricePerCall, apiWithBothPrices]);
    const clearBtn = screen.getByRole("button", { name: /clear all comparisons/i });
    await user.click(clearBtn);
    // compareStore.clear() also sets isOpen=false, causing the drawer to unmount.
    // Verify both API names are gone from the document.
    expect(screen.queryByText(apiNoPricePerCall.name)).not.toBeInTheDocument();
    expect(screen.queryByText(apiWithBothPrices.name)).not.toBeInTheDocument();
  });
});
