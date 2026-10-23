// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiDetailStickyTOC } from "./ApiDetailStickyTOC";
import StickyToc from "../pages/StickyToc";

const SECTIONS = [
  { id: "toc-endpoints", label: "Endpoints" },
  { id: "toc-parameters", label: "Parameters" },
  { id: "toc-implementation", label: "Implementation" },
];

function mockReducedMotion(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches:
      matches &&
      (query === "(prefers-reduced-motion: reduce)" || query.includes("reduce")),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  }));
}

describe("ApiDetailStickyTOC / StickyToc reduced-motion (issue #528)", () => {
  beforeEach(() => {
    // IntersectionObserver is required by the component.
    class MockIntersectionObserver {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
      takeRecords = vi.fn(() => []);
      root = null;
      rootMargin = "";
      thresholds: number[] = [];
    }
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders TOC links for each section", () => {
    mockReducedMotion(false);
    render(<ApiDetailStickyTOC sections={SECTIONS} />);
    expect(screen.getByRole("navigation", { name: "On this page" })).toBeTruthy();
    for (const section of SECTIONS) {
      expect(screen.getByRole("link", { name: section.label })).toBeTruthy();
    }
  });

  it("sets transition to none on links when prefers-reduced-motion is active", () => {
    mockReducedMotion(true);
    render(<ApiDetailStickyTOC sections={SECTIONS} />);
    const links = screen.getAllByRole("link");
    expect(links.length).toBe(SECTIONS.length);
    for (const link of links) {
      expect(link.style.transition).toBe("none");
    }
  });

  it("keeps color transition when prefers-reduced-motion is not set", () => {
    mockReducedMotion(false);
    render(<ApiDetailStickyTOC sections={SECTIONS} />);
    const links = screen.getAllByRole("link");
    expect(links.length).toBe(SECTIONS.length);
    for (const link of links) {
      expect(link.style.transition).toContain("color");
      expect(link.style.transition).not.toBe("none");
    }
  });

  it("returns null when sections is empty", () => {
    mockReducedMotion(false);
    const { container } = render(<ApiDetailStickyTOC sections={[]} />);
    expect(container.querySelector(".api-detail-toc")).toBeNull();
  });

  it("StickyToc page re-export renders the same TOC", () => {
    mockReducedMotion(true);
    render(<StickyToc sections={SECTIONS} />);
    expect(screen.getByRole("navigation", { name: "On this page" })).toBeTruthy();
    const links = screen.getAllByRole("link");
    for (const link of links) {
      expect(link.style.transition).toBe("none");
    }
  });
});
