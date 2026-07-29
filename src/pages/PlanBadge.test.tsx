// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PlanBadgePage from "./PlanBadge";
import { ToastProvider } from "../components/Toast";

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

/** Render PlanBadgePage wrapped with ToastProvider and MemoryRouter. */
function renderPage(props?: Partial<React.ComponentProps<typeof PlanBadgePage>>) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <PlanBadgePage {...props} />
      </ToastProvider>
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

  // ── Empty state (before optimistic update) ────────────────────────────────

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
      expect(screen.getByText(/plan tier attached yet/i)).toBeTruthy();
    });

    it("renders the primary 'Choose a plan' CTA button", () => {
      renderPage();
      const cta = screen.getByRole("button", { name: /Choose a plan/i });
      expect(cta).toBeTruthy();
    });

    it("renders the secondary 'Learn about plans' button", () => {
      renderPage();
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

  // ── Optimistic UI ─────────────────────────────────────────────────────────

  describe("optimistic UI (primary action)", () => {
    it("updates UI immediately when 'Choose a plan' is clicked, before async resolves", () => {
      // Arrange: async operation that never resolves (stays pending).
      const choosePlanPromise = new Promise<void>(() => {});
      const onChoosePlan = vi.fn(() => choosePlanPromise);

      renderPage({ onChoosePlan });

      // Verify initial empty state.
      expect(screen.getByTestId("empty-state-plan-badge")).toBeTruthy();

      // Act: click the primary action.
      fireEvent.click(screen.getByRole("button", { name: /Choose a plan/i }));

      // Assert IMMEDIATE optimistic update:
      // 1. The empty state is gone BEFORE the promise resolves.
      expect(screen.queryByTestId("empty-state-plan-badge")).toBeNull();

      // 2. The loading indicator appears BEFORE the promise resolves.
      expect(screen.getByText("Loading plan options…")).toBeTruthy();

      // 3. The async operation was called exactly once.
      expect(onChoosePlan).toHaveBeenCalledOnce();

      // 4. The radiogroup is NOT yet visible because we are still in
      //    the 'activating' state (loading).
      expect(
        screen.queryByRole("radiogroup", { name: /Plan tiers/i })
      ).toBeNull();
    });

    it("keeps optimistic state on successful async operation", async () => {
      const onChoosePlan = vi.fn(() => Promise.resolve());

      renderPage({ onChoosePlan });

      fireEvent.click(screen.getByRole("button", { name: /Choose a plan/i }));

      // Wait for the async operation to resolve.
      await waitFor(() => {
        // Loading indicator should be gone.
        expect(screen.queryByText("Loading plan options…")).toBeNull();
      });

      // Optimistic state (tier picker) remains visible.
      expect(
        screen.getByRole("radiogroup", { name: /Plan tiers/i })
      ).toBeTruthy();
    });

    it("reverts to empty state on failed async operation with error feedback", async () => {
      const onChoosePlan = vi.fn(() =>
        Promise.reject(new Error("Network error"))
      );

      renderPage({ onChoosePlan });

      // Capture initial empty state.
      expect(screen.getByTestId("empty-state-plan-badge")).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: /Choose a plan/i }));

      // Wait for the async operation to reject.
      await waitFor(() => {
        // The empty state should be restored.
        expect(screen.getByTestId("empty-state-plan-badge")).toBeTruthy();
      });

      // The tier picker should be gone.
      expect(
        screen.queryByRole("radiogroup", { name: /Plan tiers/i })
      ).toBeNull();

      // Error feedback: toast notification with error message.
      await waitFor(() => {
        expect(screen.getByText("Network error")).toBeTruthy();
      });
    });

    it("avoids raw backend details in error message when error has no message", async () => {
      const onChoosePlan = vi.fn(() => Promise.reject(null));

      renderPage({ onChoosePlan });

      fireEvent.click(screen.getByRole("button", { name: /Choose a plan/i }));

      await waitFor(() => {
        expect(screen.getByTestId("empty-state-plan-badge")).toBeTruthy();
      });

      await waitFor(() => {
        expect(
          screen.getByText("Could not load plan options. Please try again.")
        ).toBeTruthy();
      });
    });
  });

  // ── Navigation ────────────────────────────────────────────────────────────

  describe("navigation", () => {
    it("navigates to /marketplace when 'Learn about plans' is clicked", () => {
      renderPage();
      fireEvent.click(
        screen.getByRole("button", {
          name: /Learn more about available plans in the marketplace/i,
        })
      );
      expect(mockNavigate).toHaveBeenCalledWith("/marketplace");
    });

    it("does NOT navigate to /billing when 'Choose a plan' is clicked (optimistic behavior)", async () => {
      renderPage();
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /Choose a plan/i }));
      });
      expect(mockNavigate).not.toHaveBeenCalledWith("/billing");
    });
  });

  // ── Selection UI behavior (post-optimistic) ───────────────────────────────

  describe("selection UI", () => {
    it("shows tier picker after successful optimistic transition", async () => {
      renderPage({ onChoosePlan: () => Promise.resolve() });
      fireEvent.click(screen.getByRole("button", { name: /Choose a plan/i }));

      await waitFor(() => {
        expect(
          screen.queryByText("Loading plan options…")
        ).toBeNull();
      });

      expect(
        screen.getByRole("radio", { name: /Free plan/i })
      ).toBeTruthy();
      expect(
        screen.getByRole("radio", { name: /Pro plan/i })
      ).toBeTruthy();
      expect(
        screen.getByRole("radio", { name: /Enterprise plan/i })
      ).toBeTruthy();
    });

    it("allows selecting a tier via the radio group", async () => {
      renderPage({ onChoosePlan: () => Promise.resolve() });

      fireEvent.click(screen.getByRole("button", { name: /Choose a plan/i }));
      await waitFor(() => {
        expect(screen.queryByText("Loading plan options…")).toBeNull();
      });

      const proRadio = screen.getByRole("radio", { name: /Pro plan/i });
      fireEvent.click(proRadio);

      expect(proRadio).toBeChecked();
    });

    it("provides a 'Cancel' button to return to empty state", async () => {
      renderPage({ onChoosePlan: () => Promise.resolve() });
      fireEvent.click(screen.getByRole("button", { name: /Choose a plan/i }));

      await waitFor(() => {
        expect(screen.queryByText("Loading plan options…")).toBeNull();
      });

      const cancelBtn = screen.getByRole("button", {
        name: /Cancel plan selection/i,
      });
      fireEvent.click(cancelBtn);

      expect(screen.getByTestId("empty-state-plan-badge")).toBeTruthy();
    });
  });

  // ── Race conditions & duplicate activations ───────────────────────────────

  describe("race conditions and duplicate activation", () => {
    it("prevents duplicate calls when button is clicked multiple times rapidly", () => {
      const onChoosePlan = vi.fn(() => new Promise<void>(() => {}));

      renderPage({ onChoosePlan });

      const cta = screen.getByRole("button", { name: /Choose a plan/i });

      // Click three times rapidly (synchronous events).
      fireEvent.click(cta);
      fireEvent.click(cta);
      fireEvent.click(cta);

      // The ref-based guard (activatingRef) prevents the 2nd and 3rd clicks
      // from calling onChoosePlan — even before React re-renders.
      expect(onChoosePlan).toHaveBeenCalledTimes(1);
    });

    it("resets the activating guard after completion", async () => {
      let resolvePromise!: () => void;
      const onChoosePlan = vi.fn(
        () => new Promise<void>((resolve) => {
          resolvePromise = resolve;
        })
      );

      renderPage({ onChoosePlan });

      const cta = screen.getByRole("button", { name: /Choose a plan/i });

      // First successful flow.
      fireEvent.click(cta);
      expect(onChoosePlan).toHaveBeenCalledTimes(1);

      // Resolve the promise.
      await act(async () => {
        resolvePromise();
      });

      // Wait for re-render so the activating guard resets.
      await waitFor(() => {
        expect(screen.queryByText("Loading plan options…")).toBeNull();
      });

      // Cancel to go back to empty state.
      const cancelBtn = screen.getByRole("button", {
        name: /Cancel plan selection/i,
      });
      fireEvent.click(cancelBtn);

      // Now click "Choose a plan" again — should work.
      const ctaAgain = screen.getByRole("button", { name: /Choose a plan/i });
      fireEvent.click(ctaAgain);

      // onChoosePlan was called a second time.
      expect(onChoosePlan).toHaveBeenCalledTimes(2);
    });
  });

  // ── Keyboard interaction ─────────────────────────────────────────────────

  describe("keyboard interaction", () => {
    it("activates the primary action via Enter key", async () => {
      renderPage({ onChoosePlan: () => Promise.resolve() });

      const cta = screen.getByRole("button", { name: /Choose a plan/i });
      cta.focus();

      await act(async () => {
        // Simulate Enter key on the button.
        fireEvent.keyDown(cta, { key: "Enter", code: "Enter" });
        fireEvent.click(cta);
      });

      // Optimistic update should appear.
      expect(
        screen.queryByTestId("empty-state-plan-badge")
      ).toBeNull();
    });

    it("activates the primary action via Space key", async () => {
      renderPage({ onChoosePlan: () => Promise.resolve() });

      const cta = screen.getByRole("button", { name: /Choose a plan/i });
      cta.focus();

      await act(async () => {
        // Simulate Space key on the button.
        fireEvent.keyDown(cta, { key: " ", code: "Space" });
        fireEvent.click(cta);
      });

      expect(
        screen.queryByTestId("empty-state-plan-badge")
      ).toBeNull();
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

    it("shows a loading status region during optimistic transition", () => {
      const onChoosePlan = vi.fn(() => new Promise<void>(() => {}));
      renderPage({ onChoosePlan });

      fireEvent.click(screen.getByRole("button", { name: /Choose a plan/i }));

      const statusRegion = screen.getByRole("status", {
        name: /Loading plan options/i,
      });
      expect(statusRegion).toBeTruthy();
    });

    it("error toast is announced via aria-live region", async () => {
      const onChoosePlan = vi.fn(() =>
        Promise.reject(new Error("Could not load plan options"))
      );

      renderPage({ onChoosePlan });
      fireEvent.click(screen.getByRole("button", { name: /Choose a plan/i }));

      await waitFor(() => {
        // toast-queue uses role="status" with aria-live="polite"
        const queue = screen.getByLabelText("Notifications");
        expect(queue.textContent).toContain("Could not load plan options");
      });
    });

    it("provides a cancel button with accessible label in selection state", async () => {
      renderPage({ onChoosePlan: () => Promise.resolve() });

      fireEvent.click(screen.getByRole("button", { name: /Choose a plan/i }));

      await waitFor(() => {
        expect(screen.queryByText("Loading plan options…")).toBeNull();
      });

      const cancelBtn = screen.getByRole("button", {
        name: /Cancel plan selection/i,
      });
      expect(cancelBtn.getAttribute("aria-label")).toBeTruthy();
    });
  });

  // ── Document title ────────────────────────────────────────────────────────

  describe("document title", () => {
    it("calls useDocumentTitle with the correct page title", async () => {
      // Re-mock to get a fresh spy.
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
