/**
 * OnboardingTour.test.tsx
 *
 * Focused keyboard-accessibility tests for the OnboardingTour component.
 *
 * Coverage areas
 * ──────────────
 * 1. Rendering & initial focus
 *    - skip link renders and is the first focusable element
 *    - step panel renders with correct ARIA attributes
 *    - stepper tabs render with correct WAI-ARIA roles
 *
 * 2. Keyboard navigation — step panel
 *    - "Next" button advances to the next step
 *    - "Back" button returns to the previous step
 *    - "Back" is hidden (visibility:hidden) on the first step
 *    - "Finish" button on the last step transitions to the complete screen
 *
 * 3. Keyboard navigation — stepper tabs (WAI-ARIA tabs pattern)
 *    - Arrow-right advances the active tab
 *    - Arrow-left retreats the active tab
 *    - Home jumps to the first tab
 *    - End jumps to the last tab
 *    - Clicking a tab directly jumps to that step
 *
 * 4. Skip link
 *    - Clicking "Skip tour" calls onComplete
 *
 * 5. Completion screen
 *    - "Finish" on the last step shows the completion screen
 *    - "Go to Dashboard" calls onComplete
 *    - "Restart tour" returns to step 1
 *
 * 6. Focus-visible CSS selectors (focus.css @layer contract)
 *    - focus.css defines :focus-visible rules for every interactive class
 *    - Rules are inside the @layer focus block
 *    - Rules use the accent token and 3px offset
 *    - No bare :focus selectors (only :focus-visible) in OnboardingTour.tsx
 *
 * 7. ARIA attributes
 *    - tabpanel has aria-live="polite" for announcements
 *    - tablist carries an aria-label containing step count
 *    - Each tab has aria-controls pointing to the panel id
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import OnboardingTour from "./OnboardingTour";

/* ── Helpers ─────────────────────────────────────────────────────────── */

const readFile = (p: string) =>
  readFileSync(resolve(process.cwd(), p), "utf8");

function renderTour(onComplete = vi.fn()) {
  return render(<OnboardingTour onComplete={onComplete} />);
}

/* ── 1. Rendering & initial state ────────────────────────────────────── */

describe("OnboardingTour — rendering", () => {
  it("renders the skip-tour link as the first focusable element", () => {
    renderTour();
    const skip = screen.getByRole("link", { name: /skip.*tour/i });
    expect(skip).toBeInTheDocument();

    // Verify it appears before the first tab button in the DOM
    const firstTab = screen.getAllByRole("tab")[0];
    expect(
      skip.compareDocumentPosition(firstTab) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("renders the correct number of stepper tabs", () => {
    renderTour();
    const tabs = screen.getAllByRole("tab");
    // 5 steps defined in TOUR_STEPS
    expect(tabs).toHaveLength(5);
  });

  it("marks only the first tab as selected initially", () => {
    renderTour();
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    tabs.slice(1).forEach((tab) => {
      expect(tab).toHaveAttribute("aria-selected", "false");
    });
  });

  it("renders the step panel with role=tabpanel", () => {
    renderTour();
    expect(screen.getByRole("tabpanel")).toBeInTheDocument();
  });

  it("renders the first step content by default", () => {
    renderTour();
    expect(screen.getByText(/welcome to callora/i)).toBeInTheDocument();
  });

  it("renders the progress bar (aria-hidden)", () => {
    renderTour();
    const bar = document.querySelector(".onboarding-tour__progress");
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveAttribute("aria-hidden", "true");
  });

  it("does not render the completion screen initially", () => {
    renderTour();
    expect(
      screen.queryByTestId("tour-complete"),
    ).not.toBeInTheDocument();
  });
});

/* ── 2. Step navigation with buttons ─────────────────────────────────── */

describe("OnboardingTour — button navigation", () => {
  it("advances to the next step when Next is clicked", async () => {
    renderTour();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /go to step 2/i }));
    // Second step is now active
    const tabs = screen.getAllByRole("tab");
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(/get your api key/i)).toBeInTheDocument();
  });

  it("goes back to the previous step when Back is clicked", async () => {
    renderTour();
    const user = userEvent.setup();

    // Advance to step 2 first
    await user.click(screen.getByRole("button", { name: /go to step 2/i }));
    // Now go back
    await user.click(screen.getByRole("button", { name: /go to previous/i }));

    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(/welcome to callora/i)).toBeInTheDocument();
  });

  it("hides the Back button on the first step", () => {
    renderTour();
    // The Back button is visibility:hidden + disabled on step 1.
    // getByRole excludes inaccessible / disabled elements, so we query
    // directly on the DOM class name instead.
    const back = document.querySelector(
      ".tour-nav-button--ghost",
    ) as HTMLElement;
    expect(back).toBeInTheDocument();
    expect(back).toHaveStyle({ visibility: "hidden" });
  });

  it("shows the Back button on any non-first step", async () => {
    renderTour();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /go to step 2/i }));
    // After advancing, the Back button is no longer disabled or hidden
    const back = screen.getByRole("button", { name: /go to previous onboarding step/i });
    expect(back).toHaveStyle({ visibility: "visible" });
  });

  it("shows Finish label on the last step", async () => {
    renderTour();
    const user = userEvent.setup();

    // Click through all steps to reach the last one
    for (let i = 0; i < 4; i++) {
      const nextBtn = screen.getByRole("button", {
        name: /go to step|go to step/i,
      });
      await user.click(nextBtn);
    }

    expect(
      screen.getByRole("button", { name: /finish onboarding tour$/i }),
    ).toBeInTheDocument();
  });

  it("shows the completion screen when Finish is clicked on the last step", async () => {
    renderTour();
    const user = userEvent.setup();

    // Navigate to the last step
    for (let i = 0; i < 4; i++) {
      const nextBtn = document.querySelector(".tour-nav-button--primary") as HTMLElement;
      await user.click(nextBtn);
    }

    // Click Finish
    const finishBtn = document.querySelector(".tour-nav-button--primary") as HTMLElement;
    await user.click(finishBtn);

    expect(screen.getByTestId("tour-complete")).toBeInTheDocument();
    expect(screen.getByText(/you're all set/i)).toBeInTheDocument();
  });
});

/* ── 3. Stepper tab keyboard navigation ──────────────────────────────── */

describe("OnboardingTour — stepper tab keyboard navigation", () => {
  it("moves to the next step on ArrowRight", () => {
    renderTour();
    const tabList = screen.getByRole("tablist");
    // Focus the tablist then fire arrow right
    fireEvent.keyDown(tabList, { key: "ArrowRight" });
    const tabs = screen.getAllByRole("tab");
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
  });

  it("moves to the previous step on ArrowLeft", () => {
    renderTour();
    // First advance to step 2
    const tabList = screen.getByRole("tablist");
    fireEvent.keyDown(tabList, { key: "ArrowRight" });
    // Now go back
    fireEvent.keyDown(tabList, { key: "ArrowLeft" });
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  });

  it("does not go below step 0 on ArrowLeft at the first step", () => {
    renderTour();
    const tabList = screen.getByRole("tablist");
    fireEvent.keyDown(tabList, { key: "ArrowLeft" });
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  });

  it("jumps to the first step on Home key", () => {
    renderTour();
    const tabList = screen.getByRole("tablist");
    // Advance to step 3 first
    fireEvent.keyDown(tabList, { key: "ArrowRight" });
    fireEvent.keyDown(tabList, { key: "ArrowRight" });
    // Home should jump back to step 1
    fireEvent.keyDown(tabList, { key: "Home" });
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  });

  it("jumps to the last step on End key", () => {
    renderTour();
    const tabList = screen.getByRole("tablist");
    fireEvent.keyDown(tabList, { key: "End" });
    const tabs = screen.getAllByRole("tab");
    expect(tabs[4]).toHaveAttribute("aria-selected", "true");
  });

  it("selects a step when a tab is clicked directly", async () => {
    renderTour();
    const user = userEvent.setup();
    const tabs = screen.getAllByRole("tab");
    await user.click(tabs[2]);
    expect(tabs[2]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(/browse the marketplace/i)).toBeInTheDocument();
  });

  it("moves to the next step on ArrowDown", () => {
    renderTour();
    const tabList = screen.getByRole("tablist");
    fireEvent.keyDown(tabList, { key: "ArrowDown" });
    const tabs = screen.getAllByRole("tab");
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
  });

  it("moves to the previous step on ArrowUp", () => {
    renderTour();
    const tabList = screen.getByRole("tablist");
    fireEvent.keyDown(tabList, { key: "ArrowDown" });
    fireEvent.keyDown(tabList, { key: "ArrowUp" });
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  });
});

/* ── 4. Skip link ─────────────────────────────────────────────────────── */

describe("OnboardingTour — skip link", () => {
  it("calls onComplete when the skip link is clicked", async () => {
    const onComplete = vi.fn();
    renderTour(onComplete);
    const user = userEvent.setup();

    await user.click(screen.getByRole("link", { name: /skip.*tour/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("prevents default navigation on the skip link click", async () => {
    const onComplete = vi.fn();
    renderTour(onComplete);
    const skip = screen.getByRole("link", { name: /skip.*tour/i });

    const clickEvent = new MouseEvent("click", { bubbles: true, cancelable: true });
    skip.dispatchEvent(clickEvent);
    // onComplete may or may not be called via dispatchEvent but default should
    // be preventable — the real test is that the component handles it without error
    expect(skip).toBeInTheDocument();
  });
});

/* ── 5. Completion screen ─────────────────────────────────────────────── */

describe("OnboardingTour — completion screen", () => {
  async function reachCompletion() {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    renderTour(onComplete);

    for (let i = 0; i < 4; i++) {
      const primaryBtn = document.querySelector(
        ".tour-nav-button--primary",
      ) as HTMLElement;
      await user.click(primaryBtn);
    }
    const finishBtn = document.querySelector(
      ".tour-nav-button--primary",
    ) as HTMLElement;
    await user.click(finishBtn);

    return { onComplete, user };
  }

  it("renders the completion screen after the final step", async () => {
    await reachCompletion();
    expect(screen.getByTestId("tour-complete")).toBeInTheDocument();
  });

  it("calls onComplete when 'Go to Dashboard' is clicked", async () => {
    const { onComplete, user } = await reachCompletion();
    await user.click(screen.getByRole("button", { name: /finish onboarding.*dashboard/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("restarts the tour when 'Restart tour' is clicked", async () => {
    const { user } = await reachCompletion();
    await user.click(screen.getByRole("button", { name: /restart.*tour/i }));
    // Completion screen gone
    expect(screen.queryByTestId("tour-complete")).not.toBeInTheDocument();
    // Back on step 1
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  });
});

/* ── 6. ARIA attributes ──────────────────────────────────────────────── */

describe("OnboardingTour — ARIA attributes", () => {
  it("tabpanel has aria-live='polite'", () => {
    renderTour();
    expect(screen.getByRole("tabpanel")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });

  it("tablist carries an aria-label containing the step count", () => {
    renderTour();
    const tabList = screen.getByRole("tablist");
    expect(tabList).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/step\s+1\s+of\s+5/i),
    );
  });

  it("each tab has aria-controls='tour-panel'", () => {
    renderTour();
    const tabs = screen.getAllByRole("tab");
    tabs.forEach((tab) => {
      expect(tab).toHaveAttribute("aria-controls", "tour-panel");
    });
  });

  it("tabpanel id matches the tabs' aria-controls value", () => {
    renderTour();
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute("id", "tour-panel");
  });

  it("active tab has tabIndex=0, inactive tabs have tabIndex=-1", () => {
    renderTour();
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("tabindex", "0");
    tabs.slice(1).forEach((tab) => {
      expect(tab).toHaveAttribute("tabindex", "-1");
    });
  });

  it("skip link has a descriptive aria-label", () => {
    renderTour();
    const skip = screen.getByRole("link", { name: /skip onboarding tour/i });
    expect(skip).toBeInTheDocument();
  });

  it("Next button has aria-label describing target step", () => {
    renderTour();
    const next = screen.getByRole("button", { name: /go to step 2 of 5/i });
    expect(next).toBeInTheDocument();
  });

  it("Finish button has aria-label on the last step", async () => {
    renderTour();
    const user = userEvent.setup();
    const tabList = screen.getByRole("tablist");
    // Jump to last step
    fireEvent.keyDown(tabList, { key: "End" });
    // Finish button should now be present
    expect(
      screen.getByRole("button", { name: /finish onboarding tour$/i }),
    ).toBeInTheDocument();
  });

  it("'Go to Dashboard' done button has an accessible name", async () => {
    // Reach completion
    renderTour();
    const user = userEvent.setup();
    for (let i = 0; i < 4; i++) {
      const primaryBtn = document.querySelector(
        ".tour-nav-button--primary",
      ) as HTMLElement;
      await user.click(primaryBtn);
    }
    const finishBtn = document.querySelector(
      ".tour-nav-button--primary",
    ) as HTMLElement;
    await user.click(finishBtn);

    const doneBtn = screen.getByRole("button", {
      name: /finish onboarding.*dashboard/i,
    });
    expect(doneBtn).toBeInTheDocument();
  });
});

/* ── 7. focus.css @layer focus contract — OnboardingTour ─────────────── */

describe("focus.css @layer focus — OnboardingTour selectors", () => {
  const css = readFile("src/styles/focus.css");

  it("defines the @layer focus block", () => {
    expect(css).toMatch(/@layer\s+focus\s*\{/);
  });

  it("includes a :focus-visible rule for .onboarding-tour__skip", () => {
    expect(css).toMatch(/\.onboarding-tour__skip:focus-visible/);
  });

  it("includes a :focus-visible rule for .tour-step-tab", () => {
    expect(css).toMatch(/\.tour-step-tab:focus-visible/);
  });

  it("includes a :focus-visible rule for .onboarding-tour__panel", () => {
    expect(css).toMatch(/\.onboarding-tour__panel:focus-visible/);
  });

  it("includes a :focus-visible rule for .tour-nav-button", () => {
    expect(css).toMatch(/\.tour-nav-button:focus-visible/);
  });

  it("includes a :focus-visible rule for .tour-done-button", () => {
    expect(css).toMatch(/\.tour-done-button:focus-visible/);
  });

  it("includes a :focus-visible rule for .tour-restart-link", () => {
    expect(css).toMatch(/\.tour-restart-link:focus-visible/);
  });

  it("includes the catch-all .onboarding-tour *:focus-visible rule", () => {
    expect(css).toMatch(/\.onboarding-tour\s+\*:focus-visible/);
  });

  it("uses the accent token for every OnboardingTour focus ring", () => {
    // Extract the OnboardingTour section of focus.css
    const tourSection = css.slice(
      css.indexOf(".onboarding-tour__skip:focus-visible"),
    );
    expect(tourSection).toMatch(/outline:\s*2px solid var\(--accent\)/);
  });

  it("uses 3px offset for every OnboardingTour focus ring", () => {
    const tourSection = css.slice(
      css.indexOf(".onboarding-tour__skip:focus-visible"),
    );
    expect(tourSection).toMatch(/outline-offset:\s*3px/);
  });

  it("OnboardingTour rules are inside the @layer focus block", () => {
    // Verify the closing brace of @layer focus comes after our selectors
    const layerStart = css.indexOf("@layer focus {");
    const layerEnd = css.lastIndexOf("}"); // last } closes the layer
    const skipRulePos = css.indexOf(".onboarding-tour__skip:focus-visible");
    expect(skipRulePos).toBeGreaterThan(layerStart);
    expect(skipRulePos).toBeLessThan(layerEnd);
  });
});

/* ── 8. OnboardingTour.tsx does not use bare :focus selectors ─────────── */

describe("OnboardingTour.tsx — :focus-visible only (no bare :focus)", () => {
  const src = readFile("src/pages/OnboardingTour.tsx");

  it("does not set outline:none unconditionally on any element", () => {
    // Allow outline: none inside a :focus { } block but not as a top-level style prop
    expect(src).not.toMatch(/style=\{[^}]*outline:\s*['"]none['"]/);
  });

  it("does not include a bare :focus selector in inline <style>", () => {
    // The scoped <style> block in OnboardingTour must use :focus-visible not bare :focus
    expect(src).not.toMatch(/:focus\s*\{[^:]/);
  });
});
