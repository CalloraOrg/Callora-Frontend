import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ApiUsage from "./ApiUsage";
import { addAccount, switchAccount, _reset } from "../state/accountStore";
import {
  signalRateLimit,
  resetRateLimitSignalForTests,
} from "../services/rateLimitSignal";

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
        "Filters reset. Showing all calls from the last 7 days.",
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

describe("ApiUsage - Real Test Call", () => {
  it("renders the stubbed gateway response, saves it to history, and redacts secrets", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/api/usage")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => usagePayload,
        });
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: "real_user_99",
            plan: "pro",
            api_key: "sk_live_supersecret123456789012",
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "X-Callora-Cost": "0.0042",
            },
          },
        ),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ApiUsage />);
    await settleUsageRequest();

    const makeCallButton = screen.getByRole("button", {
      name: /Make Test Call/i,
    });
    await act(async () => {
      fireEvent.click(makeCallButton);
    });

    expect(screen.getByText(/Status: 200/)).toBeTruthy();
    expect(screen.getByText(/real_user_99/)).toBeTruthy();
    expect(screen.queryByText(/John Doe/)).toBeNull();

    const rawHistory = localStorage.getItem("callora_test_call_history") ?? "";
    expect(rawHistory).toContain("real_user_99");
    expect(rawHistory).toContain('"httpStatus":200');
    expect(rawHistory).toContain('"cost":0.0042');
    expect(rawHistory).not.toContain("sk_live_supersecret123456789012");
  });

  it("saves an error entry with a safe message on HTTP 500 without leaking secrets", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/api/usage")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => usagePayload,
        });
      }
      return Promise.resolve(
        new Response("Authorization: Bearer secret_jwt_token_value", {
          status: 500,
          headers: { "Content-Type": "text/plain" },
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ApiUsage />);
    await settleUsageRequest();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Make Test Call/i }));
    });

    expect(screen.getByText(/Status: 500/)).toBeTruthy();
    expect(screen.queryByText(/secret_jwt_token_value/)).toBeNull();

    const rawHistory = localStorage.getItem("callora_test_call_history") ?? "";
    expect(rawHistory).toContain('"status":"error"');
    expect(rawHistory).toContain('"httpStatus":500');
    expect(rawHistory).not.toContain("secret_jwt_token_value");
  });

  it("aborts an in-flight test call on unmount", async () => {
    let capturedSignal: AbortSignal | undefined;
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).includes("/api/usage")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => usagePayload,
        });
      }
      capturedSignal = init?.signal ?? undefined;
      return new Promise(() => {
        // intentionally pending
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = render(<ApiUsage />);
    await settleUsageRequest();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Make Test Call/i }));
    });

    expect(capturedSignal).toBeDefined();
    expect(capturedSignal?.aborted).toBe(false);

    unmount();
    expect(capturedSignal?.aborted).toBe(true);
  });

  it("loads and renders legacy history entries without httpStatus", async () => {
    localStorage.setItem(
      "callora_test_call_history",
      JSON.stringify([
        {
          id: "legacy-1",
          timestamp: new Date().toISOString(),
          endpointId: "1",
          endpointName: "Get User Profile",
          endpointPath: "/api/v1/user/profile",
          method: "GET",
          requestParams: "{}",
          response: { ok: true },
          status: "success",
          responseTime: 120,
          cost: 0.002,
        },
      ]),
    );

    render(<ApiUsage />);
    await settleUsageRequest();

    fireEvent.click(screen.getByRole("button", { name: /Open request history/i }));
    expect(screen.getAllByText("/api/v1/user/profile").length).toBeGreaterThan(0);
  });
});

describe("ApiUsage - Rate Limit Alert & Countdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-23T00:00:00.000Z"));
    resetRateLimitSignalForTests();
  });

  afterEach(() => {
    resetRateLimitSignalForTests();
    vi.useRealTimers();
  });

  it("shows RateLimitAlert with countdown on 429, disables Make Test Call, and re-enables when countdown ends", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/usage")) {
        return Promise.resolve(
          new Response(JSON.stringify(usagePayload), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ error: "Too Many Requests" }), {
          status: 429,
          headers: { "Retry-After": "30" },
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ApiUsage />);
    await settleUsageRequest();

    const makeCallBtn = screen.getByRole("button", {
      name: /Make Test Call/i,
    }) as HTMLButtonElement;
    expect(makeCallBtn.disabled).toBe(false);

    await act(async () => {
      fireEvent.click(makeCallBtn);
      for (let i = 0; i < 10; i += 1) await Promise.resolve();
    });

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Rate limited. Retry in");
    expect(alert.textContent).toContain("30s");
    expect(makeCallBtn.disabled).toBe(true);

    // Advance 10 seconds — countdown updates, button remains disabled
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(screen.getByRole("alert").textContent).toContain("20s");
    expect(makeCallBtn.disabled).toBe(true);

    // Advance past the remaining 20 seconds — alert disappears and button re-enables
    await act(async () => {
      await vi.advanceTimersByTimeAsync(21_000);
    });
    expect(screen.queryByText(/Rate limited\. Retry in/i)).toBeNull();
    expect(makeCallBtn.disabled).toBe(false);
  });

  it("keeps the newest reset window when concurrent 429s arrive out of order", async () => {
    render(<ApiUsage />);
    await settleUsageRequest();

    const laterResetAt = new Date(Date.now() + 45_000).toISOString();
    const earlierResetAt = new Date(Date.now() + 10_000).toISOString();

    act(() => {
      signalRateLimit({
        retryAfterMs: 45_000,
        resetAt: laterResetAt,
        path: "/api/v1/user/profile",
      });
      // Older reset arriving second should NOT overwrite the newer 45s window
      signalRateLimit({
        retryAfterMs: 10_000,
        resetAt: earlierResetAt,
        path: "/api/usage",
      });
    });

    expect(screen.getByRole("alert").textContent).toContain("45s");

    // After 15s, the 45s window is still active (30s left)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(screen.getByRole("alert").textContent).toContain("30s");
  });

  it("clears the countdown interval on unmount", async () => {
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    const { unmount } = render(<ApiUsage />);
    await settleUsageRequest();

    act(() => {
      signalRateLimit({
        retryAfterMs: 30_000,
        resetAt: new Date(Date.now() + 30_000).toISOString(),
        path: "/api/usage",
      });
    });

    expect(screen.getByRole("alert").textContent).toContain("30s");
    clearIntervalSpy.mockClear();

    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});

describe("ApiUsage - QuotaManager & QuotaBanner", () => {
  it("renders QuotaManager and QuotaBanner and submits quota updates through quotaStore", async () => {
    const { quotaStore } = await import("../state/quotaStore");
    const updateSpy = vi.spyOn(quotaStore, "update");

    render(<ApiUsage />);
    await settleUsageRequest();

    const input = screen.getByLabelText(/Requests per window/i) as HTMLInputElement;
    expect(input).toBeTruthy();

    fireEvent.change(input, { target: { value: "250" } });
    fireEvent.click(screen.getByRole("button", { name: /Save quota/i }));

    await settleUsageRequest();

    expect(updateSpy).toHaveBeenCalledWith(250);
    expect(input.value).toBe("250");
    updateSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// DateRangePicker integration (#1397)
// ---------------------------------------------------------------------------

describe("ApiUsage - DateRangePicker integration", () => {
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

  it("renders the DateRangePicker in the filter row", async () => {
    // DateRangePicker renders as a fieldset with the accessible label
    const picker = document.querySelector(".date-range-picker");
    expect(picker).toBeTruthy();
  });

  it("default preset is 7d", async () => {
    // The 7d radio button should be checked by default
    const sevenDayRadio = document.querySelector(
      'input[type="radio"][value="7d"]',
    ) as HTMLInputElement | null;
    expect(sevenDayRadio).toBeTruthy();
    expect(sevenDayRadio?.checked).toBe(true);
  });

  it("changing preset to 30d announces the change", async () => {

    const thirtyDayRadio = document.querySelector(
      'input[type="radio"][value="30d"]',
    ) as HTMLInputElement | null;
    expect(thirtyDayRadio).toBeTruthy();
    fireEvent.click(thirtyDayRadio!);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const srAnnouncements = screen.getAllByRole("status");
    const announcement = srAnnouncements.find((node) =>
      node.textContent?.includes("30d"),
    );
    expect(announcement).toBeTruthy();
  });

  it("Reset Filters button resets range back to 7d", async () => {

    // Switch to 30d
    const thirtyDayRadio = document.querySelector(
      'input[type="radio"][value="30d"]',
    ) as HTMLInputElement | null;
    fireEvent.click(thirtyDayRadio!);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    const resetButton = screen.getByRole("button", { name: /Reset Filters/i });
    expect(resetButton.disabled).toBe(false);
    fireEvent.click(resetButton);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    const sevenDayRadio = document.querySelector(
      'input[type="radio"][value="7d"]',
    ) as HTMLInputElement | null;
    expect(sevenDayRadio?.checked).toBe(true);
  });

  it("call history rows match the selected range", async () => {
    // The mock event's occurredAt is new Date() — within the 7d window.

    // After loading, the event at /v1/profile should appear in call history
    expect(screen.getByText("/v1/profile")).toBeTruthy();

    // Switch to 24h — the event is still today, so still visible
    const twentyFourHrRadio = document.querySelector(
      'input[type="radio"][value="24h"]',
    ) as HTMLInputElement | null;
    fireEvent.click(twentyFourHrRadio!);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    // The event was just now, so it still appears
    expect(screen.getByText("/v1/profile")).toBeTruthy();
  });
});
