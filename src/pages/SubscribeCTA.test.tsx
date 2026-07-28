// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SubscribeCTA from "./SubscribeCTA";

// ── IntersectionObserver mock ─────────────────────────────────────────────────
let observerCallback: ((entries: { isIntersecting: boolean }[]) => void) | null =
  null;
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

// ── clipboard mock ────────────────────────────────────────────────────────────
const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, "clipboard", {
  writable: true,
  value: { writeText: clipboardWriteText },
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  observerCallback = null;
});

// ═══════════════════════════════════════════════════════════════════════════════
// Existing visibility tests — retained without modification
// ═══════════════════════════════════════════════════════════════════════════════
describe("SubscribeCTA Component", () => {
  beforeEach(() => {
    const dummyCta = document.createElement("div");
    dummyCta.className = "api-hero__cta--detail";
    document.body.appendChild(dummyCta);
  });

  it("renders API details and the subscribe button correctly", () => {
    render(
      <SubscribeCTA
        apiName="WeatherSim API"
        pricePerRequest={0.01}
        observeElementSelector=".api-hero__cta--detail"
      />
    );

    expect(screen.getByText("WeatherSim API")).toBeTruthy();
    expect(screen.getByText("$0.010")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Subscribe to WeatherSim API/i })
    ).toBeTruthy();
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

    expect(observerCallback).toBeTruthy();
    act(() => {
      observerCallback!([{ isIntersecting: false }]);
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

    act(() => {
      observerCallback!([{ isIntersecting: false }]);
    });
    expect(ctaBar?.classList.contains("subscribe-cta-bar--visible")).toBe(true);

    act(() => {
      observerCallback!([{ isIntersecting: true }]);
    });
    expect(ctaBar?.classList.contains("subscribe-cta-bar--visible")).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GrantFox FWC26 — Tooltip wiring for icon-only buttons
// ═══════════════════════════════════════════════════════════════════════════════
describe("SubscribeCTA – icon-only buttons and Tooltip wiring", () => {
  // ── Rendering ──────────────────────────────────────────────────────────────
  it("renders the Share icon button with an accessible aria-label", () => {
    render(
      <SubscribeCTA apiName="WeatherSim API" pricePerRequest={0.01} />
    );
    expect(
      screen.getByRole("button", { name: "Share WeatherSim API" })
    ).toBeTruthy();
  });

  it("renders the Bookmark icon button with an accessible aria-label in the unsaved state", () => {
    render(
      <SubscribeCTA apiName="WeatherSim API" pricePerRequest={0.01} />
    );
    expect(
      screen.getByRole("button", { name: "Save WeatherSim API" })
    ).toBeTruthy();
  });

  it("renders the Bookmark button with the 'saved' label and aria-pressed=true when isBookmarked=true", () => {
    render(
      <SubscribeCTA
        apiName="WeatherSim API"
        pricePerRequest={0.01}
        isBookmarked
      />
    );
    const btn = screen.getByRole("button", {
      name: "Remove WeatherSim API from saved",
    });
    expect(btn).toBeTruthy();
    expect(btn.getAttribute("aria-pressed")).toBe("true");
  });

  it("both icon buttons are inside a group with an accessible label", () => {
    render(
      <SubscribeCTA apiName="WeatherSim API" pricePerRequest={0.01} />
    );
    const group = screen.getByRole("group", { name: "API actions" });
    expect(group).toBeTruthy();
  });

  // ── Tooltip — hover delay ──────────────────────────────────────────────────
  it("Share tooltip is hidden before the hover delay elapses", () => {
    vi.useFakeTimers();
    render(
      <SubscribeCTA
        apiName="WeatherSim API"
        pricePerRequest={0.01}
        tooltipHoverDelayMs={300}
      />
    );
    const shareBtn = screen.getByRole("button", { name: "Share WeatherSim API" });
    fireEvent.mouseEnter(shareBtn);
    // No tooltip before delay
    expect(screen.queryByRole("tooltip")).toBeNull();
    vi.useRealTimers();
  });

  it("Share tooltip appears after the hover delay and sets aria-describedby", () => {
    vi.useFakeTimers();
    render(
      <SubscribeCTA
        apiName="WeatherSim API"
        pricePerRequest={0.01}
        tooltipHoverDelayMs={300}
      />
    );
    const shareBtn = screen.getByRole("button", { name: "Share WeatherSim API" });
    fireEvent.mouseEnter(shareBtn);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    const tip = screen.getByRole("tooltip");
    expect(tip).toBeTruthy();
    expect(tip.textContent).toBe("Share WeatherSim API");
    expect(shareBtn.getAttribute("aria-describedby")).toBe(tip.id);
    vi.useRealTimers();
  });

  it("Share tooltip hides when the mouse leaves before the delay completes", () => {
    vi.useFakeTimers();
    render(
      <SubscribeCTA
        apiName="WeatherSim API"
        pricePerRequest={0.01}
        tooltipHoverDelayMs={300}
      />
    );
    const shareBtn = screen.getByRole("button", { name: "Share WeatherSim API" });
    fireEvent.mouseEnter(shareBtn);
    act(() => {
      vi.advanceTimersByTime(150); // not yet elapsed
    });
    fireEvent.mouseLeave(shareBtn);
    act(() => {
      vi.advanceTimersByTime(200); // would have triggered if not cancelled
    });
    expect(screen.queryByRole("tooltip")).toBeNull();
    vi.useRealTimers();
  });

  it("Bookmark tooltip appears after the hover delay with the correct label", () => {
    vi.useFakeTimers();
    render(
      <SubscribeCTA
        apiName="WeatherSim API"
        pricePerRequest={0.01}
        tooltipHoverDelayMs={200}
      />
    );
    const bookmarkBtn = screen.getByRole("button", { name: "Save WeatherSim API" });
    fireEvent.mouseEnter(bookmarkBtn);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    const tip = screen.getByRole("tooltip");
    expect(tip.textContent).toBe("Save WeatherSim API");
    vi.useRealTimers();
  });

  // ── Tooltip — keyboard focus ────────────────────────────────────────────────
  it("Share tooltip appears immediately on keyboard focus", () => {
    render(
      <SubscribeCTA apiName="WeatherSim API" pricePerRequest={0.01} />
    );
    const shareBtn = screen.getByRole("button", { name: "Share WeatherSim API" });
    fireEvent.focus(shareBtn);
    expect(screen.getByRole("tooltip")).toBeTruthy();
  });

  it("Share tooltip hides when the trigger loses focus", () => {
    render(
      <SubscribeCTA apiName="WeatherSim API" pricePerRequest={0.01} />
    );
    const shareBtn = screen.getByRole("button", { name: "Share WeatherSim API" });
    fireEvent.focus(shareBtn);
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.blur(shareBtn);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("Bookmark tooltip appears immediately on keyboard focus", () => {
    render(
      <SubscribeCTA apiName="WeatherSim API" pricePerRequest={0.01} />
    );
    const bookmarkBtn = screen.getByRole("button", {
      name: "Save WeatherSim API",
    });
    fireEvent.focus(bookmarkBtn);
    expect(screen.getByRole("tooltip")).toBeTruthy();
  });

  // ── Tooltip — Escape dismissal ─────────────────────────────────────────────
  it("Escape dismisses an open tooltip on the Share button", () => {
    vi.useFakeTimers();
    render(
      <SubscribeCTA
        apiName="WeatherSim API"
        pricePerRequest={0.01}
        tooltipHoverDelayMs={300}
      />
    );
    const shareBtn = screen.getByRole("button", { name: "Share WeatherSim API" });
    fireEvent.mouseEnter(shareBtn);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
    vi.useRealTimers();
  });

  it("Escape dismisses an open tooltip on the Bookmark button", () => {
    render(
      <SubscribeCTA apiName="WeatherSim API" pricePerRequest={0.01} />
    );
    const bookmarkBtn = screen.getByRole("button", {
      name: "Save WeatherSim API",
    });
    fireEvent.focus(bookmarkBtn);
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  // ── Tooltip — touch long-press ─────────────────────────────────────────────
  it("Share tooltip opens after a touch long-press", () => {
    vi.useFakeTimers();
    render(
      <SubscribeCTA
        apiName="WeatherSim API"
        pricePerRequest={0.01}
        tooltipLongPressMs={400}
      />
    );
    const shareBtn = screen.getByRole("button", { name: "Share WeatherSim API" });
    fireEvent.touchStart(shareBtn);
    expect(screen.queryByRole("tooltip")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByRole("tooltip")).toBeTruthy();
    vi.useRealTimers();
  });

  it("Share tooltip does NOT open if touch ends before longPressMs", () => {
    vi.useFakeTimers();
    render(
      <SubscribeCTA
        apiName="WeatherSim API"
        pricePerRequest={0.01}
        tooltipLongPressMs={500}
      />
    );
    const shareBtn = screen.getByRole("button", { name: "Share WeatherSim API" });
    fireEvent.touchStart(shareBtn);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    fireEvent.touchEnd(shareBtn);
    act(() => {
      vi.advanceTimersByTime(400); // would have fired without the cancel
    });
    expect(screen.queryByRole("tooltip")).toBeNull();
    vi.useRealTimers();
  });

  it("Bookmark tooltip opens after a touch long-press", () => {
    vi.useFakeTimers();
    render(
      <SubscribeCTA
        apiName="WeatherSim API"
        pricePerRequest={0.01}
        tooltipLongPressMs={500}
      />
    );
    const bookmarkBtn = screen.getByRole("button", {
      name: "Save WeatherSim API",
    });
    fireEvent.touchStart(bookmarkBtn);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole("tooltip")).toBeTruthy();
    vi.useRealTimers();
  });

  // ── Custom delay props ─────────────────────────────────────────────────────
  it("tooltipHoverDelayMs prop is forwarded to both Tooltips", () => {
    vi.useFakeTimers();
    render(
      <SubscribeCTA
        apiName="TestAPI"
        pricePerRequest={0.005}
        tooltipHoverDelayMs={100}
      />
    );
    const shareBtn = screen.getByRole("button", { name: "Share TestAPI" });
    fireEvent.mouseEnter(shareBtn);
    // Not yet visible at 50 ms
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.queryByRole("tooltip")).toBeNull();
    // Visible at 100 ms
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.getByRole("tooltip")).toBeTruthy();
    vi.useRealTimers();
  });

  // ── Bookmark toggle behaviour ──────────────────────────────────────────────
  it("clicking the Bookmark button toggles its aria-pressed state", () => {
    render(
      <SubscribeCTA apiName="WeatherSim API" pricePerRequest={0.01} />
    );
    const bookmarkBtn = screen.getByRole("button", {
      name: "Save WeatherSim API",
    });
    expect(bookmarkBtn.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(bookmarkBtn);
    // After toggle the label and aria-pressed change
    const savedBtn = screen.getByRole("button", {
      name: "Remove WeatherSim API from saved",
    });
    expect(savedBtn.getAttribute("aria-pressed")).toBe("true");
  });

  it("clicking the Bookmark button invokes the onBookmark callback with the new state", () => {
    const onBookmark = vi.fn();
    render(
      <SubscribeCTA
        apiName="WeatherSim API"
        pricePerRequest={0.01}
        onBookmark={onBookmark}
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Save WeatherSim API" })
    );
    expect(onBookmark).toHaveBeenCalledWith(true);

    // Click again to unsave
    fireEvent.click(
      screen.getByRole("button", { name: "Remove WeatherSim API from saved" })
    );
    expect(onBookmark).toHaveBeenCalledWith(false);
    expect(onBookmark).toHaveBeenCalledTimes(2);
  });

  it("Bookmark button tooltip label updates after toggling", () => {
    render(
      <SubscribeCTA apiName="WeatherSim API" pricePerRequest={0.01} />
    );
    // Focus the bookmark button and read the tooltip before toggle
    fireEvent.focus(
      screen.getByRole("button", { name: "Save WeatherSim API" })
    );
    expect(screen.getByRole("tooltip").textContent).toBe("Save WeatherSim API");
    fireEvent.blur(
      screen.getByRole("button", { name: "Save WeatherSim API" })
    );

    // Toggle the bookmark
    fireEvent.click(
      screen.getByRole("button", { name: "Save WeatherSim API" })
    );

    // Now focus the bookmarked button
    fireEvent.focus(
      screen.getByRole("button", { name: "Remove WeatherSim API from saved" })
    );
    expect(screen.getByRole("tooltip").textContent).toBe(
      "Remove WeatherSim API from saved"
    );
  });

  // ── Share behaviour ────────────────────────────────────────────────────────
  it("clicking the Share button invokes the onShare callback when provided", () => {
    const onShare = vi.fn();
    render(
      <SubscribeCTA
        apiName="WeatherSim API"
        pricePerRequest={0.01}
        onShare={onShare}
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Share WeatherSim API" })
    );
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(clipboardWriteText).not.toHaveBeenCalled();
  });

  it("clicking the Share button copies the URL to clipboard when no onShare is provided", () => {
    render(
      <SubscribeCTA apiName="WeatherSim API" pricePerRequest={0.01} />
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Share WeatherSim API" })
    );
    expect(clipboardWriteText).toHaveBeenCalledWith(window.location.href);
  });

  // ── SVG icons ─────────────────────────────────────────────────────────────
  it("Share and Bookmark SVG icons are aria-hidden", () => {
    const { container } = render(
      <SubscribeCTA apiName="WeatherSim API" pricePerRequest={0.01} />
    );
    // Find SVGs inside the icon-btn buttons
    const iconButtons = container.querySelectorAll(
      ".subscribe-cta-bar__icon-btn"
    );
    expect(iconButtons.length).toBe(2);
    iconButtons.forEach((btn) => {
      const svg = btn.querySelector("svg");
      expect(svg).toBeTruthy();
      expect(svg?.getAttribute("aria-hidden")).toBe("true");
    });
  });

  // ── Active class ────────────────────────────────────────────────────────────
  it("Bookmark button carries subscribe-cta-bar__icon-btn--active class when bookmarked", () => {
    const { container } = render(
      <SubscribeCTA
        apiName="WeatherSim API"
        pricePerRequest={0.01}
        isBookmarked
      />
    );
    const bookmarkBtn = container.querySelector(
      ".subscribe-cta-bar__icon-btn--active"
    );
    expect(bookmarkBtn).toBeTruthy();
  });

  it("Bookmark button does NOT have the active class when not bookmarked", () => {
    const { container } = render(
      <SubscribeCTA apiName="WeatherSim API" pricePerRequest={0.01} />
    );
    expect(
      container.querySelector(".subscribe-cta-bar__icon-btn--active")
    ).toBeNull();
  });
});
