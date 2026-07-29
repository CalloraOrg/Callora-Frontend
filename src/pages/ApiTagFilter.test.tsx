// @vitest-environment jsdom
/**
 * ApiTagFilter.test.tsx
 *
 * Focused tests for src/pages/ApiTagFilter.tsx covering:
 *  - Normal rendering and interaction
 *  - prefers-reduced-motion: reduce static state (GrantFox FWC26)
 *  - Accessibility attributes
 *  - Edge cases (empty tags, case-insensitive active matching)
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ApiTagFilter from "./ApiTagFilter";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Override window.matchMedia to simulate a specific reduced-motion preference.
 *
 * The setupTests.ts global mock always returns `matches: false`.  These tests
 * need to control the value per-test so we replace the mock inline and restore
 * it afterwards.
 */
function mockMatchMedia(prefersReducedMotion: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches:
        query === "(prefers-reduced-motion: reduce)" ? prefersReducedMotion : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    }),
  });
}

const SAMPLE_TAGS = ["payments", "finance", "auth"];

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("ApiTagFilter", () => {
  afterEach(() => {
    cleanup();
    // Reset to the global default (no reduced-motion) after every test.
    mockMatchMedia(false);
  });

  // ── Rendering ─────────────────────────────────────────────────────────────

  describe("rendering", () => {
    it("renders a chip for each supplied tag", () => {
      render(
        <ApiTagFilter tags={SAMPLE_TAGS} activeTag={null} onTagClick={vi.fn()} />,
      );

      for (const tag of SAMPLE_TAGS) {
        expect(screen.getByTestId(`tag-chip-${tag}`)).toBeTruthy();
      }
    });

    it("renders nothing when tags array is empty", () => {
      const { container } = render(
        <ApiTagFilter tags={[]} activeTag={null} onTagClick={vi.fn()} />,
      );
      expect(container.firstChild).toBeNull();
    });

    it("renders the wrapper with role='group' and default aria-label", () => {
      render(
        <ApiTagFilter tags={SAMPLE_TAGS} activeTag={null} onTagClick={vi.fn()} />,
      );
      const group = screen.getByRole("group", { name: "Filter by tag" });
      expect(group).toBeTruthy();
    });

    it("uses a custom label when provided", () => {
      render(
        <ApiTagFilter
          tags={SAMPLE_TAGS}
          activeTag={null}
          onTagClick={vi.fn()}
          label="Browse by tag"
        />,
      );
      expect(screen.getByRole("group", { name: "Browse by tag" })).toBeTruthy();
    });

    it("renders each chip as a button", () => {
      render(
        <ApiTagFilter tags={["rpc"]} activeTag={null} onTagClick={vi.fn()} />,
      );
      expect(screen.getByRole("button", { name: "Filter by tag rpc" })).toBeTruthy();
    });
  });

  // ── Active state ──────────────────────────────────────────────────────────

  describe("active state", () => {
    it("marks the active tag chip with aria-pressed='true'", () => {
      render(
        <ApiTagFilter
          tags={SAMPLE_TAGS}
          activeTag="finance"
          onTagClick={vi.fn()}
        />,
      );
      const btn = screen.getByTestId("tag-chip-finance");
      expect(btn.getAttribute("aria-pressed")).toBe("true");
    });

    it("marks inactive chips with aria-pressed='false'", () => {
      render(
        <ApiTagFilter
          tags={SAMPLE_TAGS}
          activeTag="finance"
          onTagClick={vi.fn()}
        />,
      );
      expect(
        screen.getByTestId("tag-chip-payments").getAttribute("aria-pressed"),
      ).toBe("false");
    });

    it("applies the tag-chip--active class only to the active chip", () => {
      render(
        <ApiTagFilter
          tags={SAMPLE_TAGS}
          activeTag="auth"
          onTagClick={vi.fn()}
        />,
      );
      const active = screen.getByTestId("tag-chip-auth");
      const inactive = screen.getByTestId("tag-chip-payments");

      expect(active.className).toContain("tag-chip--active");
      expect(inactive.className).not.toContain("tag-chip--active");
    });

    it("matches active tag case-insensitively", () => {
      render(
        <ApiTagFilter
          tags={["Payments"]}
          activeTag="payments"
          onTagClick={vi.fn()}
        />,
      );
      const chip = screen.getByTestId("tag-chip-Payments");
      expect(chip.getAttribute("aria-pressed")).toBe("true");
    });
  });

  // ── Interaction ───────────────────────────────────────────────────────────

  describe("interaction", () => {
    it("calls onTagClick with the tag string when an inactive chip is clicked", () => {
      const onTagClick = vi.fn();
      render(
        <ApiTagFilter
          tags={SAMPLE_TAGS}
          activeTag={null}
          onTagClick={onTagClick}
        />,
      );
      fireEvent.click(screen.getByTestId("tag-chip-payments"));
      expect(onTagClick).toHaveBeenCalledWith("payments");
    });

    it("calls onTagClick with null when the active chip is clicked (deselect)", () => {
      const onTagClick = vi.fn();
      render(
        <ApiTagFilter
          tags={SAMPLE_TAGS}
          activeTag="finance"
          onTagClick={onTagClick}
        />,
      );
      fireEvent.click(screen.getByTestId("tag-chip-finance"));
      expect(onTagClick).toHaveBeenCalledWith(null);
    });

    it("does not call onTagClick with the previous active tag when switching", () => {
      const onTagClick = vi.fn();
      render(
        <ApiTagFilter
          tags={SAMPLE_TAGS}
          activeTag="finance"
          onTagClick={onTagClick}
        />,
      );
      fireEvent.click(screen.getByTestId("tag-chip-auth"));
      expect(onTagClick).toHaveBeenCalledWith("auth");
      expect(onTagClick).not.toHaveBeenCalledWith("finance");
    });
  });

  // ── Reduced-motion static state ───────────────────────────────────────────
  //
  // This block directly tests the GrantFox FWC26 requirement:
  //   "static state under prefers-reduced-motion: reduce for ApiTagFilter
  //    animations".
  //
  // When the OS/browser reports `prefers-reduced-motion: reduce` the component
  // must add the `tag-chip--no-motion` modifier class to every chip so that
  // the CSS `@media (prefers-reduced-motion: reduce)` rule (and the explicit
  // `.tag-chip--no-motion` rule) can strip transitions and transforms.

  describe("prefers-reduced-motion: reduce", () => {
    beforeEach(() => {
      // Simulate the OS/browser reduced-motion preference before each test in
      // this block.
      mockMatchMedia(true);
    });

    it("adds tag-chip--no-motion to every chip when reduced-motion is preferred", () => {
      render(
        <ApiTagFilter
          tags={SAMPLE_TAGS}
          activeTag={null}
          onTagClick={vi.fn()}
        />,
      );

      for (const tag of SAMPLE_TAGS) {
        const chip = screen.getByTestId(`tag-chip-${tag}`);
        expect(chip.className).toContain("tag-chip--no-motion");
      }
    });

    it("adds tag-chip--no-motion even when a chip is active", () => {
      render(
        <ApiTagFilter
          tags={SAMPLE_TAGS}
          activeTag="auth"
          onTagClick={vi.fn()}
        />,
      );

      const activeChip = screen.getByTestId("tag-chip-auth");
      // Both modifiers must be present simultaneously.
      expect(activeChip.className).toContain("tag-chip--active");
      expect(activeChip.className).toContain("tag-chip--no-motion");
    });

    it("does NOT add tag-chip--no-motion when reduced-motion is not preferred", () => {
      // Explicitly set to full-motion (this is also the default mock).
      mockMatchMedia(false);

      render(
        <ApiTagFilter
          tags={SAMPLE_TAGS}
          activeTag={null}
          onTagClick={vi.fn()}
        />,
      );

      for (const tag of SAMPLE_TAGS) {
        const chip = screen.getByTestId(`tag-chip-${tag}`);
        expect(chip.className).not.toContain("tag-chip--no-motion");
      }
    });

    it("still fires onTagClick correctly when reduced-motion is active", () => {
      const onTagClick = vi.fn();
      render(
        <ApiTagFilter
          tags={SAMPLE_TAGS}
          activeTag={null}
          onTagClick={onTagClick}
        />,
      );

      fireEvent.click(screen.getByTestId("tag-chip-finance"));
      expect(onTagClick).toHaveBeenCalledWith("finance");
    });

    it("still allows deselection when reduced-motion is active", () => {
      const onTagClick = vi.fn();
      render(
        <ApiTagFilter
          tags={SAMPLE_TAGS}
          activeTag="finance"
          onTagClick={onTagClick}
        />,
      );

      fireEvent.click(screen.getByTestId("tag-chip-finance"));
      expect(onTagClick).toHaveBeenCalledWith(null);
    });
  });

  // ── Accessibility ─────────────────────────────────────────────────────────

  describe("accessibility", () => {
    it("each chip has an accessible label that includes the tag name", () => {
      render(
        <ApiTagFilter tags={["rpc", "rest"]} activeTag={null} onTagClick={vi.fn()} />,
      );
      expect(screen.getByLabelText("Filter by tag rpc")).toBeTruthy();
      expect(screen.getByLabelText("Filter by tag rest")).toBeTruthy();
    });

    it("chips are reachable by keyboard tab order (not disabled)", () => {
      render(
        <ApiTagFilter tags={SAMPLE_TAGS} activeTag={null} onTagClick={vi.fn()} />,
      );
      for (const tag of SAMPLE_TAGS) {
        const chip = screen.getByTestId(`tag-chip-${tag}`);
        expect(chip.getAttribute("disabled")).toBeNull();
      }
    });

    it("wrapper has data-testid='api-tag-filter' for integration tests", () => {
      render(
        <ApiTagFilter tags={SAMPLE_TAGS} activeTag={null} onTagClick={vi.fn()} />,
      );
      expect(screen.getByTestId("api-tag-filter")).toBeTruthy();
    });
  });
});
