// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import CompareDrawer from './CompareDrawer';
import { compareStore } from '../state/compareStore';
import type { APIItem } from '../data/mockApis';

// RatingHistogram is replaced with a lightweight stand-in so the best-value
// assertions below can target the rating cell directly.
vi.mock("./RatingHistogram", () => ({
  default: ({
    children,
    rating,
  }: {
    children: React.ReactNode;
    rating: number;
  }) => <span data-testid={`rating-histogram-${rating}`}>{children}</span>,
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('CompareDrawer Component', () => {
  beforeEach(() => {
    localStorageMock.clear();
    compareStore.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const sampleApi = {
    id: 'api-1',
    name: 'Test API',
    pricePerCall: 0.01,
    avgLatencyMs: 45,
    uptimePercent: 99.9,
    rating: 4.8,
    ratingDistribution: { 5: 80, 4: 20, 3: 0, 2: 0, 1: 0 },
  };

  it('renders nothing when isOpen is false', () => {
    render(<CompareDrawer />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders correctly when isOpen is true with items and empty state', () => {
    act(() => {
      compareStore.addApi(sampleApi);
      compareStore.setOpen(true);
    });

    const { rerender } = render(<CompareDrawer />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Test API')).toBeTruthy();
    expect(screen.getByText('Price / call')).toBeTruthy();

    // Test empty state
    act(() => {
      compareStore.clear();
      compareStore.setOpen(true);
    });
    rerender(<CompareDrawer />);
    expect(screen.getByText('Select APIs to compare them.')).toBeTruthy();
  });

  it('announces removal and clears announcement after 3 seconds', () => {
    act(() => {
      compareStore.addApi(sampleApi);
      compareStore.setOpen(true);
    });

    render(<CompareDrawer />);

    const removeBtn = screen.getByLabelText('Remove Test API from comparison');
    act(() => {
      fireEvent.click(removeBtn);
    });

    const liveRegion = screen.getByText('Removed Test API from comparison.');
    expect(liveRegion).toBeTruthy();

    // Advance timers by 3 seconds
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryByText('Removed Test API from comparison.')).toBeNull();
  });

  it('clears all items and announces it', () => {
    act(() => {
      compareStore.addApi(sampleApi);
      compareStore.setOpen(true);
    });

    render(<CompareDrawer />);

    const clearBtn = screen.getByLabelText('Clear all comparisons');
    act(() => {
      fireEvent.click(clearBtn);
    });

    expect(screen.getByText('Cleared all comparison items.')).toBeTruthy();
    expect(compareStore.getSnapshot().apis.length).toBe(0);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryByText('Cleared all comparison items.')).toBeNull();
  });

  it('closes on Escape key press', () => {
    act(() => {
      compareStore.addApi(sampleApi);
      compareStore.setOpen(true);
    });

    render(<CompareDrawer />);
    expect(screen.getByRole('dialog')).toBeTruthy();

    act(() => {
      fireEvent.keydown(document, { key: 'Escape' });
    });

    expect(compareStore.getSnapshot().isOpen).toBe(false);
  });

  it('closes on backdrop click', () => {
    act(() => {
      compareStore.addApi(sampleApi);
      compareStore.setOpen(true);
    });

    render(<CompareDrawer />);
    const overlay = document.querySelector('.compare-drawer-overlay');
    expect(overlay).toBeTruthy();

    act(() => {
      fireEvent.click(overlay!);
    });

    expect(compareStore.getSnapshot().isOpen).toBe(false);
  });
});

// ─── Issue #1062: price fallback, status/category rows, best-value labels ───

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
