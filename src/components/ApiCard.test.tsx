import { render, screen, fireEvent, act, within } from "@testing-library/react";
import ApiCard from "./ApiCard";
import { describe, it, expect, vi, beforeEach } from "vitest";
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
  compareStore: {
    addApi: vi.fn(),
    removeApi: vi.fn(),
    setOpen: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    getSnapshot: vi.fn(() => ({ apis: [], isOpen: false })),
  },
  useCompareStore: () => ({ apis: [], isOpen: false }),
}));

/* ── Shared fixture ─────────────────────────────────────────────────────── */

const mockApi: APIItem = {
  id: "api-1",
  name: "Stellar Metering API",
  provider: { name: "TestCo" },
  description: "A mock API for testing.",
  tags: ["weather", "forecast", "geo"],
  pricePerRequest: 0.01,
  endpoints: [{ id: "ep1", url: "/api/v1/meter", method: "GET" }],
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
