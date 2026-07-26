// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiDetailStickyTOC, type TocSection } from "./ApiDetailStickyTOC";

afterEach(cleanup);

describe("ApiDetailStickyTOC - prefers-reduced-motion", () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  const mockReducedMotion = (matches: boolean) => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: matches && (query === "(prefers-reduced-motion: reduce)" || query.includes("reduce")),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
  };

  const sections: TocSection[] = [
    { id: "section-1", label: "Section 1" },
    { id: "section-2", label: "Section 2" },
  ];

  it("applies none transition style to link when prefers-reduced-motion is active", () => {
    mockReducedMotion(true);
    render(<ApiDetailStickyTOC sections={sections} />);

    const links = screen.getAllByRole("link");
    expect(links.length).toBe(2);
    links.forEach((link) => {
      expect((link as HTMLElement).style.transition).toBe("none");
    });
  });

  it("does not apply inline none transition style when prefers-reduced-motion is inactive", () => {
    mockReducedMotion(false);
    render(<ApiDetailStickyTOC sections={sections} />);

    const links = screen.getAllByRole("link");
    expect(links.length).toBe(2);
    links.forEach((link) => {
      expect((link as HTMLElement).style.transition).not.toBe("none");
    });
  });
});
