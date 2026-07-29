import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import SubscribeCTA from "./SubscribeCTA";

// Mock IntersectionObserver
let observerCallback: any = null;
const observeMock = vi.fn();
const disconnectMock = vi.fn();

Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  value: vi.fn().mockImplementation((cb) => {
    observerCallback = cb;
    return {
      observe: observeMock,
      unobserve: vi.fn(),
      disconnect: disconnectMock,
    };
  }),
});

describe("SubscribeCTA Component", () => {
  afterEach(() => {
    cleanup();
    // Remove dummy CTA elements added during tests
    document.querySelectorAll(".api-hero__cta--detail").forEach((el) => el.remove());
  });

  beforeEach(() => {
    vi.clearAllMocks();
    observerCallback = null;
    // Set up a mock element in the document to satisfy querySelector
    const dummyCta = document.createElement("div");
    dummyCta.className = "api-hero__cta--detail";
    document.body.appendChild(dummyCta);
  });

  it("renders API details and the subscribe button correctly", () => {
    const { container } = render(
      <SubscribeCTA
        apiName="WeatherSim API"
        pricePerRequest={0.01}
        observeElementSelector=".api-hero__cta--detail"
      />
    );

    expect(screen.getByText("WeatherSim API")).toBeTruthy();
    expect(screen.getByText("$0.010")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Subscribe to WeatherSim API/i })).toBeTruthy();
  });

  it("becomes visible when the observed element goes out of view", () => {
    const { container } = render(
      <SubscribeCTA
        apiName="WeatherSim API"
        pricePerRequest={0.01}
        observeElementSelector=".api-hero__cta--detail"
      />
    );

    const ctaBar = container.querySelector(".subscribe-cta-bar");
    expect(ctaBar?.classList.contains("subscribe-cta-bar--visible")).toBe(false);

    // Simulate hero section scrolling out of view (isIntersecting = false)
    expect(observerCallback).toBeTruthy();
    act(() => {
      observerCallback([{ isIntersecting: false }]);
    });

    expect(ctaBar?.classList.contains("subscribe-cta-bar--visible")).toBe(true);
  });

  it("hides when the observed element scrolls back into view", () => {
    const { container } = render(
      <SubscribeCTA
        apiName="WeatherSim API"
        pricePerRequest={0.01}
        observeElementSelector=".api-hero__cta--detail"
      />
    );

    const ctaBar = container.querySelector(".subscribe-cta-bar");

    // Make visible first
    act(() => {
      observerCallback([{ isIntersecting: false }]);
    });
    expect(ctaBar?.classList.contains("subscribe-cta-bar--visible")).toBe(true);

    // Scroll back into view (isIntersecting = true)
    act(() => {
      observerCallback([{ isIntersecting: true }]);
    });
    expect(ctaBar?.classList.contains("subscribe-cta-bar--visible")).toBe(false);
  });

  // ── Tooltip Primitive Integration (issue #746) ────────────────────────────

  describe("Tooltip primitive on icon buttons", () => {
    function setup() {
      const utils = render(
        <SubscribeCTA
          apiName="WeatherSim API"
          pricePerRequest={0.01}
          observeElementSelector=".api-hero__cta--detail"
        />
      );
      const copyButton = screen.getByRole("button", { name: /copy link/i });
      return { ...utils, copyButton };
    }

    it("tooltip is hidden by default", () => {
      setup();
      expect(screen.queryByRole("tooltip")).toBeNull();
    });

    it("shows tooltip on hover (after hover delay) and hides on leave", () => {
      vi.useFakeTimers();
      const { copyButton } = setup();

      fireEvent.mouseEnter(copyButton);
      // Not visible before delay elapses
      expect(screen.queryByRole("tooltip")).toBeNull();

      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(screen.getByRole("tooltip")).toBeTruthy();

      fireEvent.mouseLeave(copyButton);
      expect(screen.queryByRole("tooltip")).toBeNull();

      vi.useRealTimers();
    });

    it("shows tooltip on keyboard focus and links via aria-describedby", () => {
      const { copyButton } = setup();

      fireEvent.focus(copyButton);
      const tip = screen.getByRole("tooltip");
      expect(copyButton.getAttribute("aria-describedby")).toBe(tip.id);
    });

    it("dismisses tooltip on Escape", () => {
      vi.useFakeTimers();
      const { copyButton } = setup();

      fireEvent.mouseEnter(copyButton);
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(screen.getByRole("tooltip")).toBeTruthy();

      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByRole("tooltip")).toBeNull();

      vi.useRealTimers();
    });

    it("respects hoverDelayMs before showing tooltip", () => {
      vi.useFakeTimers();
      const { copyButton } = setup();

      fireEvent.mouseEnter(copyButton);
      expect(screen.queryByRole("tooltip")).toBeNull();

      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(screen.getByRole("tooltip")).toBeTruthy();

      vi.useRealTimers();
    });

    it("cancels hover delay if mouse leaves before timer finishes", () => {
      vi.useFakeTimers();
      const { copyButton } = setup();

      fireEvent.mouseEnter(copyButton);
      act(() => {
        vi.advanceTimersByTime(150);
      });
      fireEvent.mouseLeave(copyButton);
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(screen.queryByRole("tooltip")).toBeNull();

      vi.useRealTimers();
    });

    it("opens tooltip on touch long-press", () => {
      vi.useFakeTimers();
      const { copyButton } = setup();

      fireEvent.touchStart(copyButton);
      expect(screen.queryByRole("tooltip")).toBeNull();

      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.getByRole("tooltip")).toBeTruthy();

      vi.useRealTimers();
    });
  });
});
