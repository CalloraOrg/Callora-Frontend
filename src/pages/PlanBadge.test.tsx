// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PlanBadgePage from "./PlanBadge";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../hooks/useDocumentTitle", () => ({
  default: vi.fn(),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderPage() {
  return render(
    <MemoryRouter>
      <PlanBadgePage />
    </MemoryRouter>
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("PlanBadgePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // ── Rendering ──────────────────────────────────────────────────────────────

  describe("rendering", () => {
    it("renders the page heading", () => {
      renderPage();
      expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
      expect(screen.getByText(/Plan Badge/i)).toBeTruthy();
    });

    it("renders the eyebrow label", () => {
      renderPage();
      expect(screen.getByText(/API Plan Management/i)).toBeTruthy();
    });

    it("renders the page description", () => {
      renderPage();
      expect(screen.getByText(/Assign a plan tier/i)).toBeTruthy();
    });
  });

  // ── Empty state ────────────────────────────────────────────────────────────

  describe("empty state (no plan selected)", () => {
    it("renders the plan-badge EmptyState variant", () => {
      renderPage();
      const emptyState = screen.getByTestId("empty-state-plan-badge");
      expect(emptyState).toBeTruthy();
    });

    it("shows the 'No plan selected' empty-state heading", () => {
      renderPage();
      expect(screen.getByText("No plan selected")).toBeTruthy();
    });

    it("shows a descriptive empty-state message", () => {
      renderPage();
      // Message can span multiple lines in rendered output, so we use a partial match.
      expect(screen.getByText(/plan tier attached yet/i)).toBeTruthy();
    });

    it("renders the primary 'Choose a plan' CTA button", () => {
      renderPage();
      const cta = screen.getByRole("button", { name: /Choose a plan/i });
      expect(cta).toBeTruthy();
    });

    it("renders the secondary 'Learn about plans' button", () => {
      renderPage();
      // The button text is "Learn about plans"; its aria-label adds extra context.
      // getByRole uses the accessible name (aria-label wins over text content).
      const secondary = screen.getByRole("button", {
        name: /Learn more about available plans in the marketplace/i,
      });
      expect(secondary).toBeTruthy();
    });

    it("renders the plan-badge illustration SVG inside the EmptyState", () => {
      const { container } = renderPage();
      const emptyState = container.querySelector(
        '[data-testid="empty-state-plan-badge"]'
      );
      expect(emptyState?.querySelector("svg")).toBeTruthy();
    });

    it("illustration is aria-hidden (decorative)", () => {
      const { container } = renderPage();
      const hiddenWrapper = container.querySelector('[aria-hidden="true"]');
      expect(hiddenWrapper).toBeTruthy();
      expect(hiddenWrapper?.querySelector("svg")).toBeTruthy();
    });
  });

  // ── Navigation ────────────────────────────────────────────────────────────

  describe("navigation", () => {
    it("navigates to /billing when 'Choose a plan' is clicked", () => {
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: /Choose a plan/i }));
      expect(mockNavigate).toHaveBeenCalledWith("/billing");
    });

    it("navigates to /marketplace when 'Learn about plans' is clicked", () => {
      renderPage();
      fireEvent.click(
        screen.getByRole("button", {
          name: /Learn more about available plans in the marketplace/i,
        })
      );
      expect(mockNavigate).toHaveBeenCalledWith("/marketplace");
    });
  });

  // ── Accessibility ─────────────────────────────────────────────────────────

  describe("accessibility", () => {
    it("uses a <section> landmark with aria-labelledby for the empty-state container", () => {
      const { container } = renderPage();
      const section = container.querySelector(
        'section[aria-labelledby="plan-badge-empty-heading"]'
      );
      expect(section).toBeTruthy();
    });

    it("CTA buttons have accessible names (not just generic text)", () => {
      renderPage();
      const choosePlan = screen.getByRole("button", { name: /Choose a plan/i });
      const learnMore = screen.getByRole("button", {
        name: /Learn more about available plans in the marketplace/i,
      });
      expect(choosePlan).toBeTruthy();
      expect(learnMore).toBeTruthy();
    });

    it("'Learn about plans' button has an aria-label with extra context", () => {
      renderPage();
      const learnMore = screen.getByRole("button", {
        name: /Learn more about available plans in the marketplace/i,
      });
      expect(learnMore.getAttribute("aria-label")).toBeTruthy();
    });
  });

  // ── Document title ────────────────────────────────────────────────────────

  describe("document title", () => {
    it("calls useDocumentTitle with the correct page title", async () => {
      const useDocumentTitle = await import("../hooks/useDocumentTitle");
      const spy = vi.spyOn(useDocumentTitle, "default");
      renderPage();
      expect(spy).toHaveBeenCalledWith(
        "Plan Badge – Callora",
        expect.any(String)
      );
    });
  });
});
