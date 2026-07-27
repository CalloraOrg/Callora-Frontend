// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EmptyState from "./EmptyState";
import type { EmptyStateSize, EmptyStateVariant } from "./EmptyState";

describe("EmptyState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("variants", () => {
    const variants: EmptyStateVariant[] = ["empty", "api-detail", "filtered", "error", "plan-badge", "risk-gauge"];

    it.each(variants)("renders the %s variant illustration", (variant) => {
      render(<EmptyState variant={variant} />);
      const wrapper = screen.getByTestId(`empty-state-${variant}`);
      expect(wrapper).toBeTruthy();
      expect(wrapper.querySelector("svg")).toBeTruthy();
    });

    it.each(variants)("uses default title for %s variant", (variant) => {
      render(<EmptyState variant={variant} />);
      const titles = {
        empty: /No APIs available/i,
        "api-detail": /API not found/i,
        filtered: /No results found/i,
        error: /Failed to load APIs/i,
        "plan-badge": /No plan selected/i,
        "risk-gauge": /No risk data yet/i,
      };
      expect(screen.getByText(titles[variant])).toBeTruthy();
    });

    it("allows overriding title and message", () => {
      render(
        <EmptyState
          variant="empty"
          title="Custom Title"
          message="Custom message body"
        />,
      );
      expect(screen.getByText("Custom Title")).toBeTruthy();
      expect(screen.getByText("Custom message body")).toBeTruthy();
    });
  });

  describe("size prop", () => {
    const sizes: EmptyStateSize[] = ["default", "compact"];

    it.each(sizes)("renders the %s size variant", (size) => {
      render(<EmptyState variant="filtered" size={size} />);
      const wrapper = screen.getByTestId("empty-state-filtered");
      expect(wrapper.getAttribute("data-size")).toBe(size);
    });

    it("uses h2 heading for default size", () => {
      const { container } = render(<EmptyState size="default" />);
      expect(container.querySelector("h2")).toBeTruthy();
      expect(container.querySelector("h3")).toBeNull();
    });

    it("uses h3 heading for compact size", () => {
      const { container } = render(<EmptyState size="compact" />);
      expect(container.querySelector("h3")).toBeTruthy();
      expect(container.querySelector("h2")).toBeNull();
    });

    it("uses shorter default message for compact filtered variant", () => {
      render(<EmptyState variant="filtered" size="compact" />);
      expect(
        screen.getByText(/Adjust filters or clear to see results/i),
      ).toBeTruthy();
    });

    it("uses shorter default message for compact error variant", () => {
      render(<EmptyState variant="error" size="compact" />);
      expect(
        screen.getByText(/Error loading results. Please retry./i),
      ).toBeTruthy();
    });
  });

  describe("filtered variant — onClearFilters", () => {
    it("renders clear filters button when onClearFilters is provided", () => {
      const onClearFilters = vi.fn();
      render(<EmptyState variant="filtered" onClearFilters={onClearFilters} />);
      const btn = screen.getByTestId("empty-state-clear-filters");
      expect(btn).toBeTruthy();
    });

    it("does not render clear filters button for non-filtered variants", () => {
      const onClearFilters = vi.fn();
      render(<EmptyState variant="empty" onClearFilters={onClearFilters} />);
      expect(screen.queryByTestId("empty-state-clear-filters")).toBeNull();
    });

    it("calls onClearFilters when clear button is clicked", () => {
      const onClearFilters = vi.fn();
      render(<EmptyState variant="filtered" onClearFilters={onClearFilters} />);
      fireEvent.click(screen.getByTestId("empty-state-clear-filters"));
      expect(onClearFilters).toHaveBeenCalledTimes(1);
    });

    it("shows 'Clear filters' (compact) vs 'Clear all filters' (default)", () => {
      const onClearFilters = vi.fn();
      const { rerender } = render(
        <EmptyState
          variant="filtered"
          size="compact"
          onClearFilters={onClearFilters}
        />,
      );
      expect(
        screen.getByTestId("empty-state-clear-filters").textContent,
      ).toMatch(/^Clear filters$/);
      rerender(
        <EmptyState
          variant="filtered"
          size="default"
          onClearFilters={onClearFilters}
        />,
      );
      expect(
        screen.getByTestId("empty-state-clear-filters").textContent,
      ).toMatch(/Clear all filters/);
    });
  });

  describe("error variant — onRetry", () => {
    it("renders retry button when onRetry is provided", () => {
      const onRetry = vi.fn();
      render(<EmptyState variant="error" onRetry={onRetry} />);
      expect(screen.getByText(/^Retry$/)).toBeTruthy();
    });

    it("calls onRetry exactly once per click and handles async", async () => {
      let resolveRetry!: () => void;
      const onRetry = vi.fn(() => new Promise<void>((r) => (resolveRetry = r)));
      render(<EmptyState variant="error" onRetry={onRetry} />);
      const btn = screen.getByText(/^Retry$/);
      fireEvent.click(btn);
      expect(onRetry).toHaveBeenCalledTimes(1);
      resolveRetry();
      await new Promise((r) => setTimeout(r, 20));
    });

    it("shows loading state while retrying (aria-busy)", async () => {
      let resolveRetry: () => void;
      const onRetry = vi.fn(() => new Promise<void>((r) => (resolveRetry = r)));
      render(<EmptyState variant="error" onRetry={onRetry} />);
      const btn = screen.getByText(/^Retry$/);
      fireEvent.click(btn);
      expect(btn.hasAttribute("disabled")).toBe(true);
      expect(btn.getAttribute("aria-busy")).toBe("true");
      expect(btn.textContent).toMatch(/Retrying/);
      resolveRetry();
      await new Promise((r) => setTimeout(r, 20));
      expect(btn.textContent).toMatch(/^Retry$/);
    });

    it("does not render external status link for compact size", () => {
      const onRetry = vi.fn();
      const { container } = render(
        <EmptyState variant="error" size="compact" onRetry={onRetry} />,
      );
      expect(container.querySelector("a")).toBeNull();
    });

    it("renders external status link for default size", () => {
      const onRetry = vi.fn();
      render(<EmptyState variant="error" size="default" onRetry={onRetry} />);
      expect(screen.getByText(/Check system status/i)).toBeTruthy();
    });
  });

  describe("custom action prop", () => {
    it("renders a custom action button", () => {
      const onClick = vi.fn();
      render(<EmptyState action={{ label: "Do something", onClick }} />);
      const btn = screen.getByText("Do something");
      expect(btn).toBeTruthy();
      fireEvent.click(btn);
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("accessibility", () => {
    it("illustration wrapper is aria-hidden", () => {
      const { container } = render(<EmptyState />);
      const wrapper = container.querySelector('[aria-hidden="true"]');
      expect(wrapper).toBeTruthy();
      expect(wrapper?.querySelector("svg")).toBeTruthy();
    });

    it("nested SVG illustrations also carry aria-hidden (WCAG 1.1.1 Non-text Content)", () => {
      const variants: EmptyStateVariant[] = ["empty", "api-detail", "filtered", "error"];
      variants.forEach((variant) => {
        const { container, unmount } = render(<EmptyState variant={variant} />);
        const svgs = container.querySelectorAll("svg");
        svgs.forEach((svg) => {
          expect(svg.getAttribute("aria-hidden")).toBe("true");
        });
        unmount();
      });
    });

    it("SVG illustrations use strokeLinecap='round' for consistent v7 line-art style", () => {
      const variants: EmptyStateVariant[] = ["empty", "api-detail", "filtered", "error"];
      variants.forEach((variant) => {
        const { container, unmount } = render(
          <EmptyState variant={variant} size="default" />,
        );
        const svg = container.querySelector("svg");
        expect(svg).toBeTruthy();
        expect(svg?.getAttribute("stroke-linecap")).toBe("round");
        expect(svg?.getAttribute("stroke-linejoin")).toBe("round");
        unmount();
      });
    });
  });

  describe("v7 illustration refinements — design-token consistency", () => {
    it("filtered illustration uses var(--muted) for primary stroke and var(--accent) for accent marks", () => {
      const { container } = render(
        <EmptyState variant="filtered" size="default" />,
      );
      const svg = container.querySelector("svg");
      expect(svg).toBeTruthy();
      const mutedStrokes = svg?.querySelectorAll('[stroke="var(--muted)"]');
      const accentStrokes = svg?.querySelectorAll('[stroke="var(--accent)"]');
      const accentFills = svg?.querySelectorAll('[fill="var(--accent)"]');
      expect((mutedStrokes?.length ?? 0) >= 2).toBe(true);
      expect(
        (accentStrokes?.length ?? 0) + (accentFills?.length ?? 0) >= 1,
      ).toBe(true);
    });

    it("empty illustration uses var(--accent) for decorative sparkle dots (non-semantic highlights)", () => {
      const { container } = render(
        <EmptyState variant="empty" size="default" />,
      );
      const svg = container.querySelector("svg");
      expect(svg).toBeTruthy();
      const accentFills = svg?.querySelectorAll('[fill="var(--accent)"]');
      expect((accentFills?.length ?? 0) >= 2).toBe(true);
    });

    it("api-detail illustration uses tokenized API card and plug motifs", () => {
      const { container } = render(<EmptyState variant="api-detail" />);
      const svg = container.querySelector("svg");
      expect(svg?.querySelector("rect")).toBeTruthy();
      expect(
        (svg?.querySelectorAll('[stroke="var(--accent)"]').length ?? 0) >= 1,
      ).toBe(true);
    });

    it("error illustration uses var(--accent) for the exclamation caret highlight", () => {
      const { container } = render(
        <EmptyState variant="error" size="default" />,
      );
      const svg = container.querySelector("svg");
      expect(svg).toBeTruthy();
      const accentStrokes = svg?.querySelectorAll('[stroke="var(--accent)"]');
      expect((accentStrokes?.length ?? 0) >= 1).toBe(true);
    });

    it("illustration wrapper circle uses tokenized backgrounds (compact=--surface, default=--surface-soft)", () => {
      const { container, rerender } = render(<EmptyState size="default" />);
      const wrapperDefault = container.querySelector(
        '[aria-hidden="true"]',
      ) as HTMLElement | null;
      expect(wrapperDefault?.style.background).toBe("var(--surface-soft)");

      rerender(<EmptyState size="compact" />);
      const wrapperCompact = container.querySelector(
        '[aria-hidden="true"]',
      ) as HTMLElement | null;
      expect(wrapperCompact?.style.background).toBe("var(--surface)");
    });

    it("compact-sized filtered illustration uses a smaller viewBox box (28px) than default (40px)", () => {
      const { container, rerender } = render(
        <EmptyState variant="filtered" size="default" />,
      );
      const svgDefault = container.querySelector("svg");
      expect(svgDefault?.getAttribute("width")).toBe("40");
      expect(svgDefault?.getAttribute("height")).toBe("40");

      rerender(<EmptyState variant="filtered" size="compact" />);
      const svgCompact = container.querySelector("svg");
      expect(svgCompact?.getAttribute("width")).toBe("28");
      expect(svgCompact?.getAttribute("height")).toBe("28");
    });

    it("filtered illustration contains the magnifier-with-slash focal motif (the core no-match metaphor)", () => {
      const { container } = render(
        <EmptyState variant="filtered" size="compact" />,
      );
      const svg = container.querySelector("svg");
      expect(svg).toBeTruthy();
      const circles = svg?.querySelectorAll("circle");
      const accentDiagonals = svg?.querySelectorAll('[stroke="var(--accent)"]');
      expect(circles).toBeTruthy();
      expect((circles?.length ?? 0) >= 1).toBe(true);
      expect((accentDiagonals?.length ?? 0) >= 1).toBe(true);
    });

    it("no illustration contains hardcoded hex colors — all strokes/fills reference design tokens", () => {
      const variants: EmptyStateVariant[] = ["empty", "api-detail", "filtered", "error"];
      const hexRe = /#[0-9a-f]{3,8}/i;
      variants.forEach((variant) => {
        const { container, unmount } = render(<EmptyState variant={variant} />);
        const svg = container.querySelector("svg");
        const html = svg?.outerHTML ?? "";
        expect(hexRe.test(html)).toBe(false);
        unmount();
      });
    });
  });

  describe("loading skeleton", () => {
    it("renders EmptyStateSkeleton when loading prop is true", () => {
      const { container } = render(<EmptyState loading />);
      const skeleton = container.querySelector(".empty-state-skeleton");
      expect(skeleton).toBeTruthy();
      expect(skeleton?.getAttribute("aria-busy")).toBe("true");
      expect(skeleton?.getAttribute("aria-label")).toBe("Loading empty state");
      
      const shimmerElements = skeleton?.querySelectorAll(".skeleton");
      expect(shimmerElements?.length).toBeGreaterThanOrEqual(3);
    });

    it("applies compact classes/styles for compact size skeleton", () => {
      const { container } = render(<EmptyState loading size="compact" />);
      const skeleton = container.querySelector(".empty-state-skeleton");
      expect(skeleton?.classList.contains("empty-state-skeleton--compact")).toBe(true);
      expect((skeleton as HTMLElement).style.padding).toBe("16px 12px");
    });

    it("applies default styles and min-height for default size skeleton", () => {
      const { container } = render(<EmptyState loading size="default" />);
      const skeleton = container.querySelector(".empty-state-skeleton");
      expect(skeleton?.classList.contains("empty-state-skeleton--compact")).toBe(false);
      expect((skeleton as HTMLElement).style.minHeight).toBe("300px");
      expect((skeleton as HTMLElement).style.padding).toBe("48px 32px");
    });

    it("renders action button placeholder only when hasAction is determined", () => {
      const { container: noAction } = render(<EmptyState loading />);
      const initialSkeletonsCount = noAction.querySelectorAll(".skeleton").length;

      const { container: withAction } = render(
        <EmptyState loading action={{ label: "Go", onClick: () => {} }} />
      );
      const withActionSkeletonsCount = withAction.querySelectorAll(".skeleton").length;
      expect(withActionSkeletonsCount).toBe(initialSkeletonsCount + 1);
    });
  });
});
