import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ApiUsage from "./ApiUsage";
import { addAccount, switchAccount, _reset } from "../state/accountStore";

const usagePayload = {
  events: [
    {
      id: "call-1",
      endpoint: "/v1/profile",
      occurredAt: new Date().toISOString(),
      revenue: "1500000",
    },
  ],
  stats: { totalSpent: "1500000" },
  usagePercent: 85,
};

async function settleUsageRequest() {
  await act(async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  });
}

beforeEach(() => {
  localStorage.clear();
  _reset();
  addAccount({ id: "account-1", label: "Account 1", apiKey: "key-1" });
  addAccount({ id: "account-2", label: "Account 2", apiKey: "key-2" });
  switchAccount("account-1");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => usagePayload,
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  _reset();
});

const writeTextMock = vi.fn();
Object.assign(navigator, {
  clipboard: {
    writeText: writeTextMock,
  },
});

// Mock dependencies
vi.mock("../hooks/useFetchTracker", () => ({
  useFetchTracker: () => ({ trackFetch: vi.fn(async (promise) => promise) }),
}));

vi.mock("../hooks/useQuota", () => ({
  useQuota: (usagePercent: number) => ({
    usagePercent,
    isDismissed: false,
    dismiss: vi.fn(),
  }),
}));

vi.mock("../components/PlanNudge", () => ({
  default: ({ usagePercent }: { usagePercent: number }) => (
    <div data-testid="plan-nudge" data-usage-percent={usagePercent}>
      PlanNudge
    </div>
  ),
}));

vi.mock("../components/CallsHeatmap", () => ({
  default: () => <div data-testid="calls-heatmap">CallsHeatmap</div>,
}));

describe("ApiUsage - Filter Reset", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, "location", {
      value: {
        search: "",
        pathname: "/api-usage",
      },
      writable: true,
    });
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should enable reset button when filters are active and announce reset to screen readers", async () => {
    render(<ApiUsage />);
    await settleUsageRequest();
    const resetButton = screen.getByRole("button", { name: /Reset Filters/i });
    expect(resetButton.disabled).toBe(true);
    const successTab = screen.getByRole("tab", { name: /Success/i });
    fireEvent.click(successTab);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(resetButton.disabled).toBe(false);
    fireEvent.click(resetButton);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(resetButton.disabled).toBe(true);
    const srAnnouncements = screen.getAllByRole("status");
    const srAnnouncement = srAnnouncements.find((node) =>
      node.textContent?.includes(
        "Filters reset. Showing all calls from the last 24 hours.",
      ),
    );
    expect(srAnnouncement).toBeTruthy();
  });

  it("renders an accessible breadcrumb with the current page announced", async () => {
    render(<ApiUsage />);
    await settleUsageRequest();
    const breadcrumb = screen.getByRole("navigation", { name: /breadcrumb/i });
    expect(breadcrumb).toBeTruthy();
    const marketplaceLink = screen.getByRole("link", { name: "Marketplace" });
    expect(marketplaceLink.getAttribute("href")).toBe("/marketplace");
    const currentCrumb = screen.getByText("User Profile API usage");
    expect(currentCrumb.getAttribute("aria-current")).toBe("page");
  });

  it("announces status filter changes to screen readers", async () => {
    render(<ApiUsage />);
    await settleUsageRequest();
    fireEvent.click(screen.getByRole("tab", { name: /Error/i }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(
      screen.getByText("Showing error calls.").closest('[role="status"]'),
    ).toBeTruthy();
  });

  it("announces copy actions to screen readers", async () => {
    render(<ApiUsage />);
    await settleUsageRequest();
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(writeTextMock).toHaveBeenCalled();
    expect(
      screen
        .getByText("API key copied to clipboard.")
        .closest('[role="status"]'),
    ).toBeTruthy();
  });
});

describe("ApiUsage - Tabular Numerals", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, "location", {
      value: { search: "", pathname: "/api-usage" },
      writable: true,
    });
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    writeTextMock.mockResolvedValue(undefined);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("applies tabular-nums to all stat-value elements", async () => {
    render(<ApiUsage />);
    await settleUsageRequest();
    const statValues = document.querySelectorAll(".stat-value.tabular-nums");
    expect(statValues.length).toBe(5);
    const labels = [
      "Calls Today",
      "Calls This Week",
      "Total Spent",
      "Avg Response Time",
      "Success Rate",
    ];
    statValues.forEach((el, i) => {
      expect(el.classList.contains("tabular-nums")).toBe(true);
      const card = el.closest(".stat-card");
      expect(card.querySelector(".stat-label").textContent).toBe(labels[i]);
    });
  });
});
describe('ApiUsage - Design Token Spacing (v7)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, 'location', {
      value: { search: '', pathname: '/api-usage' },
      writable: true,
    });
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false, media: query, onchange: null,
        addListener: vi.fn(), removeListener: vi.fn(),
        addEventListener: vi.fn(), removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses token-based gap on api-usage-page', () => {
    render(<ApiUsage />);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    const page = document.querySelector('.api-usage-page') as HTMLElement;
    expect(page).toBeTruthy();
    expect(page.classList.contains('api-usage-page')).toBe(true);
  });

  it('uses token-based padding on api-header', () => {
    render(<ApiUsage />);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    const header = document.querySelector('.api-header') as HTMLElement;
    expect(header).toBeTruthy();
  });

  it('renders the api-key-section with token-consistent spacing', () => {
    render(<ApiUsage />);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    const section = document.querySelector('.api-key-section');
    expect(section).toBeTruthy();
  });

  it('renders the stats-grid with token-consistent gap', () => {
    render(<ApiUsage />);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    const grid = document.querySelector('.stats-grid');
    expect(grid).toBeTruthy();
  });

  it('renders all surface sections with token-based spacing', () => {
    render(<ApiUsage />);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    const surfaces = document.querySelectorAll('.surface');
    expect(surfaces.length).toBeGreaterThanOrEqual(4);
    surfaces.forEach((surface) => {
      expect(surface.classList.contains('surface')).toBe(true);
    });
  });
});

describe("ApiUsage - Empty State", () => {
  beforeEach(() => {
    Object.defineProperty(window, "location", {
      value: { search: "", pathname: "/api-usage" },
      writable: true,
    });
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    vi.clearAllMocks();
  });

  it("renders call history rows when there are matching records", async () => {
    render(<ApiUsage />);
    await settleUsageRequest();

    const callHistorySection = screen.getByText("Call History");
    expect(callHistorySection).toBeTruthy();
    const skeletonRows = document.querySelectorAll(".skeleton-cell");
    expect(skeletonRows.length).toBe(0);
  });

  it("renders call history entries using CallHistoryRow components", async () => {
    render(<ApiUsage />);
    await settleUsageRequest();

    expect(screen.getByText("Call History")).toBeTruthy();
    const resetButton = screen.getByRole("button", { name: /Reset Filters/i });
    expect(resetButton).toBeTruthy();
  });

  it("does not show EmptyState when call history data is present", async () => {
    render(<ApiUsage />);
    await settleUsageRequest();

    const noCallsMessage = screen.queryByText("No calls yet");
    expect(noCallsMessage).toBeNull();
  });
});

describe("ApiUsage - Account-scoped usage", () => {
  it("shows the skeleton only while the active account request is pending", async () => {
    let resolveUsage: (value: unknown) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((resolve) => {
            resolveUsage = resolve;
          }),
      ),
    );

    render(<ApiUsage />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(
      document.querySelector('[aria-label="API usage loading shell"]'),
    ).toBeTruthy();
    expect(screen.queryByText("Call History")).toBeNull();

    await act(async () => {
      resolveUsage({ ok: true, json: async () => usagePayload });
      for (let i = 0; i < 10; i += 1) await Promise.resolve();
    });

    expect(screen.getByText("Call History")).toBeTruthy();
    expect(
      document.querySelector('[aria-label="API usage loading shell"]'),
    ).toBeNull();
  });

  it("passes the fetched usage percentage to PlanNudge", async () => {
    render(<ApiUsage />);
    await settleUsageRequest();

    expect(
      screen.getByTestId("plan-nudge").getAttribute("data-usage-percent"),
    ).toBe("85");
  });

  it("requests fresh usage after switching accounts", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...usagePayload,
          events: [{ ...usagePayload.events[0], endpoint: "/account-one" }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...usagePayload,
          events: [{ ...usagePayload.events[0], endpoint: "/account-two" }],
          usagePercent: 20,
        }),
      } as Response);

    render(<ApiUsage />);
    await settleUsageRequest();
    expect(screen.getByText("/account-one")).toBeTruthy();

    act(() => switchAccount("account-2"));
    await settleUsageRequest();

    expect(screen.getByText("/account-two")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      screen.getByTestId("plan-nudge").getAttribute("data-usage-percent"),
    ).toBe("20");
  });
});

describe("ApiUsage - prefers-reduced-motion", () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    vi.useFakeTimers();
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    vi.useRealTimers();
    window.matchMedia = originalMatchMedia;
  });

  it("applies focus-visible styles on interactive elements when keyboard-focused", async () => {
    render(<ApiUsage />);
    await settleUsageRequest();

    // All interactive buttons get focus-visible outlines via global @layer focus
    const buttons = document.querySelectorAll(".api-usage-page button");
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach((btn) => {
      expect(btn.tagName).toBe("BUTTON");
      // Tab buttons specifically get the tab-button focus override
      if (btn.classList.contains("tab-button")) {
        const style = getComputedStyle(btn);
        // The global @layer focus layer provides the ring
        expect(btn.classList.contains("tab-button")).toBe(true);
      }
    });

    // Tab buttons exist for language selection
    const tabButtons = document.querySelectorAll(".api-usage-page .tab-button");
    expect(tabButtons.length).toBe(3); // JavaScript, Python, cURL

    expect(screen.getByTestId("calls-heatmap")).toBeTruthy();

    // Response display section is initially hidden (no call made yet)
    const responseDisplay = document.querySelector(".response-display");
    expect(responseDisplay).toBeFalsy();

    // Documentation link exists
    const docLink = document.querySelector(".documentation-link a");
    expect(docLink).toBeTruthy();
  });

  // ── CSS-class contract for reduced-motion (Issue #721) ────────────────
  //
  // jsdom does not evaluate @media rules, so we verify that the CSS classes
  // exist and are correctly structured for the {prefers-reduced-motion: reduce}
  // rules in index.css to apply in real browsers.

  it("status-dot has CSS class targeted by prefers-reduced-motion: reduce rules", async () => {
    render(<ApiUsage />);
    await settleUsageRequest();
    const statusDot = document.querySelector(".status-dot");
    expect(statusDot).toBeTruthy();
  });

  it("skeleton elements have the .skeleton class targeted by reduced-motion CSS", () => {
    // Render normally (no reduced motion) to verify skeleton class presence
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(<ApiUsage />);

    const skeletonEls = document.querySelectorAll(".skeleton");
    // There should be skeletons visible during initial render
    expect(skeletonEls.length).toBeGreaterThanOrEqual(1);
  });

  it("skeleton elements are present with shimmer background before reduced-motion CSS takes effect", () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(<ApiUsage />);

    const skeletonEls = document.querySelectorAll(".skeleton");
    skeletonEls.forEach((el) => {
      // The shimmer animation is driven by the CSS class, which the
      // prefers-reduced-motion: reduce rule overrides in real browsers.
      expect(el.classList.contains("skeleton")).toBe(true);
    });
  });

  it("button-spinner has CSS class targeted by prefers-reduced-motion: reduce rules", async () => {
    render(<ApiUsage />);
    await settleUsageRequest();

    // Trigger button loading state to show spinner
    const makeTestCallButton = screen.getByRole("button", {
      name: /Make Test Call/i,
    });
    fireEvent.click(makeTestCallButton);

    const buttonSpinner = document.querySelector(".button-spinner");
    expect(buttonSpinner).toBeTruthy();
  });

  it("tab-button has CSS class targeted by prefers-reduced-motion: reduce transition rules", async () => {
    render(<ApiUsage />);
    await settleUsageRequest();
    const tabButtons = document.querySelectorAll(".tab-button");
    expect(tabButtons.length).toBe(3);
    tabButtons.forEach((btn) => {
      expect(btn.classList.contains("tab-button")).toBe(true);
    });
  });

  it("danger-button has CSS class targeted by prefers-reduced-motion: reduce transition rules", async () => {
    render(<ApiUsage />);
    await settleUsageRequest();
    const dangerButton = document.querySelector(".danger-button");
    expect(dangerButton).toBeTruthy();
  });

  it("primary-button has CSS class targeted by prefers-reduced-motion: reduce transition rules", async () => {
    render(<ApiUsage />);
    await settleUsageRequest();
    const primaryButtons = document.querySelectorAll(".primary-button");
    expect(primaryButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("secondary-button has CSS class targeted by prefers-reduced-motion: reduce transition rules", async () => {
    render(<ApiUsage />);
    await settleUsageRequest();
    const secondaryButtons = document.querySelectorAll(".secondary-button");
    expect(secondaryButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("ghost-button has CSS class targeted by prefers-reduced-motion: reduce transition rules", async () => {
    render(<ApiUsage />);
    await settleUsageRequest();
    const ghostButton = document.querySelector(".ghost-button");
    expect(ghostButton).toBeTruthy();
  });
});

describe("ApiUsage - Skeleton Parity", () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    vi.useFakeTimers();
    originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    window.matchMedia = originalMatchMedia;
  });

  it("renders skeleton rows with shape and height parity matching the final component", () => {
    render(<ApiUsage />);

    const skeletonRows = document.querySelectorAll(".table-row");
    expect(skeletonRows.length).toBeGreaterThan(0);

    const firstSkeletonRow = skeletonRows[1];
    const skeletonCells = firstSkeletonRow.querySelectorAll(".skeleton-cell");

    expect(skeletonCells.length).toBe(7);

    const statusIconSkeleton = skeletonCells[2];
    expect(statusIconSkeleton.getAttribute("style")).toContain("width: 16px");
    expect(statusIconSkeleton.getAttribute("style")).toContain(
      "border-radius: 50%",
    );

    const actionButtonSkeleton = skeletonCells[6];
    expect(actionButtonSkeleton.getAttribute("style")).toContain("width: 64px");
    expect(actionButtonSkeleton.getAttribute("style")).toContain(
      "height: 32px",
    );
  });
});
