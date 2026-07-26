// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import RateLimitCard from "./RateLimitCard";

/** Convenience wrapper with sensible defaults so tests stay focused. */
function renderCard(overrides: Partial<React.ComponentProps<typeof RateLimitCard>> = {}) {
  const defaults = {
    apiName: "Advanced Language Model Completions API v2",
    providerName: "OpenMind AI",
    planName: "Professional Tier – High Throughput",
    endpointPath: "/v2/completions/streaming",
    requestsUsed: 4000,
    requestsTotal: 10000,
    resetAt: new Date(Date.now() + 3_600_000), // 1 hr from now
    apiId: "alm-api",
    providerId: "openmind",
  };
  return render(<RateLimitCard {...defaults} {...overrides} />);
}

describe("RateLimitCard", () => {
  afterEach(() => {
    cleanup();
  });

  // ── Rendering ──────────────────────────────────────────────────────────────

  it("renders the Rate Limit heading", () => {
    renderCard();
    expect(
      screen.getByRole("heading", { name: /rate limit/i }),
    ).toBeTruthy();
  });

  it("renders provider and API name in the subtitle", () => {
    renderCard();
    // The subtitle paragraph contains both names — use a more targeted query
    const subtitle = document.querySelector("header p");
    expect(subtitle?.textContent).toMatch(/OpenMind AI/);
    expect(subtitle?.textContent).toMatch(/Advanced Language Model Completions API v2/);
  });

  it("renders a progress bar with correct ARIA values", () => {
    renderCard({ requestsUsed: 7500, requestsTotal: 10000 });
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("7500");
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("10000");
    expect(bar.getAttribute("aria-label")).toMatch(/7,500 of 10,000/);
  });

  it("renders a quota count string", () => {
    renderCard({ requestsUsed: 4000, requestsTotal: 10000 });
    expect(screen.getByText(/4,000 \/ 10,000 req/)).toBeTruthy();
  });

  it("displays a reset time element with a datetime attribute", () => {
    const resetAt = new Date(Date.now() + 3_600_000);
    renderCard({ resetAt });
    const timeEl = screen.getByText(/in \d+ hr/i).closest("time") ??
      document.querySelector("time");
    expect(timeEl).toBeTruthy();
    expect(timeEl?.getAttribute("datetime")).toBeTruthy();
  });

  it("displays the plan name in the footer", () => {
    renderCard({ planName: "Professional Tier – High Throughput" });
    expect(
      screen.getByText("Professional Tier – High Throughput"),
    ).toBeTruthy();
  });

  // ── Status badge ───────────────────────────────────────────────────────────

  it("shows an OK badge when usage is below 70%", () => {
    renderCard({ requestsUsed: 5000, requestsTotal: 10000 }); // 50%
    const badge = screen.getByRole("status");
    expect(badge.textContent).toMatch(/OK/i);
    expect(badge.getAttribute("aria-label")).toMatch(/within quota/i);
  });

  it("shows a Warning badge when usage is between 70% and 89%", () => {
    renderCard({ requestsUsed: 7500, requestsTotal: 10000 }); // 75%
    const badge = screen.getByRole("status");
    expect(badge.textContent).toMatch(/warning/i);
    expect(badge.getAttribute("aria-label")).toMatch(/approaching quota/i);
  });

  it("shows a Critical badge when usage is 90% or above", () => {
    renderCard({ requestsUsed: 9500, requestsTotal: 10000 }); // 95%
    const badge = screen.getByRole("status");
    expect(badge.textContent).toMatch(/critical/i);
    expect(badge.getAttribute("aria-label")).toMatch(/nearly exhausted/i);
  });

  it("shows OK badge when requestsTotal is 0 (division guard)", () => {
    renderCard({ requestsUsed: 0, requestsTotal: 0 });
    const badge = screen.getByRole("status");
    expect(badge.textContent).toMatch(/OK/i);
  });

  // ── Breadcrumb middle-ellipsis ────────────────────────────────────────────

  it("renders a breadcrumb nav with 'breadcrumb' label", () => {
    renderCard();
    expect(screen.getByRole("navigation", { name: /breadcrumb/i })).toBeTruthy();
  });

  it("always shows the Marketplace link as the first crumb", () => {
    renderCard();
    const nav = screen.getByRole("navigation", { name: /breadcrumb/i });
    expect(within(nav).getByRole("link", { name: "Marketplace" })).toBeTruthy();
  });

  it("shows the endpoint path as the current crumb with aria-current='page'", () => {
    renderCard({ endpointPath: "/v2/completions/streaming" });
    const nav = screen.getByRole("navigation", { name: /breadcrumb/i });
    const current = nav.querySelector("[aria-current='page']");
    expect(current).toBeTruthy();
    // The aria-label always carries the full label, even when truncated
    expect(current?.getAttribute("aria-label")).toBe("/v2/completions/streaming");
  });

  it("truncates long API names in the breadcrumb using middle-ellipsis", () => {
    // API name is > 20 chars: "Advanced Language Model Completions API v2"
    renderCard();
    const nav = screen.getByRole("navigation", { name: /breadcrumb/i });
    // Find links in the nav that are NOT the Marketplace link (i.e. the API crumb)
    const links = Array.from(within(nav).getAllByRole("link")).filter(
      (l) => l.getAttribute("href") !== "/marketplace",
    );
    // At least one link should be truncated with "…"
    const hasTruncated = links.some(
      (l) => l.textContent?.includes("…") || l.getAttribute("data-truncated") === "true",
    );
    expect(hasTruncated).toBe(true);
  });

  it("preserves the full label in aria-label when a crumb is truncated", () => {
    renderCard({ apiName: "Advanced Language Model Completions API v2" });
    const nav = screen.getByRole("navigation", { name: /breadcrumb/i });
    // Links with data-truncated should carry the full label in aria-label
    const truncatedLinks = Array.from(
      nav.querySelectorAll("[data-truncated='true']"),
    );
    for (const link of truncatedLinks) {
      const ariaLabel = link.getAttribute("aria-label");
      const visibleText = link.textContent ?? "";
      expect(ariaLabel).not.toContain("…");
      expect(visibleText).toContain("…");
    }
  });

  it("does not truncate labels that fit within the max length", () => {
    renderCard({
      apiName: "Short API",      // 9 chars, well under maxLen=20
      providerName: "Acme",      // 4 chars
      planName: "Free",           // 4 chars
      endpointPath: "/v1/data",  // 8 chars
    });
    const nav = screen.getByRole("navigation", { name: /breadcrumb/i });
    const truncatedNodes = nav.querySelectorAll("[data-truncated='true']");
    expect(truncatedNodes.length).toBe(0);
  });

  // ── Accessibility ──────────────────────────────────────────────────────────

  it("wraps everything in an <article> with a labelledby heading", () => {
    renderCard();
    const article = document.querySelector("article");
    expect(article).toBeTruthy();
    expect(article?.getAttribute("aria-labelledby")).toBe("rlc-heading");
    expect(document.getElementById("rlc-heading")?.tagName).toBe("H2");
  });

  it("renders a <time> element for the reset timestamp", () => {
    renderCard();
    const time = document.querySelector("time");
    expect(time).toBeTruthy();
    // datetime must be a valid ISO string
    const dt = time?.getAttribute("datetime") ?? "";
    expect(() => new Date(dt)).not.toThrow();
    expect(new Date(dt).toString()).not.toBe("Invalid Date");
  });

  it("remaining count is visible to screen readers via the progress bar aria-label", () => {
    renderCard({ requestsUsed: 3000, requestsTotal: 10000 });
    const bar = screen.getByRole("progressbar");
    // The aria-label should mention the used / total counts
    expect(bar.getAttribute("aria-label")).toMatch(/3,000/);
    expect(bar.getAttribute("aria-label")).toMatch(/10,000/);
  });
});
