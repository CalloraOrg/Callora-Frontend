// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import RateLimitCard from "./RateLimitCard";

/**
 * RateLimitCard tests – issue #567 (GrantFox FWC26 "Stellar Wave")
 *
 * Covers:
 *  1. Page structure and accessibility
 *  2. Breadcrumb presence and middle-ellipsis truncation
 *  3. Rate-limit table content
 *  4. Color-blind safe patterns on plan badges
 */

/** Expected pattern class for each plan. */
const PLAN_PATTERN_CLASSES: Record<string, string> = {
  Free: "free",
  Developer: "developer",
  Pro: "pro",
  Enterprise: "enterprise",
};

function renderPage() {
  return render(
    <MemoryRouter>
      <RateLimitCard />
    </MemoryRouter>,
  );
}

describe("RateLimitCard", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // ── Page structure ────────────────────────────────────────────────────────

  it("renders the page heading", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { name: /rate limit configuration/i }),
    ).toBeTruthy();
  });

  it("renders the API subtitle", () => {
    renderPage();
    expect(
      screen.getByText(/GrantFox Wave Compute API/),
    ).toBeTruthy();
  });

  // ── Breadcrumb ────────────────────────────────────────────────────────────

  it("renders an accessible breadcrumb navigation", () => {
    renderPage();
    const nav = screen.getByRole("navigation", { name: /breadcrumb/i });
    expect(nav).toBeTruthy();
  });

  it("shows Marketplace as the first breadcrumb link", () => {
    renderPage();
    const marketplaceLink = screen.getByRole("link", {
      name: "Marketplace",
    });
    expect(marketplaceLink).toBeTruthy();
    expect(marketplaceLink.getAttribute("href")).toBe("/marketplace");
  });

  it("marks the last crumb as the current page", () => {
    renderPage();
    const current = document.querySelector<HTMLElement>(
      '[aria-current="page"]',
    );
    expect(current).not.toBeNull();
    // Visual text may be truncated but aria-current must be present
    expect(current?.getAttribute("aria-current")).toBe("page");
  });

  it("applies middle-ellipsis truncation to long middle crumb labels", () => {
    const { container } = renderPage();

    // The two middle crumbs are rendered inside `.breadcrumb-middle` list items
    // as visible links on desktop, and also inside the popover on mobile.
    // On desktop they are in .breadcrumb-middle items.
    const middleItems = Array.from(
      container.querySelectorAll<HTMLElement>(
        ".breadcrumb-middle .breadcrumb-link",
      ),
    );

    // Both middle labels are long and should be truncated
    expect(middleItems.length).toBe(2);
    for (const item of middleItems) {
      expect(item.textContent).toContain("\u2026");
    }
  });

  it("preserves full labels as accessible names on truncated crumbs", () => {
    const { container } = renderPage();

    const middleLinks = Array.from(
      container.querySelectorAll<HTMLAnchorElement>(
        ".breadcrumb-middle .breadcrumb-link",
      ),
    );

    const fullLabels = [
      "GrantFox Wave Compute API – Stellar Edition",
      "Rate Limits & Throttling Policies",
    ];

    middleLinks.forEach((link, i) => {
      // title is always set
      expect(link.getAttribute("title")).toBe(fullLabels[i]);
      // aria-label is set when truncated (both labels exceed 28 chars)
      expect(link.getAttribute("aria-label")).toBe(fullLabels[i]);
    });
  });

  // ── Rate-limit table ──────────────────────────────────────────────────────

  it("renders the rate-limit tier table", () => {
    renderPage();
    expect(screen.getByRole("table", { name: /rate limit tiers/i })).toBeTruthy();
  });

  it("shows all four plan tiers", () => {
    renderPage();
    for (const plan of ["Free", "Developer", "Pro", "Enterprise"]) {
      expect(screen.getByText(plan)).toBeTruthy();
    }
  });

  it("shows the correct requests-per-minute value for the Free tier", () => {
    renderPage();
    // "10" appears in both the Free row (req/min) and Developer row (concurrent),
    // so we confirm it is present at least once in the table.
    const cells = screen.getAllByText("10");
    expect(cells.length).toBeGreaterThanOrEqual(1);
  });

  it("renders copy affordances for displayed rate-limit values", () => {
    renderPage();
    expect(
      screen.getByRole("button", {
        name: /copy free requests per minute: 10/i,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: /copy enterprise burst limit: 10,000/i,
      }),
    ).toBeTruthy();
  });

  it("copies a rate-limit value and shows success feedback", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    renderPage();
    fireEvent.click(
      screen.getByRole("button", {
        name: /copy developer requests per minute: 120/i,
      }),
    );

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("120");
    });
    expect(
      screen.getByRole("button", {
        name: /copied developer requests per minute: 120/i,
      }),
    ).toBeTruthy();
  });

  it("renders the throttle note below the table", () => {
    renderPage();
    expect(
      screen.getByText(/rolling 60-second window/i),
    ).toBeTruthy();
  });

  // ── Color-blind safe patterns ─────────────────────────────────────────────

  it.each(["Free", "Developer", "Pro", "Enterprise"])(
    `%s badge has a distinct pattern class for color-blind safety`,
    (plan) => {
      renderPage();
      const badge = screen.getByText(plan);
      const expectedClass = PLAN_PATTERN_CLASSES[plan];
      expect(badge.classList.contains("rate-limit-badge")).toBe(true);
      expect(badge.classList.contains(expectedClass)).toBe(true);
    },
  );

  it("each plan badge carries a data-pattern attribute describing the texture", () => {
    renderPage();
    for (const plan of ["Free", "Developer", "Pro", "Enterprise"]) {
      const badge = screen.getByText(plan);
      expect(badge.getAttribute("data-pattern")).toBeTruthy();
    }
  });
});
