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

import RateLimitCard from "./RateLimitCard";

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
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("shows a loading state first", () => {
    renderPage("three-tier");
    expect(screen.getByRole("status").textContent).toMatch(/loading/i);
  });

  it("renders three rows and a caption naming the API", async () => {
    renderPage("three-tier");
    const table = await screen.findByRole("table", { name: /Three Tier API/ });
    expect(within(table).getByText(/Rate limit tiers for Three Tier API/)).toBeTruthy();
    expect(within(table).getAllByRole("row").length).toBe(4); // header + 3
    expect(within(table).getByText(new Intl.NumberFormat().format(120000))).toBeTruthy();
    expect(within(table).getByText("Burst limit")).toBeTruthy();
    expect(within(table).getByText("Concurrent connections")).toBeTruthy();
  });

  it("omits Burst and Concurrent columns when no tier has them", async () => {
    renderPage("no-burst");
    const table = await screen.findByRole("table", { name: /No Burst API/ });
    expect(within(table).queryByText("Burst limit")).toBeNull();
    expect(within(table).queryByText("Concurrent connections")).toBeNull();
    expect(within(table).getByText("Requests / min")).toBeTruthy();
  });

  it("shows the not-published state when the API has no rateLimits", async () => {
    renderPage("unpublished");
    expect(await screen.findByText("This provider has not published rate limits.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
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
    expect(nav.textContent).toContain("Three Tier API");
  });

  it("contains no GrantFox literals", async () => {
    const { container } = renderPage("three-tier");
    await screen.findByRole("table");
    expect(container.textContent).not.toMatch(/GrantFox/i);
  });
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
