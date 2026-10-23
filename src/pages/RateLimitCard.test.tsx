// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import RateLimitCard, { type RateLimitCardProps } from "./RateLimitCard";

/**
 * RateLimitCard tests – issue #567 (GrantFox FWC26 "Stellar Wave")
 * and mobile responsive stacked plan cards.
 *
 * Covers:
 *  1. Mobile layout: four plan cards, no table
 *  2. Desktop layout: table with four body rows
 *  3. currentPlan prop: badge and aria-current on card or row
 *  4. Numbers: non-breaking tabular-nums span
 *  5. Pattern text: exposed to assistive tech
 *  6. Style injection: no inline <style> tag rendered by component
 *  7. Breadcrumb presence and middle-ellipsis truncation
 */

/** Expected pattern class for each plan. */
const PLAN_PATTERN_CLASSES: Record<string, string> = {
  Free: "free",
  Developer: "developer",
  Pro: "pro",
  Enterprise: "enterprise",
};

/**
 * Forces `window.matchMedia("(max-width: 639px)")` to report a match so the
 * component renders its mobile card layout.
 */
function mockViewport(isMobile: boolean) {
  const original = window.matchMedia;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: isMobile,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}

function renderPage(props?: RateLimitCardProps) {
  return render(
    <MemoryRouter>
      <RateLimitCard {...props} />
    </MemoryRouter>,
  );
}

describe("RateLimitCard", () => {
  afterEach(() => {
    cleanup();
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

  // ── Rate-limit table (Desktop) ────────────────────────────────────────────

  it("renders the rate-limit tier table", () => {
    renderPage();
    expect(screen.getByRole("table", { name: /rate limit tiers/i })).toBeTruthy();
  });

  it("renders the table with four body rows on desktop viewports", () => {
    const { container } = renderPage();
    const table = screen.getByRole("table", { name: /rate limit tiers/i });
    expect(table).toBeTruthy();
    const rows = container.querySelectorAll("tbody tr");
    expect(rows.length).toBe(4);
    expect(container.querySelectorAll(".rate-limit-plan-card").length).toBe(0);
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

  it("renders the throttle note below the table", () => {
    renderPage();
    expect(
      screen.getByText(/rolling 60-second window/i),
    ).toBeTruthy();
  });

  // ── Mobile Plan Cards ─────────────────────────────────────────────────────

  it("renders four plan cards and no table on mobile viewports (< 640px)", () => {
    const restore = mockViewport(true);
    try {
      const { container } = renderPage();
      expect(screen.queryByRole("table")).toBeNull();
      const cards = container.querySelectorAll(".rate-limit-plan-card");
      expect(cards.length).toBe(4);
      for (const plan of ["Free", "Developer", "Pro", "Enterprise"]) {
        expect(screen.getByText(plan)).toBeTruthy();
      }
    } finally {
      restore();
    }
  });

  // ── Current Plan ──────────────────────────────────────────────────────────

  it("marks the specified currentPlan row with 'Current plan' badge and aria-current on desktop", () => {
    const { container } = renderPage({ currentPlan: "Pro" });
    const currentRow = container.querySelector('tbody tr[aria-current="true"]');
    expect(currentRow).not.toBeNull();
    expect(currentRow?.textContent).toContain("Pro");
    expect(currentRow?.textContent).toContain("Current plan");

    const nonCurrentRows = container.querySelectorAll('tbody tr:not([aria-current="true"])');
    expect(nonCurrentRows.length).toBe(3);
    for (const row of Array.from(nonCurrentRows)) {
      expect(row.textContent).not.toContain("Current plan");
    }
  });

  it("marks the specified currentPlan card with 'Current plan' badge and aria-current on mobile", () => {
    const restore = mockViewport(true);
    try {
      const { container } = renderPage({ currentPlan: "Pro" });
      const currentCard = container.querySelector('.rate-limit-plan-card[aria-current="true"]');
      expect(currentCard).not.toBeNull();
      expect(currentCard?.textContent).toContain("Pro");
      expect(currentCard?.textContent).toContain("Current plan");

      const nonCurrentCards = container.querySelectorAll('.rate-limit-plan-card:not([aria-current="true"])');
      expect(nonCurrentCards.length).toBe(3);
      for (const card of Array.from(nonCurrentCards)) {
        expect(card.textContent).not.toContain("Current plan");
      }
    } finally {
      restore();
    }
  });

  // ── Numbers ───────────────────────────────────────────────────────────────

  it("renders numbers like 6,000 inside a single non-breaking tabular-nums span on desktop", () => {
    renderPage();
    const span = screen.getByText("6,000");
    expect(span.tagName).toBe("SPAN");
    expect(span.classList.contains("rate-limit-number")).toBe(true);
  });

  it("renders numbers like 6,000 inside a single non-breaking tabular-nums span on mobile dl", () => {
    const restore = mockViewport(true);
    try {
      renderPage();
      const span = screen.getByText("6,000");
      expect(span.tagName).toBe("SPAN");
      expect(span.classList.contains("rate-limit-number")).toBe(true);
    } finally {
      restore();
    }
  });

  // ── Color-blind safe patterns & Pattern text ──────────────────────────────

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

  it("each plan exposes its pattern description to assistive tech on desktop", () => {
    renderPage();
    for (const desc of ["solid baseline", "dot pattern", "diagonal stripes", "crosshatch pattern"]) {
      expect(screen.getByText(desc)).toBeTruthy();
    }
  });

  it("each plan exposes its pattern description to assistive tech on mobile", () => {
    const restore = mockViewport(true);
    try {
      renderPage();
      for (const desc of ["solid baseline", "dot pattern", "diagonal stripes", "crosshatch pattern"]) {
        expect(screen.getByText(desc)).toBeTruthy();
      }
    } finally {
      restore();
    }
  });

  // ── Style injection ───────────────────────────────────────────────────────

  it("renders no inline <style> element directly within the rate-limit page", () => {
    const { container } = renderPage();
    const pageStyle = container.querySelector(".rate-limit-page > style");
    expect(pageStyle).toBeNull();
  });
});
