import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
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
  beforeEach(() => {
    vi.clearAllMocks();
    observerCallback = null;
    // Set up a mock element in the document to satisfy querySelector
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
});
