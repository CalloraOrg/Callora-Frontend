import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import EndpointSummary from "./EndpointSummary";

// Mock useDocumentTitle hook
vi.mock("../hooks/useDocumentTitle", () => ({
  default: vi.fn(),
}));

describe("EndpointSummary Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Endpoint Summary page header", () => {
    render(
      <MemoryRouter>
        <EndpointSummary />
      </MemoryRouter>
    );

    expect(screen.getByText("Endpoint Summary")).toBeTruthy();
    expect(screen.getByText(/Quick reference list of all API endpoints/i)).toBeTruthy();
  });

  it("toggles the expanded state of endpoint cards when clicked", () => {
    render(
      <MemoryRouter>
        <EndpointSummary />
      </MemoryRouter>
    );

    // Get the trigger for the first endpoint
    const triggers = screen.getAllByRole("button");
    // Find the one that acts as a trigger (contains method/url/etc)
    const endpointTrigger = triggers.find((btn) =>
      btn.classList.contains("endpoint-summary-trigger")
    );

    expect(endpointTrigger).toBeTruthy();
    if (!endpointTrigger) return;

    // Toggle collapse/expand
    const initialExpanded = endpointTrigger.getAttribute("aria-expanded") === "true";
    fireEvent.click(endpointTrigger);
    const postClickExpanded = endpointTrigger.getAttribute("aria-expanded") === "true";

    expect(postClickExpanded).toBe(!initialExpanded);
  });

  it("calls window.print when the print button is clicked", () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    render(
      <MemoryRouter>
        <EndpointSummary />
      </MemoryRouter>
    );

    const printButton = screen.getByRole("button", { name: /Print Summary/i });
    expect(printButton).toBeTruthy();
    fireEvent.click(printButton);

    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });

  describe("aria-live announcements", () => {
    it("renders a live region for screen-reader announcements", () => {
      render(
        <MemoryRouter>
          <EndpointSummary />
        </MemoryRouter>
      );

      const liveRegion = screen.getByTestId("live-region-endpoint-summary");
      expect(liveRegion).toBeTruthy();
      expect(liveRegion.getAttribute("aria-live")).toBe("polite");
      expect(liveRegion.getAttribute("aria-atomic")).toBe("true");
    });

    it("announces when an endpoint card is expanded", () => {
      render(
        <MemoryRouter>
          <EndpointSummary />
        </MemoryRouter>
      );

      const triggers = screen.getAllByRole("button");
      const endpointTrigger = triggers.find((btn) =>
        btn.classList.contains("endpoint-summary-trigger") && btn.getAttribute("aria-expanded") === "false"
      );
      expect(endpointTrigger).toBeTruthy();
      if (!endpointTrigger) return;

      const liveRegion = screen.getByTestId("live-region-endpoint-summary");

      fireEvent.click(endpointTrigger);

      expect(liveRegion.textContent).toMatch(/Expanded/);
    });

    it("announces when an endpoint card is collapsed", () => {
      render(
        <MemoryRouter>
          <EndpointSummary />
        </MemoryRouter>
      );

      const triggers = screen.getAllByRole("button");
      const endpointTrigger = triggers.find((btn) =>
        btn.classList.contains("endpoint-summary-trigger")
      );
      expect(endpointTrigger).toBeTruthy();
      if (!endpointTrigger) return;

      const liveRegion = screen.getByTestId("live-region-endpoint-summary");

      // First expand
      const initialExpanded = endpointTrigger.getAttribute("aria-expanded") === "true";
      if (!initialExpanded) {
        fireEvent.click(endpointTrigger);
      }

      // Now collapse
      fireEvent.click(endpointTrigger);

      expect(liveRegion.textContent).toMatch(/Collapsed/);
    });
  });
});
