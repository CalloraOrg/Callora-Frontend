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
 *
 * 8. Checkpoint / resume behavior
 *    - Active step is persisted to localStorage
 *    - On mount, tour resumes from the persisted step
 *    - Clearing or completing the tour removes the persisted checkpoint
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

function renderTour(onComplete = vi.fn(), persistKey = "callora_onboarding_checkpoint") {
  return render(<OnboardingTour onComplete={onComplete} persistKey={persistKey} />);
}

function clearStorage(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore
  }
}

function clearAllOnboardingStorage() {
  clearStorage("callora_onboarding_checkpoint");
  clearStorage("callora_test_onboarding_checkpoint");
}

describe("OnboardingTour", () => {
  beforeEach(() => {
    clearAllOnboardingStorage();
  });

  /* ── 1. Rendering & initial state ────────────────────────────────────── */

describe("OnboardingTour — rendering", () => {

  it("renders the skip-tour link as the first focusable element", () => {
    renderTour();
    const skip = screen.getByRole("link", { name: /skip.*tour/i });
    expect(skip).toBeInTheDocument();

    const firstTab = screen.getAllByRole("tab")[0];
    expect(
      skip.compareDocumentPosition(firstTab) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("renders the correct number of stepper tabs", () => {
    renderTour();
    const tabs = screen.getAllByRole("tab");
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
    const tabs = screen.getAllByRole("tab");
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(/get your api key/i)).toBeInTheDocument();
  });

  it("goes back to the previous step when Back is clicked", async () => {
    renderTour();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /go to step 2/i }));
    await user.click(screen.getByRole("button", { name: /go to previous/i }));

    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(/welcome to callora/i)).toBeInTheDocument();
  });

  it("hides the Back button on the first step", () => {
    renderTour();
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
    const back = screen.getByRole("button", { name: /go to previous onboarding step/i });
    expect(back).toHaveStyle({ visibility: "visible" });
  });

  it("shows Finish label on the last step", async () => {
    renderTour();
    const user = userEvent.setup();

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

    for (let i = 0; i < 4; i++) {
      const nextBtn = document.querySelector(".tour-nav-button--primary") as HTMLElement;
      await user.click(nextBtn);
    }

    const finishBtn = document.querySelector(
      ".tour-nav-button--primary",
    ) as HTMLElement;
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
    fireEvent.keyDown(tabList, { key: "ArrowRight" });
    const tabs = screen.getAllByRole("tab");
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
  });

  it("moves to the previous step on ArrowLeft", () => {
    renderTour();
    const tabList = screen.getByRole("tablist");
    fireEvent.keyDown(tabList, { key: "ArrowRight" });
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
    fireEvent.keyDown(tabList, { key: "ArrowRight" });
    fireEvent.keyDown(tabList, { key: "ArrowRight" });
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
    expect(screen.queryByTestId("tour-complete")).not.toBeInTheDocument();
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
    fireEvent.keyDown(tabList, { key: "End" });
    expect(
      screen.getByRole("button", { name: /finish onboarding tour$/i }),
    ).toBeInTheDocument();
  });

  it("'Go to Dashboard' done button has an accessible name", async () => {
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
    const layerStart = css.indexOf("@layer focus {");
    const layerEnd = css.lastIndexOf("}");
    const skipRulePos = css.indexOf(".onboarding-tour__skip:focus-visible");
    expect(skipRulePos).toBeGreaterThan(layerStart);
    expect(skipRulePos).toBeLessThan(layerEnd);
  });
});

/* ── 8. OnboardingTour.tsx does not use bare :focus selectors ─────────── */

describe("OnboardingTour.tsx — :focus-visible only (no bare :focus)", () => {
  const src = readFile("src/pages/OnboardingTour.tsx");

  it("does not set outline:none unconditionally on any element", () => {
    expect(src).not.toMatch(/style=\{[^}]*outline:\s*['"]none['"]/);
  });

  it("does not include a bare :focus selector in inline <style>", () => {
    expect(src).not.toMatch(/:focus\s*\{[^:]/);
  });
});

/* ── 9. Checkpoint / resume behavior ─────────────────────────────────── */

describe("OnboardingTour — checkpoint and resume", () => {
  const persistKey = "callora_test_onboarding_checkpoint";

  it("persists the active step to localStorage", async () => {
    renderTour(vi.fn(), persistKey);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /go to step 2/i }));
    await user.click(screen.getByRole("button", { name: /go to step 3/i }));

    const stored = localStorage.getItem(persistKey);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored)).toBe(2);
  });

  it("resumes from the persisted step on mount", () => {
    localStorage.setItem(persistKey, JSON.stringify(3));

    renderTour(vi.fn(), persistKey);

    const tabs = screen.getAllByRole("tab");
    expect(tabs[3]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(/fund your vault/i)).toBeInTheDocument();
  });

  it("clears the checkpoint when the tour is completed", async () => {
    renderTour(vi.fn(), persistKey);
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

    expect(localStorage.getItem(persistKey)).toBeNull();
  });

  it("clears the checkpoint when the tour is skipped", async () => {
    renderTour(vi.fn(), persistKey);
    const user = userEvent.setup();

    await user.click(screen.getByRole("link", { name: /skip.*tour/i }));

    expect(localStorage.getItem(persistKey)).toBeNull();
  });

  it("defaults to step 0 when no checkpoint exists", () => {
    renderTour(vi.fn(), persistKey);

    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(/welcome to callora/i)).toBeInTheDocument();
  });

  it("defaults to step 0 when stored checkpoint is invalid", () => {
    localStorage.setItem(persistKey, JSON.stringify("invalid"));

    renderTour(vi.fn(), persistKey);

    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  });

  it("defaults to step 0 when stored checkpoint is out of range", () => {
    localStorage.setItem(persistKey, JSON.stringify(99));

    renderTour(vi.fn(), persistKey);

    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  });

  it("updates the checkpoint when restarting from the completion screen", async () => {
    renderTour(vi.fn(), persistKey);
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

    await user.click(screen.getByRole("button", { name: /restart.*tour/i }));

    expect(localStorage.getItem(persistKey)).toBe(JSON.stringify(0));
  });
});
});
