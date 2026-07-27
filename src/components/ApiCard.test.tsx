import { render, screen, fireEvent, act, within } from "@testing-library/react";
import ApiCard from "./ApiCard";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import type { APIItem } from "../data/mockApis";
import { pinnedApisStore } from "../state/pinnedApis";

/* ── Mocks ─────────────────────────────────────────────────────────────────
   vi.mock factories are hoisted to the top of the file by Vitest, so they
   cannot reference variables declared in module scope. All mock state must
   be defined inline inside the factory.
────────────────────────────────────────────────────────────────────────── */

vi.mock("../state/collectionsStore", () => ({
  useCollections: () => ({
    collections: [],
    isEndpointSaved: () => false,
    addEndpointToCollection: vi.fn(),
    removeEndpointFromCollection: vi.fn(),
    collectionIdsForEndpoint: () => new Set(),
    createCollectionWithEndpoint: vi.fn(),
  }),
}));

vi.mock("../state/compareStore", () => ({
  useCompareStore: () => ({ apis: [], isOpen: false }),
  compareStore: {
    addApi: vi.fn(),
    removeApi: vi.fn(),
  },
}));

/* ── Shared fixture ─────────────────────────────────────────────────────── */

const mockApi: APIItem = {
  id: "api-1",
  name: "Stellar Metering API",
  description: "A mock API for testing.",
  tags: ["weather", "forecast", "geo"],
  pricePerRequest: 0.01,
  provider: { name: "Acme Labs" },
  endpoints: [{ id: "meter", url: "/api/v1/meter", method: "GET", title: "Meter" }],
};

/* ── Test suites ─────────────────────────────────────────────────────────── */

describe("ApiCard — Context Menu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom does not implement clipboard; provide a no-op stub.
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("opens context menu on right-click (contextmenu event)", () => {
    render(<ApiCard api={mockApi} onViewDetails={() => {}} />);

    const card = screen.getByRole("button", {
      name: /View details for Stellar Metering API/i,
    });
    fireEvent.contextMenu(card, { clientX: 100, clientY: 200 });

    const menu = screen.getByRole("menu");
    expect(menu).toBeTruthy();
    expect(within(menu).getByText("Copy Endpoint URL")).toBeTruthy();
    expect(within(menu).getByText("View Details")).toBeTruthy();
  });

  it("does NOT open context menu when right-clicking a button inside the card", () => {
    render(<ApiCard api={mockApi} onViewDetails={() => {}} />);

    const bookmarkBtn = screen.getByRole("button", {
      name: /Save to collection/i,
    });
    fireEvent.contextMenu(bookmarkBtn);

    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes context menu on Escape key", () => {
    render(<ApiCard api={mockApi} onViewDetails={() => {}} />);

    const card = screen.getByRole("button", {
      name: /View details for/i,
    });
    fireEvent.contextMenu(card, { clientX: 50, clientY: 50 });
    expect(screen.getByRole("menu")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes context menu after selecting an action", () => {
    const onViewDetails = vi.fn();
    render(<ApiCard api={mockApi} onViewDetails={onViewDetails} />);

    const card = screen.getByRole("button", { name: /View details for/i });
    fireEvent.contextMenu(card, { clientX: 50, clientY: 50 });
    const menu = screen.getByRole("menu");
    fireEvent.click(within(menu).getByText("View Details"));

    expect(onViewDetails).toHaveBeenCalledWith(mockApi);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("copies endpoint URL when 'Copy Endpoint URL' is clicked", () => {
    render(<ApiCard api={mockApi} onViewDetails={() => {}} />);

    const card = screen.getByRole("button", { name: /View details for/i });
    fireEvent.contextMenu(card, { clientX: 50, clientY: 50 });
    fireEvent.click(screen.getByText("Copy Endpoint URL"));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("/api/v1/meter");
  });

  it("opens context menu on long-press touch (after 600 ms)", () => {
    vi.useFakeTimers();
    render(<ApiCard api={mockApi} onViewDetails={() => {}} />);

    const card = screen.getByRole("button", { name: /View details for/i });

    fireEvent.touchStart(card, {
      touches: [{ clientX: 80, clientY: 80 }],
    });

    // Menu must NOT appear before the threshold.
    expect(screen.queryByRole("menu")).toBeNull();

    // Advance past the 600 ms long-press threshold.
    act(() => {
      vi.advanceTimersByTime(650);
    });

    expect(screen.getByRole("menu")).toBeTruthy();

    vi.useRealTimers();
  });

  it("does NOT open menu when touch ends before 600 ms (tap, not long-press)", () => {
    vi.useFakeTimers();
    render(<ApiCard api={mockApi} onViewDetails={() => {}} />);

    const card = screen.getByRole("button", { name: /View details for/i });

    fireEvent.touchStart(card, { touches: [{ clientX: 80, clientY: 80 }] });
    fireEvent.touchEnd(card); // cancel before threshold fires

    act(() => {
      vi.advanceTimersByTime(650);
    });

    expect(screen.queryByRole("menu")).toBeNull();

    vi.useRealTimers();
  });
});

describe("ApiCard — Accessibility and Tag Chips", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders tag chips with correct ARIA labels", () => {
    render(<ApiCard api={mockApi} />);

    expect(screen.getByLabelText("Filter marketplace by tag weather")).toBeTruthy();
    expect(screen.getByLabelText("Filter marketplace by tag forecast")).toBeTruthy();
    expect(screen.getByLabelText("Filter marketplace by tag geo")).toBeTruthy();
  });

  it("calls onTagClick when a tag chip is clicked", () => {
    const handleTagClick = vi.fn();
    render(<ApiCard api={mockApi} onTagClick={handleTagClick} />);

    fireEvent.click(screen.getByLabelText("Filter marketplace by tag weather"));
    expect(handleTagClick).toHaveBeenCalledWith("weather");
  });

  it("marks the active tag chip as pressed", () => {
    render(<ApiCard api={mockApi} activeTag="weather" />);

    expect(screen.getByLabelText("Filter marketplace by tag weather").getAttribute("aria-pressed")).toBe("true");
  });

  it("does not mark non-active tag chips as pressed", () => {
    render(<ApiCard api={mockApi} activeTag="weather" />);

    expect(screen.getByLabelText("Filter marketplace by tag forecast").getAttribute("aria-pressed")).toBe("false");
  });

  it("handles case-insensitive active tag matching", () => {
    render(<ApiCard api={mockApi} activeTag="WEATHER" />);

    expect(screen.getByLabelText("Filter marketplace by tag weather").getAttribute("aria-pressed")).toBe("true");
  });

  it("renders tag chips even when no activeTag is set", () => {
    render(<ApiCard api={mockApi} />);

    expect(screen.getAllByRole("button", { name: /Filter marketplace by tag/ }).length).toBe(3);
  });

  it("toggles pin state when the pin button is clicked", () => {
    pinnedApisStore._reset();
    render(<ApiCard api={mockApi} />);

    const pinButton = screen.getByRole("button", {
      name: /Pin api-1 to dashboard/i,
    });
    expect(pinButton.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(pinButton);

    expect(pinButton.getAttribute("aria-pressed")).toBe("true");
    expect(pinButton.getAttribute("aria-label")).toBe("Unpin api-1 from dashboard");
  });
});

describe("ApiCard reduced motion", () => {

  afterEach(() => {
    vi.restoreAllMocks();
    pinnedApisStore._reset();
  });

  function mockReducedMotion(enabled: boolean) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: enabled,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    }));
  }

  it("uses none transition on action buttons when prefers-reduced-motion is set", () => {
    mockReducedMotion(true);
    render(<ApiCard api={mockApi} />);

    const buttons = screen.getAllByRole("button");
    const reducedButtons = buttons.filter(
      (btn) =>
        btn.style.transition === "none" &&
        (btn.getAttribute("aria-label")?.includes("api-1") ||
          btn.getAttribute("aria-label")?.includes("favorites") ||
          btn.getAttribute("aria-label")?.includes("collection"))
    );
    expect(reducedButtons.length).toBeGreaterThanOrEqual(2);
  });

  it("preserves normal transitions when prefers-reduced-motion is not set", () => {
    mockReducedMotion(false);
    render(<ApiCard api={mockApi} />);

    const buttons = screen.getAllByRole("button");
    const normalButtons = buttons.filter(
      (btn) => btn.style.transition && btn.style.transition !== "none"
    );
    expect(normalButtons.length).toBeGreaterThanOrEqual(3);
  });

  it("does not apply hover transform on FavoriteButton when reduced motion is active", () => {
    mockReducedMotion(true);
    render(<ApiCard api={mockApi} />);

    const favButton = screen.getByLabelText("Add to favorites");
    expect(favButton.onmouseenter).toBeNull();
    expect(favButton.onmouseleave).toBeNull();
  });

  it("does not apply hover transform on PinButton when reduced motion is active", () => {
    mockReducedMotion(true);
    render(<ApiCard api={mockApi} />);

    const pinButton = screen.getByRole("button", { name: /Pin api-1 to dashboard/i });
    expect(pinButton.onmouseenter).toBeNull();
    expect(pinButton.onmouseleave).toBeNull();
  });

  it("renders correctly when matchMedia is undefined (SSR)", () => {
    const origMatchMedia = window.matchMedia;
    (window as any).matchMedia = undefined;
    render(<ApiCard api={mockApi} />);

    expect(screen.getByText("Stellar Metering API")).toBeDefined();
    window.matchMedia = origMatchMedia;
  });
});

describe("ApiCard responsiveness", () => {
  const mockApi: APIItem = {
    id: "api-resp",
    name: "Responsive API",
    endpoint: "/api/resp",
    description: "Responsive test API.",
    tags: ["test"],
    pricePerRequest: 0,
  };

  function mockViewportWidth(isMobile: boolean) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => {
      if (query === "(max-width: 768px)") {
        return {
          matches: isMobile,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(() => false),
        };
      }
      return {
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
      };
    });
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("applies compact mode styling on narrow viewports", () => {
    mockViewportWidth(true); // Simulate mobile
    render(<ApiCard api={mockApi} density="comfortable" />);
    
    // Even if density="comfortable", the card should have the compact class on narrow viewports
    const card = screen.getByRole("button", { name: /View details for Responsive API/i });
    expect(card.className).toContain("api-card--compact");
  });

  it("retains comfortable mode styling on wide viewports by default", () => {
    mockViewportWidth(false); // Simulate desktop
    render(<ApiCard api={mockApi} density="comfortable" />);
     
    const card = screen.getByRole("button", { name: /View details for Responsive API/i });
    expect(card.className).not.toContain("api-card--compact");
  });
});

describe("ApiCard design tokens", () => {
  function mockMatchMedia() {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    }));
  }

  afterEach(() => {
    vi.restoreAllMocks();
    pinnedApisStore._reset();
  });

  beforeEach(() => {
    mockMatchMedia();
  });

  it("card uses token-based gap instead of hardcoded inline values", () => {
    render(<ApiCard api={mockApi} />);

    const card = screen.getByRole("button", { name: /View details for Stellar Metering API/i });
    expect(card.style.gap).toContain("var(--mkt-");
  });

  it("card uses token-based padding instead of hardcoded inline values", () => {
    render(<ApiCard api={mockApi} />);

    const card = screen.getByRole("button", { name: /View details for Stellar Metering API/i });
    expect(card.style.padding).toContain("var(--mkt-");
  });

  it("card uses token-based minHeight instead of hardcoded inline values", () => {
    render(<ApiCard api={mockApi} />);

    const card = screen.getByRole("button", { name: /View details for Stellar Metering API/i });
    expect(card.style.minHeight).toContain("var(--mkt-");
  });

  it("card uses token-based gap in the header row", () => {
    render(<ApiCard api={mockApi} />);

    const headerRow = document.querySelector(".api-marketplace-card-header");
    expect(headerRow).toBeTruthy();
    const style = (headerRow as HTMLElement).getAttribute("style") || "";
    expect(style).toContain("var(--mkt-space-lg)");
  });

  it("card uses token-based font-size for provider name", () => {
    render(<ApiCard api={mockApi} />);

    const providerDiv = document.querySelector(".api-marketplace-card-title-row > div[style]");
    expect(providerDiv).toBeTruthy();
    const style = (providerDiv as HTMLElement).getAttribute("style") || "";
    expect(style).toContain("var(--mkt-font-size-micro)");
  });

  it("card uses token-based font-size for price label", () => {
    render(<ApiCard api={mockApi} />);

    const priceDiv = document.querySelector(".api-marketplace-card-price > div[style]");
    expect(priceDiv).toBeTruthy();
    const style = (priceDiv as HTMLElement).getAttribute("style") || "";
    expect(style).toContain("var(--mkt-font-size-micro)");
  });

  it("card uses token-based borderRadius for icon container", () => {
    render(<ApiCard api={mockApi} />);

    const icon = document.querySelector(".api-marketplace-card-icon");
    expect(icon).toBeTruthy();
    const style = (icon as HTMLElement).getAttribute("style") || "";
    expect(style).toContain("var(--mkt-card-icon-radius)");
  });

  it("card uses token-based compare button font-size", () => {
    render(<ApiCard api={mockApi} />);

    const compareBtn = screen.getByRole("button", { name: /Add Stellar Metering API to comparison/i });
    const style = compareBtn.getAttribute("style") || "";
    expect(style).toContain("var(--mkt-font-size-micro)");
  });

  it("card uses token-based margin-top for description", () => {
    render(<ApiCard api={mockApi} />);

    const description = document.querySelector(".api-marketplace-card-description");
    expect(description).toBeTruthy();
    const style = (description as HTMLElement).getAttribute("style") || "";
    expect(style).toContain("var(--mkt-card-margin-top-sm)");
  });

  it("card uses token-based gap in the tags row", () => {
    render(<ApiCard api={mockApi} />);

    const tagsRow = document.querySelector(".api-marketplace-card-tags");
    expect(tagsRow).toBeTruthy();
    const style = (tagsRow as HTMLElement).getAttribute("style") || "";
    expect(style).toContain("var(--mkt-space-md)");
  });

  it("token references appear in the card's inline styles", () => {
    render(<ApiCard api={mockApi} />);

    const card = screen.getByRole("button", { name: /View details for Stellar Metering API/i });
    const style = card.getAttribute("style") || "";
    expect(style).toContain("var(--mkt-card-padding)");
    expect(style).toContain("var(--mkt-card-gap)");
    expect(style).toContain("var(--mkt-card-min-height)");
  });

  it("compact density card uses token-based compact padding", () => {
    render(<ApiCard api={mockApi} density="compact" />);

    const card = screen.getByRole("button", { name: /View details for Stellar Metering API/i });
    expect(card.style.padding).toContain("var(--mkt-card-compact-padding)");
  });

  it("compact density card uses token-based compact gap", () => {
    render(<ApiCard api={mockApi} density="compact" />);

    const card = screen.getByRole("button", { name: /View details for Stellar Metering API/i });
    expect(card.style.gap).toContain("var(--mkt-card-compact-gap)");
  });

  it("key design tokens are referenced in rendered card elements", () => {
    render(<ApiCard api={mockApi} />);

    const card = screen.getByRole("button", { name: /View details for Stellar Metering API/i });
    const cardStyle = card.getAttribute("style") || "";
    expect(cardStyle).toContain("var(--mkt-card-padding)");
    expect(cardStyle).toContain("var(--mkt-card-gap)");
    expect(cardStyle).toContain("var(--mkt-card-min-height)");

    const headerRow = document.querySelector(".api-marketplace-card-header");
    expect(headerRow?.getAttribute("style")).toContain("var(--mkt-space-lg)");

    const icon = document.querySelector(".api-marketplace-card-icon");
    expect(icon?.getAttribute("style")).toContain("var(--mkt-card-icon-radius)");
  });
});

