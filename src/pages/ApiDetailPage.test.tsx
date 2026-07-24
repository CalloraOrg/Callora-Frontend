// @vitest-environment jsdom

import { act } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ApiDetailPage from "./ApiDetailPage";
import { ToastProvider } from "../components/Toast";
import { CollectionsProvider } from "../state/collectionsStore";

// Mock matchMedia (required by the Tabs component)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <CollectionsProvider>
      <ToastProvider>{ui}</ToastProvider>
    </CollectionsProvider>
  );
}

// Mock IntersectionObserver (required by ApiDetailStickyTOC)
const observeMock = vi.fn();
const disconnectMock = vi.fn();
Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    observe: observeMock,
    unobserve: vi.fn(),
    disconnect: disconnectMock,
  })),
});

function settleLoadingState() {
  act(() => {
    vi.advanceTimersByTime(2000);
  });
}

describe("ApiDetailPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.history.pushState({}, "", "/details/weather-001");
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    window.history.pushState({}, "", "/");
  });

  // ── Existing tests ────────────────────────────────────────────────────────

  it("renders endpoint group previews in the documentation tab", () => {
    renderWithProviders(<ApiDetailPage />);
    settleLoadingState();

    fireEvent.click(screen.getByRole("tab", { name: "Documentation" }));

    expect(screen.getByRole("heading", { name: "Endpoint groups" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /forecast 1 endpoint/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /historical weather 1 endpoint/i })).toBeTruthy();
  });

  it("shows the group preview when a trigger receives keyboard focus", () => {
    renderWithProviders(<ApiDetailPage />);
    settleLoadingState();

    fireEvent.click(screen.getByRole("tab", { name: "Documentation" }));
    fireEvent.focus(screen.getByRole("button", { name: /forecast 1 endpoint/i }));

    const preview = screen.getByLabelText("Forecast group preview");
    expect(preview).toBeTruthy();
    expect(within(preview).getByText("Get Forecast")).toBeTruthy();
    expect(within(preview).getByText(/1 endpoint.*2 request parameter/)).toBeTruthy();
  });

  // ── Skeleton / loading ────────────────────────────────────────────────────

  it("shows loading skeleton before data resolves", () => {
    renderWithProviders(<ApiDetailPage />);
    // Before timers advance, loading state should be active
    expect(screen.getByText("Loading…")).toBeTruthy();
  });

  it("renders the API name after loading completes", () => {
    renderWithProviders(<ApiDetailPage />);
    settleLoadingState();
    // The mock API at weather-001 should have a visible h1
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
  });

  // ── Tab switching ─────────────────────────────────────────────────────────

  it("defaults to the overview tab", () => {
    renderWithProviders(<ApiDetailPage />);
    settleLoadingState();
    expect(screen.getByText("About this API")).toBeTruthy();
  });

  it("switches to the pricing tab when the tab is clicked", () => {
    renderWithProviders(<ApiDetailPage />);
    settleLoadingState();
    fireEvent.click(screen.getByRole("tab", { name: "Pricing" }));
    expect(screen.getByText("Pricing Plans")).toBeTruthy();
  });

  it("switches to the examples tab", () => {
    renderWithProviders(<ApiDetailPage />);
    settleLoadingState();
    fireEvent.click(screen.getByRole("tab", { name: "Examples" }));
    expect(screen.getByText("Integration Gallery")).toBeTruthy();
  });

  it("shows the available page shortcuts next to the tab navigation", () => {
    renderWithProviders(<ApiDetailPage />);
    settleLoadingState();

    const hint = screen.getByLabelText("Keyboard shortcuts");
    expect(within(hint).getByText("Esc")).toBeTruthy();
    expect(within(hint).getByText("Go back to Marketplace")).toBeTruthy();
    expect(within(hint).getByText("1-5")).toBeTruthy();
    expect(within(hint).getByText(/Switch tabs/)).toBeTruthy();
  });

  // ── ApiDetailStickyTOC integration ────────────────────────────────────────

  it("renders the TOC nav when the documentation tab is active", () => {
    renderWithProviders(<ApiDetailPage />);
    settleLoadingState();

    fireEvent.click(screen.getByRole("tab", { name: "Documentation" }));

    expect(screen.getByRole("navigation", { name: "On this page" })).toBeTruthy();
  });

  it("renders all expected TOC anchor links", () => {
    renderWithProviders(<ApiDetailPage />);
    settleLoadingState();

    fireEvent.click(screen.getByRole("tab", { name: "Documentation" }));

    const nav = screen.getByRole("navigation", { name: "On this page" });
    expect(nav.querySelector('a[href="#toc-endpoints"]')).toBeTruthy();
    expect(nav.querySelector('a[href="#toc-parameters"]')).toBeTruthy();
    expect(nav.querySelector('a[href="#toc-implementation"]')).toBeTruthy();
  });

  it("does not render the TOC on the overview tab", () => {
    renderWithProviders(<ApiDetailPage />);
    settleLoadingState();

    // Default tab is overview — TOC must be absent
    expect(screen.queryByRole("navigation", { name: "On this page" })).toBeNull();
  });

  it("TOC link labels match the expected section titles", () => {
    renderWithProviders(<ApiDetailPage />);
    settleLoadingState();

    fireEvent.click(screen.getByRole("tab", { name: "Documentation" }));

    const nav = screen.getByRole("navigation", { name: "On this page" });
    const links = Array.from(nav.querySelectorAll("a"));
    const labels = links.map((a) => a.textContent?.trim());

    expect(labels).toContain("Endpoints");
    expect(labels).toContain("Parameters");
    expect(labels).toContain("Implementation");
  });

  it("TOC links point to heading elements that exist in the DOM", () => {
    renderWithProviders(<ApiDetailPage />);
    settleLoadingState();

    fireEvent.click(screen.getByRole("tab", { name: "Documentation" }));

    expect(document.getElementById("toc-endpoints")).toBeTruthy();
    expect(document.getElementById("toc-parameters")).toBeTruthy();
    expect(document.getElementById("toc-implementation")).toBeTruthy();
  });

  it("lets the user save an endpoint into a new collection from the save panel", () => {
    renderWithProviders(<ApiDetailPage />);
    settleLoadingState();
    fireEvent.click(screen.getByRole("tab", { name: "Documentation" }));

    const saveButtons = screen.getAllByRole("button", {
      name: /Save endpoint to collection/i,
    });
    fireEvent.click(saveButtons[0]);

    const dialog = screen.getByRole("dialog", {
      name: /Save endpoint to collection/i,
    });
    expect(within(dialog).getByText(/no collections yet/i)).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: /new collection/i }));
    const input = within(dialog).getByRole("textbox", {
      name: /new collection name/i,
    });
    fireEvent.change(input, { target: { value: "Weather collection" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /Save/i }));

    const collectionCheckbox = within(dialog).getByRole("checkbox", {
      name: /Remove from collection "Weather collection"/i,
    }) as HTMLInputElement;
    expect(collectionCheckbox.checked).toBe(true);
    expect(screen.getByRole("button", { name: /Saved endpoint/i })).toBeTruthy();
  });
});
