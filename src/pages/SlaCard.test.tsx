// @vitest-environment jsdom

/**
 * SlaCard.test.tsx
 *
 * Comprehensive tests for the per-API SlaCard component.
 *
 * Test surface:
 *  1. Per-API SLA rendering (geocode-01):
 *     - Dynamic heading with API name ("GeoLocate")
 *     - Breadcrumb trail linking back to /details/:id
 *     - All contractual SLA fields rendered from api.sla + api.version
 *     - Copy buttons for each field with accessible aria-labels
 *  2. Copy interaction & accessibility:
 *     - Clicking copy calls clipboard.writeText with the exact metric value
 *     - Label transitions to "Copied!" and CheckIcon is displayed
 *     - Aria-live region announces the copied field
 *     - 2-second timeout resets the copied state
 *     - Rapid re-copy extends the timeout
 *     - Independent copied state per field button
 *  3. API without SLA:
 *     - Displays "This provider has not published an SLA" banner
 *     - Shows observed historical metrics (uptime, latency) clearly labeled as observed
 *     - Contractual SLA wording is not displayed
 *  4. Unknown API ID:
 *     - Not-found alert panel with link back to /marketplace
 *  5. Loading state:
 *     - Skeleton with aria-busy="true"
 */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import SlaCard from "./SlaCard";
import * as catalogApiModule from "../api/catalogApi";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Render SlaCard inside MemoryRouter with route parameters. */
async function renderSlaCard(initialPath = "/marketplace/geocode-01/sla") {
  let view: any;
  await act(async () => {
    view = render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/marketplace/:apiId/sla" element={<SlaCard />} />
          <Route path="/marketplace" element={<div>Marketplace Mock</div>} />
          <Route path="/details/:id" element={<div>Details Mock</div>} />
        </Routes>
      </MemoryRouter>,
    );
    // Flush microtasks for fetchCatalog promise resolution
    await Promise.resolve();
    await Promise.resolve();
  });
  return view;
}

/**
 * Click a copy button and flush the clipboard Promise microtask.
 * Returns after setState has been applied so assertions can run immediately.
 */
async function clickCopy(btn: HTMLElement) {
  await act(async () => {
    fireEvent.click(btn);
    await Promise.resolve();
  });
}

// ─── Setup / teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ─── 1. API with SLA (Scenario 1) ─────────────────────────────────────────────

describe("SlaCard — API with SLA (geocode-01)", () => {
  it("renders heading containing the API name 'GeoLocate'", async () => {
    await renderSlaCard("/marketplace/geocode-01/sla");
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toContain("GeoLocate");
    expect(heading.textContent).toContain("SLA Details");
  });

  it("updates document title to include the API name", async () => {
    await renderSlaCard("/marketplace/geocode-01/sla");
    expect(document.title).toContain("GeoLocate");
    expect(document.title).toContain("SLA Details");
  });

  it("renders breadcrumb trail linking to Marketplace and API details", async () => {
    await renderSlaCard("/marketplace/geocode-01/sla");
    const marketplaceLink = screen.getByRole("link", { name: "Marketplace" });
    expect(marketplaceLink.getAttribute("href")).toBe("/marketplace");

    const detailsLink = screen.getByRole("link", { name: "GeoLocate" });
    expect(detailsLink.getAttribute("href")).toBe("/details/geocode-01");
  });

  it("renders all contractual SLA field labels", async () => {
    await renderSlaCard("/marketplace/geocode-01/sla");
    const expectedLabels = [
      "Uptime SLA",
      "P99 Response Time",
      "Incident Response",
      "Maintenance Window",
      "Support Tier",
      "Credit Threshold",
      "API Version",
    ];
    for (const label of expectedLabels) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("renders all contractual SLA field values correctly", async () => {
    await renderSlaCard("/marketplace/geocode-01/sla");
    const expectedFields: [string, string][] = [
      ["uptime", "99.95%"],
      ["response-time", "≤ 250 ms"],
      ["incident-response", "< 15 minutes"],
      ["maintenance-window", "Sundays 02:00–04:00 UTC"],
      ["support-tier", "Priority (24/7)"],
      ["credit-threshold", "< 99.5% triggers SLA credit"],
      ["api-version", "1.8.0"],
    ];
    for (const [id, value] of expectedFields) {
      expect(screen.getByTestId(`sla-value-${id}`).textContent).toBe(value);
    }
  });

  it("renders copy buttons for each field with appropriate aria-labels", async () => {
    await renderSlaCard("/marketplace/geocode-01/sla");
    const copyButtons = screen.getAllByRole("button", { name: /^Copy /i });
    expect(copyButtons).toHaveLength(7);

    expect(
      screen.getByRole("button", { name: /Copy Uptime SLA: 99\.95%/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Copy P99 Response Time: ≤ 250 ms/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Copy API Version: 1\.8\.0/i }),
    ).toBeTruthy();
  });
});

// ─── 2. Copy interaction & accessibility ──────────────────────────────────────

describe("SlaCard — copy interaction and clipboard feedback", () => {
  it("calls clipboard.writeText with that API's value on click (Scenario 5)", async () => {
    const writeText = navigator.clipboard.writeText as ReturnType<typeof vi.fn>;
    await renderSlaCard("/marketplace/geocode-01/sla");

    const uptimeBtn = screen.getByTestId("sla-copy-btn-uptime");
    await clickCopy(uptimeBtn);

    expect(writeText).toHaveBeenCalledWith("99.95%");
  });

  it("shows 'Copied!' label and green checkmark icon after click", async () => {
    await renderSlaCard("/marketplace/geocode-01/sla");

    const btn = screen.getByTestId("sla-copy-btn-uptime");
    await clickCopy(btn);

    expect(btn.textContent).toContain("Copied!");
    expect(btn.querySelector("svg")).toBeTruthy();
    expect(btn.getAttribute("aria-label")).toBe("Uptime SLA copied");
  });

  it("announces copy to screen readers via polite aria-live region", async () => {
    await renderSlaCard("/marketplace/geocode-01/sla");

    const liveRegion = screen.getByTestId("sla-live-uptime");
    expect(liveRegion.textContent).toBe("");
    expect(liveRegion.getAttribute("aria-live")).toBe("polite");

    const btn = screen.getByTestId("sla-copy-btn-uptime");
    await clickCopy(btn);

    expect(screen.getByTestId("sla-live-uptime").textContent).toBe(
      "Uptime SLA copied to clipboard",
    );
  });

  it("resets copied feedback after 2 seconds", async () => {
    await renderSlaCard("/marketplace/geocode-01/sla");

    const btn = screen.getByTestId("sla-copy-btn-uptime");
    await clickCopy(btn);
    expect(btn.textContent).toContain("Copied!");

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(btn.textContent).toContain("Copy");
    expect(btn.textContent).not.toContain("Copied!");
    expect(screen.getByTestId("sla-live-uptime").textContent).toBe("");
  });

  it("restarts 2s timer on rapid re-copy", async () => {
    await renderSlaCard("/marketplace/geocode-01/sla");

    const btn = screen.getByTestId("sla-copy-btn-uptime");
    await clickCopy(btn);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(btn.textContent).toContain("Copied!");

    await clickCopy(btn);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // 2s total from first click, but 1s from second click -> still copied
    expect(btn.textContent).toContain("Copied!");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // 2s after second click -> reset
    expect(btn.textContent).toContain("Copy");
  });

  it("tracks copy states independently across different buttons", async () => {
    await renderSlaCard("/marketplace/geocode-01/sla");

    const uptimeBtn = screen.getByTestId("sla-copy-btn-uptime");
    const responseBtn = screen.getByTestId("sla-copy-btn-response-time");

    await clickCopy(uptimeBtn);

    expect(uptimeBtn.textContent).toContain("Copied!");
    expect(responseBtn.textContent).toContain("Copy");
    expect(responseBtn.textContent).not.toContain("Copied!");
  });
});

// ─── 3. API without SLA (Scenario 2) ──────────────────────────────────────────

describe("SlaCard — API without SLA (Scenario 2)", () => {
  it("renders 'This provider has not published an SLA' message and observed metrics", async () => {
    await renderSlaCard("/marketplace/translate-01/sla");

    // Must show "not published" message
    expect(
      screen.getByText(/This provider has not published an SLA/i),
    ).toBeTruthy();

    // Must clearly label metrics as observed
    expect(screen.getByText(/Observed Uptime/i)).toBeTruthy();
    expect(screen.getByText(/Observed Average Latency/i)).toBeTruthy();

    // Assert wording explicitly mentions "observed and not contractual"
    expect(
      screen.getByText(/observed and not contractual/i),
    ).toBeTruthy();

    // Must NEVER present contractual "Uptime SLA" for this API
    expect(screen.queryByText(/^Uptime SLA$/)).toBeNull();
  });

  it("renders observed values and allows copying them", async () => {
    const writeText = navigator.clipboard.writeText as ReturnType<typeof vi.fn>;
    await renderSlaCard("/marketplace/translate-01/sla");

    // Translate-01 has uptime 99.9% and latency 240ms
    expect(screen.getByTestId("sla-value-observed-uptime").textContent).toBe("99.9%");
    expect(screen.getByTestId("sla-value-observed-latency").textContent).toBe("240 ms");

    const copyUptime = screen.getByTestId("sla-copy-btn-observed-uptime");
    await clickCopy(copyUptime);
    expect(writeText).toHaveBeenCalledWith("99.9%");
  });
});

// ─── 4. Unknown API ID (Scenario 3) ───────────────────────────────────────────

describe("SlaCard — Unknown ID (Scenario 3)", () => {
  it("renders not-found panel with Marketplace link and announces via role='alert'", async () => {
    await renderSlaCard("/marketplace/unknown-api-999/sla");

    const alertPanel = screen.getByRole("alert");
    expect(alertPanel).toBeTruthy();

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toContain("API Not Found");

    const backLink = screen.getByRole("link", { name: /Back to Marketplace/i });
    expect(backLink.getAttribute("href")).toBe("/marketplace");
  });

  it("renders not-found state when visiting old grantfox URL if not in catalogue", async () => {
    await renderSlaCard("/marketplace/grantfox-wave-compute/sla");

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("API Not Found");
  });
});

// ─── 5. Loading skeleton state (Scenario 4) ───────────────────────────────────

describe("SlaCard — Catalogue loading (Scenario 4)", () => {
  it("renders skeleton placeholder with aria-busy='true' while catalogue is loading", async () => {
    // Return pending promise
    vi.spyOn(catalogApiModule, "fetchCatalog").mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter initialEntries={["/marketplace/geocode-01/sla"]}>
        <Routes>
          <Route path="/marketplace/:apiId/sla" element={<SlaCard />} />
        </Routes>
      </MemoryRouter>,
    );

    const skeleton = screen.getByTestId("sla-skeleton");
    expect(skeleton).toBeTruthy();
    expect(skeleton.getAttribute("aria-busy")).toBe("true");
  });
});
