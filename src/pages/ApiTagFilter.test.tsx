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

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ApiTagFilter, { getAllUniqueTags } from "./ApiTagFilter";

const MOCK_TAGS = ["weather", "geo", "forecast", "payments", "cards"];

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

  // ── Rendering ──────────────────────────────────────────────────────────

  it("renders an 'All' pill and each tag as a button", () => {
    render(
      <ApiTagFilter
        tags={MOCK_TAGS}
        selectedTag={null}
        onTagChange={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "All" })).toBeTruthy();

    for (const tag of MOCK_TAGS) {
      expect(
        screen.getByRole("button", { name: new RegExp(tag, "i") }),
      ).toBeTruthy();
    }
  });

  it("marks 'All' as pressed when no tag is selected", () => {
    render(
      <ApiTagFilter
        tags={MOCK_TAGS}
        selectedTag={null}
        onTagChange={() => {}}
      />,
    );
    expect(
      screen.getByRole("button", { name: "All" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("marks the active tag as pressed and 'All' as not pressed", () => {
    render(
      <ApiTagFilter
        tags={MOCK_TAGS}
        selectedTag="weather"
        onTagChange={() => {}}
      />,
    );
    expect(
      screen.getByRole("button", { name: "All" }).getAttribute("aria-pressed"),
    ).toBe("false");
    expect(
      screen
        .getByRole("button", { name: /weather/i })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  // ── User interaction ───────────────────────────────────────────────────

  it("calls onTagChange with null when 'All' is clicked", () => {
    const onTagChange = vi.fn();
    render(
      <ApiTagFilter
        tags={MOCK_TAGS}
        selectedTag="weather"
        onTagChange={onTagChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(onTagChange).toHaveBeenCalledWith(null);
  });

  it("calls onTagChange with the tag name when an inactive tag is clicked", () => {
    const onTagChange = vi.fn();
    render(
      <ApiTagFilter
        tags={MOCK_TAGS}
        selectedTag={null}
        onTagChange={onTagChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /weather/i }));
    expect(onTagChange).toHaveBeenCalledWith("weather");
  });

  it("calls onTagChange with null when the currently active tag is clicked again (toggle off)", () => {
    const onTagChange = vi.fn();
    render(
      <ApiTagFilter
        tags={MOCK_TAGS}
        selectedTag="weather"
        onTagChange={onTagChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /weather/i }));
    expect(onTagChange).toHaveBeenCalledWith(null);
  });

  it("renders matching tag case-insensitively for selection", () => {
    render(
      <ApiTagFilter
        tags={MOCK_TAGS}
        selectedTag="Weather" // different casing
        onTagChange={() => {}}
      />,
    );
    expect(
      screen
        .getByRole("button", { name: /weather/i })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  // ── Accessibility ───────────────────────────────────────────────────────

  it("uses role='group' with aria-label for the container", () => {
    render(
      <ApiTagFilter
        tags={MOCK_TAGS}
        selectedTag={null}
        onTagChange={() => {}}
      />,
    );
    const group = screen.getByRole("group", { name: "Filter by tag" });
    expect(group).toBeTruthy();
  });

  it("has aria-pressed on every pill button", () => {
    render(
      <ApiTagFilter
        tags={MOCK_TAGS}
        selectedTag={null}
        onTagChange={() => {}}
      />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
    for (const btn of buttons) {
      expect(btn.hasAttribute("aria-pressed")).toBe(true);
    }
  });

  // ── CSS classnames ───────────────────────────────────────────────────────

  it("applies the BEM block class to the container", () => {
    render(
      <ApiTagFilter
        tags={MOCK_TAGS}
        selectedTag={null}
        onTagChange={() => {}}
      />,
    );
    const group = screen.getByRole("group", { name: "Filter by tag" });
    expect(group.classList.contains("api-tag-filter")).toBe(true);
  });

  it("applies active modifier class to selected pills", () => {
    render(
      <ApiTagFilter
        tags={MOCK_TAGS}
        selectedTag="geo"
        onTagChange={() => {}}
      />,
    );
    const geoBtn = screen.getByRole("button", { name: /geo/i });
    expect(geoBtn.classList.contains("api-tag-filter__pill--active")).toBe(
      true,
    );

    // All should not be active
    const allBtn = screen.getByRole("button", { name: "All" });
    expect(allBtn.classList.contains("api-tag-filter__pill--active")).toBe(
      false,
    );
  });

  // ── Responsive layout ────────────────────────────────────────────────────

  describe("responsive layout", () => {
    it("renders the api-tag-filter container for CSS responsive rules", () => {
      const { container } = render(
        <ApiTagFilter
          tags={MOCK_TAGS}
          selectedTag={null}
          onTagChange={() => {}}
        />,
      );
      const filter = container.querySelector(".api-tag-filter");
      expect(filter).toBeTruthy();
    });

    it("renders all pills even with many tags (no overflow clipping in DOM)", () => {
      const manyTags = Array.from({ length: 20 }, (_, i) => `tag-${i}`);
      render(
        <ApiTagFilter
          tags={manyTags}
          selectedTag={null}
          onTagChange={() => {}}
        />,
      );
      // "All" + 20 tags = 21 buttons
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBe(21);
    });

    it("each pill uses flex-shrink:0 so pills don't collapse on narrow viewports", () => {
      render(
        <ApiTagFilter
          tags={MOCK_TAGS}
          selectedTag={null}
          onTagChange={() => {}}
        />,
      );
      const allBtn = screen.getByRole("button", { name: "All" });
      expect(allBtn.classList.contains("api-tag-filter__pill")).toBe(true);
    });
  });

  // ── Tooltip Primitive Integration ──────────────────────────────────────────

  describe("Tooltip primitive integration", () => {
    it("wraps tag pills in Tooltip and displays tooltip on hover", () => {
      render(
        <ApiTagFilter
          tags={MOCK_TAGS}
          selectedTag={null}
          onTagChange={() => {}}
        />,
      );
      const weatherBtn = screen.getByRole("button", { name: /weather/i });
      expect(screen.queryByRole("tooltip")).toBeNull();

      fireEvent.mouseEnter(weatherBtn);
      const tooltip = screen.getByRole("tooltip");
      expect(tooltip).toBeTruthy();
      expect(tooltip.textContent).toMatch(/weather/i);

      fireEvent.mouseLeave(weatherBtn);
      expect(screen.queryByRole("tooltip")).toBeNull();
    });

    it("respects hoverDelayMs when passed to ApiTagFilter", () => {
      vi.useFakeTimers();
      render(
        <ApiTagFilter
          tags={MOCK_TAGS}
          selectedTag={null}
          onTagChange={() => {}}
          hoverDelayMs={250}
        />,
      );
      const weatherBtn = screen.getByRole("button", { name: /weather/i });

      fireEvent.mouseEnter(weatherBtn);
      expect(screen.queryByRole("tooltip")).toBeNull();

      act(() => {
        vi.advanceTimersByTime(250);
      });
      expect(screen.getByRole("tooltip")).toBeTruthy();

      vi.useRealTimers();
    });

    it("opens tooltip on touch long-press with longPressMs", () => {
      vi.useFakeTimers();
      render(
        <ApiTagFilter
          tags={MOCK_TAGS}
          selectedTag={null}
          onTagChange={() => {}}
          longPressMs={300}
        />,
      );
      const geoBtn = screen.getByRole("button", { name: /geo/i });

      fireEvent.touchStart(geoBtn);
      expect(screen.queryByRole("tooltip")).toBeNull();

      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(screen.getByRole("tooltip")).toBeTruthy();

      vi.useRealTimers();
    });
  });

  // ── Loading state ────────────────────────────────────────────────────────

  it("renders the skeleton instead of tags when isLoading is true", () => {
    const { container } = render(
      <ApiTagFilter
        tags={MOCK_TAGS}
        selectedTag={null}
        onTagChange={() => {}}
        isLoading={true}
      />,
    );
    // Should not render the "All" button or tag buttons
    expect(screen.queryByRole("button", { name: "All" })).toBeNull();
    // Should render the skeleton
    const skeletonPills = container.querySelectorAll(".skeleton");
    expect(skeletonPills.length).toBeGreaterThan(0);
  });

  // ── Keyboard shortcut hints (issue #444) ──────────────────────────────────

  describe("keyboard shortcut hints", () => {
    it("renders KbdHint with tag filter shortcuts", () => {
      render(
        <ApiTagFilter
          tags={MOCK_TAGS}
          selectedTag={null}
          onTagChange={() => {}}
        />,
      );
      const hint = screen.getByRole("complementary", { name: "Tag filter keyboard shortcuts" });
      expect(hint).toBeTruthy();
    });

    it("shows Tab shortcut for navigating between tags", () => {
      render(
        <ApiTagFilter
          tags={MOCK_TAGS}
          selectedTag={null}
          onTagChange={() => {}}
        />,
      );
      expect(screen.getByText("Tab")).toBeTruthy();
      expect(screen.getByText("Navigate between tags")).toBeTruthy();
    });

    it("shows Enter shortcut for toggling tag selection", () => {
      render(
        <ApiTagFilter
          tags={MOCK_TAGS}
          selectedTag={null}
          onTagChange={() => {}}
        />,
      );
      expect(screen.getByText("Enter")).toBeTruthy();
      expect(screen.getByText("Toggle tag selection")).toBeTruthy();
    });

    it("uses chip variant for the kbd hint", () => {
      render(
        <ApiTagFilter
          tags={MOCK_TAGS}
          selectedTag={null}
          onTagChange={() => {}}
        />,
      );
      const hint = screen.getByRole("complementary", { name: "Tag filter keyboard shortcuts" });
      expect(hint.classList.contains("kbd-hint--chip")).toBe(true);
    });

    it("has correct aria-label on kbd-hint", () => {
      render(
        <ApiTagFilter
          tags={MOCK_TAGS}
          selectedTag={null}
          onTagChange={() => {}}
        />,
      );
      const hint = screen.getByRole("complementary", { name: "Tag filter keyboard shortcuts" });
      expect(hint.getAttribute("aria-label")).toBe("Tag filter keyboard shortcuts");
    });
  });

  // ── Tooltip primitive integration (issue #533) ───────────────────────────

  describe("Tooltip primitive integration", () => {
    it("wraps tag icon buttons in Tooltip and displays tooltip on hover", () => {
      render(
        <ApiTagFilter
          tags={MOCK_TAGS}
          selectedTag={null}
          onTagChange={() => {}}
        />,
      );
      const weatherBtn = screen.getByRole("button", { name: /weather/i });
      expect(screen.queryByRole("tooltip")).toBeNull();

      fireEvent.mouseEnter(weatherBtn);
      const tooltip = screen.getByRole("tooltip");
      expect(tooltip).toBeTruthy();
      expect(tooltip.textContent).toMatch(/weather/i);

      fireEvent.mouseLeave(weatherBtn);
      expect(screen.queryByRole("tooltip")).toBeNull();
    });

    it("respects hoverDelayMs when passed to ApiTagFilter", () => {
      vi.useFakeTimers();
      render(
        <ApiTagFilter
          tags={MOCK_TAGS}
          selectedTag={null}
          onTagChange={() => {}}
          hoverDelayMs={250}
        />,
      );
      const weatherBtn = screen.getByRole("button", { name: /weather/i });

      fireEvent.mouseEnter(weatherBtn);
      expect(screen.queryByRole("tooltip")).toBeNull();

      act(() => {
        vi.advanceTimersByTime(250);
      });
      expect(screen.getByRole("tooltip")).toBeTruthy();

      vi.useRealTimers();
    });

    it("opens tooltip on touch long-press with longPressMs", () => {
      vi.useFakeTimers();
      render(
        <ApiTagFilter
          tags={MOCK_TAGS}
          selectedTag={null}
          onTagChange={() => {}}
          longPressMs={300}
        />,
      );
      const geoBtn = screen.getByRole("button", { name: /geo/i });

      fireEvent.touchStart(geoBtn);
      expect(screen.queryByRole("tooltip")).toBeNull();

      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(screen.getByRole("tooltip")).toBeTruthy();

      vi.useRealTimers();
    });
  });
});

// ── getAllUniqueTags utility ────────────────────────────────────────────────

describe("getAllUniqueTags", () => {
  it("returns a sorted array of unique tags from mock data", () => {
    const tags = getAllUniqueTags();
    expect(tags.length).toBeGreaterThan(0);
    for (let i = 0; i < tags.length - 1; i++) {
      expect(tags[i] < tags[i + 1]).toBe(true);
    }
    expect(new Set(tags).size).toBe(tags.length);
  });

  it("contains expected tags from the mock dataset", () => {
    const tags = getAllUniqueTags();
    expect(tags).toContain("weather");
    expect(tags).toContain("geo");
    expect(tags).toContain("forecast");
    expect(tags).toContain("payments");
    expect(tags).toContain("cards");
    expect(tags).toContain("sms");
    expect(tags).toContain("email");
  });

  it("returns a new array on each call", () => {
    const a = getAllUniqueTags();
    const b = getAllUniqueTags();
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });
});
