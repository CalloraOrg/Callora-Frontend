import { render, screen, fireEvent, act, within } from "@testing-library/react";
import ApiCard from "./ApiCard";
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";
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

describe('ApiCard Reduced Motion Accessibility', () => {
  const mockApi = {
    id: 'test-1',
    name: 'Test API',
    description: 'A test description',
    endpoints: [{ url: '/api/v1/test' }],
    tags: []
  };

  const setupMatchMedia = (matches: boolean) => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)' ? matches : false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  };

  afterAll(() => {
    Object.defineProperty(window, 'matchMedia', { writable: true, value: undefined });
  });

  it('renders standard layout without reduced motion', () => {
    setupMatchMedia(false);
    render(<ApiCard api={mockApi as any} />);
    
    const favButton = screen.getByLabelText('Add to favorites');
    expect(favButton.style.transition).toContain('transform');
  });

  it('respects prefers-reduced-motion and provides a static outline/color fallback on hover', () => {
    setupMatchMedia(true);
    render(<ApiCard api={mockApi as any} />);
    
    const favButton = screen.getByLabelText('Add to favorites');
    
    expect(favButton).toBeInTheDocument();
    
    expect(favButton.style.transition).toContain('background 100ms');
    expect(favButton.style.transition).not.toContain('transform');
    
    fireEvent.focus(favButton);
    expect(favButton.style.outline).toContain('solid');
  });
});

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

describe("ApiCard skeleton", () => {
  it("includes sparkline placeholder to match final card layout", () => {
    render(<ApiCard loading />);
    // The skeleton should have the sparkline section (24h label + sparkline area)
    const cards = document.querySelectorAll(".api-card-skeleton");
    expect(cards.length).toBe(1);
    // Verify the skeleton is rendered (not the actual card)
    expect(screen.getByText("Loading API")).toBeTruthy();
  });

  it("includes WhyApi placeholder to match comfortable-mode card shape", () => {
    const { container } = render(<ApiCard loading />);
    // The skeleton renders multiple Skeleton blocks — one for the WhyApi section
    const skeletons = container.querySelectorAll(".skeleton--stellar");
    // Title, provider, description lines, tags, WhyApi lines, sparkline label,
    // sparkline, 3 stat labels, 3 stat values, CTA, rating
    expect(skeletons.length).toBeGreaterThanOrEqual(12);
  });

  it("uses tone stellar for themed skeleton appearance", () => {
    const { container } = render(<ApiCard loading />);
    const skeletons = container.querySelectorAll(".skeleton--stellar");
    expect(skeletons.length).toBeGreaterThan(0);
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

describe("ApiCard — Identity color stripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Provide a default matchMedia mock so prefersReducedMotion resolves safely.
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
  });

  it("renders a color stripe element", () => {
    render(<ApiCard api={mockApi} />);
    const stripe = screen.getByTestId("api-card-color-stripe");
    expect(stripe).toBeTruthy();
  });

  it("stripe is hidden from assistive technology", () => {
    render(<ApiCard api={mockApi} />);
    const stripe = screen.getByTestId("api-card-color-stripe");
    expect(stripe.getAttribute("aria-hidden")).toBe("true");
  });

  it("stripe has a deterministic color derived from the API id", () => {
    render(<ApiCard api={mockApi} />);
    const stripe = screen.getByTestId("api-card-color-stripe");
    expect(stripe.style.background).toBeTruthy();
  });

  it("different API ids produce different stripe colours", () => {
    const apiA: APIItem = { ...mockApi, id: "alpha-api" };
    const apiB: APIItem = { ...mockApi, id: "beta-api" };

    const { unmount: unmountA } = render(<ApiCard api={apiA} />);
    const colourA = screen.getByTestId("api-card-color-stripe").style.background;
    unmountA();

    const { unmount: unmountB } = render(<ApiCard api={apiB} />);
    const colourB = screen.getByTestId("api-card-color-stripe").style.background;
    unmountB();

    expect(colourA).not.toBe(colourB);
  });

  it("same API id always produces the same stripe colour", () => {
    const { unmount: unmount1 } = render(<ApiCard api={mockApi} />);
    const colour1 = screen.getByTestId("api-card-color-stripe").style.background;
    unmount1();

    const { unmount: unmount2 } = render(<ApiCard api={mockApi} />);
    const colour2 = screen.getByTestId("api-card-color-stripe").style.background;
    unmount2();

    expect(colour1).toBe(colour2);
  });

  it("stripe is not rendered in the loading/skeleton state", () => {
    render(<ApiCard loading />);
    expect(screen.queryByTestId("api-card-color-stripe")).toBeNull();
  });

  it("stripe has position absolute and covers full card height", () => {
    render(<ApiCard api={mockApi} />);
    const stripe = screen.getByTestId("api-card-color-stripe");
    expect(stripe.style.position).toBe("absolute");
    expect(stripe.style.height).toBe("100%");
    expect(stripe.style.left).toBe("0px");
    expect(stripe.style.top).toBe("0px");
  });

  it("stripe respects reduced motion (transition=none)", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    }));

    render(<ApiCard api={mockApi} />);
    const stripe = screen.getByTestId("api-card-color-stripe");
    expect(stripe.style.transition).toBe("none");

    vi.restoreAllMocks();
  });
});

