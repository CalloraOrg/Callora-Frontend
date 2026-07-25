import { render, screen, fireEvent } from "@testing-library/react";
import ApiCard from "./ApiCard";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import type { APIItem } from "../data/mockApis";
import { pinnedApisStore } from "../state/pinnedApis";

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

describe("ApiCard Accessibility and Context Layouts", () => {
  const mockApi: APIItem = {
    id: "api-1",
    name: "Stellar Metering API",
    endpoint: "/api/v1/meter",
    description: "A mock API for testing.",
    tags: ["weather", "forecast", "geo"],
    pricePerRequest: 0.01,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens context menu correctly on right click invocation", () => {
    render(
      <ApiCard api={mockApi} onViewDetails={() => {}} />
    );

    const card = screen.getByText("Stellar Metering API");
    fireEvent.contextMenu(card);

    expect(screen.getByRole("menu")).toBeDefined();
    expect(screen.getByText("Copy Endpoint URL")).toBeDefined();
  });

  it("renders tag chips with correct ARIA labels", () => {
    render(<ApiCard api={mockApi} />);

    const weatherChip = screen.getByLabelText("Filter marketplace by tag weather");
    const forecastChip = screen.getByLabelText("Filter marketplace by tag forecast");
    const geoChip = screen.getByLabelText("Filter marketplace by tag geo");

    expect(weatherChip).toBeDefined();
    expect(forecastChip).toBeDefined();
    expect(geoChip).toBeDefined();
  });

  it("calls onTagClick when a tag chip is clicked", () => {
    const handleTagClick = vi.fn();
    render(<ApiCard api={mockApi} onTagClick={handleTagClick} />);

    const weatherChip = screen.getByLabelText("Filter marketplace by tag weather");
    fireEvent.click(weatherChip);

    expect(handleTagClick).toHaveBeenCalledTimes(1);
    expect(handleTagClick).toHaveBeenCalledWith("weather");
  });

  it("marks the active tag chip as pressed", () => {
    render(<ApiCard api={mockApi} activeTag="weather" />);

    const weatherChip = screen.getByLabelText("Filter marketplace by tag weather");
    expect(weatherChip.getAttribute("aria-pressed")).toBe("true");
  });

  it("does not mark non-active tag chips as pressed", () => {
    render(<ApiCard api={mockApi} activeTag="weather" />);

    const forecastChip = screen.getByLabelText("Filter marketplace by tag forecast");
    expect(forecastChip.getAttribute("aria-pressed")).toBe("false");
  });

  it("handles case-insensitive active tag matching", () => {
    render(<ApiCard api={mockApi} activeTag="WEATHER" />);

    const weatherChip = screen.getByLabelText("Filter marketplace by tag weather");
    expect(weatherChip.getAttribute("aria-pressed")).toBe("true");
  });

  it("renders tag chips even when no activeTag is set", () => {
    render(<ApiCard api={mockApi} />);

    const chips = screen.getAllByRole("button", { name: /Filter marketplace by tag/ });
    expect(chips.length).toBe(3);
  });

  it("toggles pin state when the pin button is clicked", () => {
    pinnedApisStore._reset();
    render(<ApiCard api={mockApi} />);

    const pinButton = screen.getByRole("button", { name: /Pin api-1 to dashboard/i });
    expect(pinButton).toBeTruthy();
    expect(pinButton.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(pinButton);

    expect(pinButton.getAttribute("aria-pressed")).toBe("true");
    expect(pinButton.getAttribute("aria-label")).toBe("Unpin api-1 from dashboard");
  });
});

describe("ApiCard reduced motion", () => {
  const mockApi: APIItem = {
    id: "api-1",
    name: "Stellar Metering API",
    endpoint: "/api/v1/meter",
    description: "A mock API for testing.",
    tags: ["weather", "forecast", "geo"],
    pricePerRequest: 0.01,
  };

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