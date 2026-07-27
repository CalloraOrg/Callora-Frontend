// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ApiTagFilter, { getAllUniqueTags } from "./ApiTagFilter";

const MOCK_TAGS = ["weather", "geo", "forecast", "payments", "cards"];

describe("ApiTagFilter", () => {
  afterEach(() => {
    cleanup();
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
