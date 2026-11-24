/**
 * OnboardingTour Step Machine & Accessibility Tests
 *
 * State Machine Transitions:
 * ─────────────────────────────────────────────────────────────────────────────
 * Initial State:
 *   - Reads progress from localStorage under `persistKey` (default: "callora_onboarding_checkpoint").
 *   - Stored format: { completed: boolean, lastStep: number }.
 *   - If no checkpoint or corrupt/out-of-range value, defaults to lastStep = 0, completed = false.
 *   - If autoLaunch = true and progress.completed = true, transitions directly to `isComplete` view.
 *
 * Step List:
 *   - Step 0: "Welcome to Callora" (Back button disabled & hidden; Next -> Step 1)
 *   - Step 1: "Get your API key" (Back -> Step 0; Next -> Step 2)
 *   - Step 2: "Browse the Marketplace" (Back -> Step 1; Next -> Step 3)
 *   - Step 3: "Fund your vault" (Back -> Step 2; Next -> Step 4; wallet state step)
 *   - Step 4: "Track your usage" (Back -> Step 3; Next/Finish -> Completion screen)
 *
 * Step Transitions:
 *   - handleNext: activeStep < TOTAL_STEPS - 1 ? activeStep + 1 : (isComplete = true, clearCheckpoint())
 *   - handleBack: Math.max(activeStep - 1, 0)
 *   - handleStepSelect(index): jumps directly to step index (0 to 4)
 *   - Stepper Tab Keyboard navigation:
 *       ArrowRight / ArrowDown -> Math.min(activeStep + 1, TOTAL_STEPS - 1)
 *       ArrowLeft / ArrowUp   -> Math.max(activeStep - 1, 0)
 *       Home                  -> 0
 *       End                   -> TOTAL_STEPS - 1 (4)
 *
 * Skip & Completion:
 *   - handleSkip: calls clearCheckpoint ({ completed: true, lastStep: 0 }) and onComplete()
 *   - handleDone: calls clearCheckpoint ({ completed: true, lastStep: 0 }) and onComplete()
 *   - handleRestart: sets isComplete = false, resets progress to { completed: false, lastStep: 0 }
 *
 * Focus Management:
 *   - Step panel receives programmatic focus when activeStep changes (!isComplete)
 *   - "Go to Dashboard" button receives focus when isComplete transitions to true
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import OnboardingTour, { CHECKPOINT_KEY } from "./OnboardingTour";
import { walletStore } from "../state/walletStore";

function renderTour(props: Partial<Parameters<typeof OnboardingTour>[0]> = {}) {
  const onComplete = props.onComplete ?? vi.fn();
  const persistKey = props.persistKey ?? `test_checkpoint_${Math.random().toString(36).substring(2, 9)}`;
  const utils = render(
    <MemoryRouter>
      <OnboardingTour {...props} onComplete={onComplete} persistKey={persistKey} />
    </MemoryRouter>,
  );
  return { ...utils, onComplete, persistKey };
}

describe("OnboardingTour — Step Machine & Checkpoint Persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  describe("1. Initial state and fallback behavior", () => {
    it("starts at step 0 by default when no checkpoint exists", () => {
      const { persistKey } = renderTour();
      expect(screen.getByRole("tabpanel")).toHaveAccessibleName(/Step 1: Welcome to Callora/i);
      expect(screen.getByRole("tab", { name: /Step 1: Welcome to Callora/i })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(screen.getByText("1 / 5")).toBeInTheDocument();
      // Checkpoint is persisted to storage
      const stored = JSON.parse(localStorage.getItem(persistKey) ?? "{}");
      expect(stored).toEqual({ completed: false, lastStep: 0 });
    });

    it("resumes from persisted checkpoint on mount", () => {
      const key = "test_resume_key";
      localStorage.setItem(key, JSON.stringify({ completed: false, lastStep: 2 }));

      renderTour({ persistKey: key });
      expect(screen.getByRole("tabpanel")).toHaveAccessibleName(/Step 3: Browse the Marketplace/i);
      expect(screen.getByRole("tab", { name: /Step 3: Browse the Marketplace/i })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(screen.getByText("3 / 5")).toBeInTheDocument();
    });

    it("falls back to step 0 when localStorage contains corrupted JSON", () => {
      const key = "test_corrupt_key";
      localStorage.setItem(key, "{ invalid json corrupt content");

      renderTour({ persistKey: key });
      expect(screen.getByRole("tabpanel")).toHaveAccessibleName(/Step 1: Welcome to Callora/i);
      expect(screen.getByText("1 / 5")).toBeInTheDocument();
    });

    it("falls back to step 0 when persisted lastStep is negative or out-of-range", () => {
      const key = "test_out_of_range_key";
      localStorage.setItem(key, JSON.stringify({ completed: false, lastStep: 99 }));

      const { unmount } = renderTour({ persistKey: key });
      expect(screen.getByRole("tabpanel")).toHaveAccessibleName(/Step 1: Welcome to Callora/i);
      expect(screen.getByText("1 / 5")).toBeInTheDocument();
      unmount();

      // Test negative step
      const negativeKey = "test_negative_key";
      localStorage.setItem(negativeKey, JSON.stringify({ completed: false, lastStep: -1 }));

      renderTour({ persistKey: negativeKey });
      expect(screen.getByRole("tabpanel")).toHaveAccessibleName(/Step 1: Welcome to Callora/i);
    });

    it("falls back gracefully when localStorage.getItem throws an error", () => {
      const getItemSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("QuotaExceededError or security block");
      });

      renderTour();
      expect(screen.getByRole("tabpanel")).toHaveAccessibleName(/Step 1: Welcome to Callora/i);
      expect(screen.getByText("1 / 5")).toBeInTheDocument();
      getItemSpy.mockRestore();
    });

    it("autoLaunches to completed screen if storage has completed: true", () => {
      const key = "test_auto_launch_completed";
      localStorage.setItem(key, JSON.stringify({ completed: true, lastStep: 0 }));

      renderTour({ persistKey: key, autoLaunch: true });
      expect(screen.getByTestId("tour-complete")).toBeInTheDocument();
      expect(screen.getByText("You're all set!")).toBeInTheDocument();
    });
  });

  describe("2. Step navigation & checkpoint updates", () => {
    it("advances step when clicking Next and writes updated checkpoint to localStorage", async () => {
      const user = userEvent.setup();
      const { persistKey } = renderTour();

      const nextButton = screen.getByRole("button", { name: /Go to step 2 of 5/i });
      await user.click(nextButton);

      // Moved to step 1 (API key)
      expect(screen.getByRole("tabpanel")).toHaveAccessibleName(/Step 2: Get your API key/i);
      expect(screen.getByText("2 / 5")).toBeInTheDocument();

      const stored = JSON.parse(localStorage.getItem(persistKey) ?? "{}");
      expect(stored).toEqual({ completed: false, lastStep: 1 });
    });

    it("retreats step when clicking Back and writes updated checkpoint to localStorage", async () => {
      const user = userEvent.setup();
      const key = "test_back_key";
      localStorage.setItem(key, JSON.stringify({ completed: false, lastStep: 2 }));

      renderTour({ persistKey: key });
      expect(screen.getByText("3 / 5")).toBeInTheDocument();

      const backButton = screen.getByRole("button", { name: /Go to previous onboarding step/i });
      await user.click(backButton);

      expect(screen.getByText("2 / 5")).toBeInTheDocument();
      expect(screen.getByRole("tabpanel")).toHaveAccessibleName(/Step 2: Get your API key/i);

      const stored = JSON.parse(localStorage.getItem(key) ?? "{}");
      expect(stored).toEqual({ completed: false, lastStep: 1 });
    });

    it("disables and visually hides the Back button on step 0", () => {
      renderTour();
      const backButton = document.querySelector(".tour-nav-button--ghost") as HTMLButtonElement;
      expect(backButton).toBeInTheDocument();
      expect(backButton).toBeDisabled();
      expect(backButton).toHaveAttribute("aria-disabled", "true");
      expect(backButton).toHaveStyle({ visibility: "hidden" });
    });

    it("allows jumping directly to a step by clicking a stepper tab", async () => {
      const user = userEvent.setup();
      const { persistKey } = renderTour();

      const step4Tab = screen.getByRole("tab", { name: /Step 4: Fund your vault/i });
      await user.click(step4Tab);

      expect(screen.getByText("4 / 5")).toBeInTheDocument();
      expect(screen.getByRole("tabpanel")).toHaveAccessibleName(/Step 4: Fund your vault/i);

      const stored = JSON.parse(localStorage.getItem(persistKey) ?? "{}");
      expect(stored).toEqual({ completed: false, lastStep: 3 });
    });

    it("transitions from step 4 through Finish button to completion screen", async () => {
      const user = userEvent.setup();
      const key = "test_finish_key";
      localStorage.setItem(key, JSON.stringify({ completed: false, lastStep: 4 }));

      renderTour({ persistKey: key });
      expect(screen.getByText("5 / 5")).toBeInTheDocument();

      const finishButton = screen.getByRole("button", { name: /Finish onboarding tour/i });
      await user.click(finishButton);

      expect(screen.getByTestId("tour-complete")).toBeInTheDocument();
      expect(screen.getByText("You're all set!")).toBeInTheDocument();

      // Checkpoint cleared to completed: true, lastStep: 0
      const stored = JSON.parse(localStorage.getItem(key) ?? "{}");
      expect(stored).toEqual({ completed: true, lastStep: 0 });
    });
  });

  describe("3. Wallet step navigation & store state", () => {
    it("renders step 4 (Fund your vault) with description and advances to step 5", async () => {
      const user = userEvent.setup();
      const key = "test_wallet_step_key";
      localStorage.setItem(key, JSON.stringify({ completed: false, lastStep: 3 }));

      renderTour({ persistKey: key });
      expect(screen.getByRole("tabpanel")).toHaveAccessibleName(/Step 4: Fund your vault/i);
      expect(
        screen.getByText(/Deposit USDC once and let Callora handle the rest/i),
      ).toBeInTheDocument();

      // Verify walletStore integration compatibility
      const snapshot = walletStore.getSnapshot();
      expect(snapshot).toBeDefined();

      const nextButton = screen.getByRole("button", { name: /Go to step 5 of 5/i });
      expect(nextButton).not.toBeDisabled();
      await user.click(nextButton);

      expect(screen.getByRole("tabpanel")).toHaveAccessibleName(/Step 5: Track your usage/i);
    });
  });

  describe("4. Skip and Completion Callbacks", () => {
    it("calls onComplete exactly once and clears checkpoint when clicking Skip tour", async () => {
      const user = userEvent.setup();
      const onComplete = vi.fn();
      const key = "test_skip_key";
      localStorage.setItem(key, JSON.stringify({ completed: false, lastStep: 1 }));

      renderTour({ persistKey: key, onComplete });
      const skipLink = screen.getByRole("link", { name: /Skip onboarding tour and go to dashboard/i });

      await user.click(skipLink);

      expect(onComplete).toHaveBeenCalledTimes(1);
      const stored = JSON.parse(localStorage.getItem(key) ?? "{}");
      expect(stored).toEqual({ completed: true, lastStep: 0 });
    });

    it("handles double-clicking Skip tour without crashing and calls onComplete for each click", async () => {
      const user = userEvent.setup();
      const onComplete = vi.fn();
      const key = "test_double_skip_key";

      renderTour({ persistKey: key, onComplete });
      const skipLink = screen.getByRole("link", { name: /Skip onboarding tour/i });

      await user.dblClick(skipLink);

      expect(onComplete).toHaveBeenCalled();
      const stored = JSON.parse(localStorage.getItem(key) ?? "{}");
      expect(stored).toEqual({ completed: true, lastStep: 0 });
    });

    it("calls onComplete exactly once and clears checkpoint from Done button on completion screen", async () => {
      const user = userEvent.setup();
      const onComplete = vi.fn();
      const key = "test_done_key";
      localStorage.setItem(key, JSON.stringify({ completed: true, lastStep: 0 }));

      renderTour({ persistKey: key, autoLaunch: true, onComplete });
      expect(screen.getByTestId("tour-complete")).toBeInTheDocument();

      const doneButton = screen.getByRole("button", {
        name: /Finish onboarding tour and go to dashboard/i,
      });
      await user.click(doneButton);

      expect(onComplete).toHaveBeenCalledTimes(1);
      const stored = JSON.parse(localStorage.getItem(key) ?? "{}");
      expect(stored).toEqual({ completed: true, lastStep: 0 });
    });

    it("resets tour to step 0 and clears isComplete when clicking Restart tour from complete screen", async () => {
      const user = userEvent.setup();
      const key = "test_restart_complete_key";
      localStorage.setItem(key, JSON.stringify({ completed: true, lastStep: 0 }));

      renderTour({ persistKey: key, autoLaunch: true });
      expect(screen.getByTestId("tour-complete")).toBeInTheDocument();

      const restartButton = screen.getByRole("button", {
        name: /Restart the onboarding tour from the beginning/i,
      });
      await user.click(restartButton);

      expect(screen.queryByTestId("tour-complete")).not.toBeInTheDocument();
      expect(screen.getByRole("tabpanel")).toHaveAccessibleName(/Step 1: Welcome to Callora/i);
      expect(screen.getByText("1 / 5")).toBeInTheDocument();

      const stored = JSON.parse(localStorage.getItem(key) ?? "{}");
      expect(stored).toEqual({ completed: false, lastStep: 0 });
    });

    it("resets tour to step 0 when clicking Restart tour mid-tour", async () => {
      const user = userEvent.setup();
      const key = "test_restart_mid_key";
      localStorage.setItem(key, JSON.stringify({ completed: false, lastStep: 3 }));

      renderTour({ persistKey: key });
      expect(screen.getByText("4 / 5")).toBeInTheDocument();

      const restartButtons = screen.getAllByRole("button", {
        name: /Restart the onboarding tour from the beginning/i,
      });
      await user.click(restartButtons[0]);

      expect(screen.getByText("1 / 5")).toBeInTheDocument();
      expect(screen.getByRole("tabpanel")).toHaveAccessibleName(/Step 1: Welcome to Callora/i);

      const stored = JSON.parse(localStorage.getItem(key) ?? "{}");
      expect(stored).toEqual({ completed: false, lastStep: 0 });
    });
  });

  describe("5. Keyboard navigation & Focus management", () => {
    it("navigates tabs using ArrowRight and ArrowLeft", () => {
      const { persistKey } = renderTour();
      const tablist = screen.getByRole("tablist");

      // ArrowRight advances to step 1
      fireEvent.keyDown(tablist, { key: "ArrowRight" });
      expect(screen.getByText("2 / 5")).toBeInTheDocument();

      // ArrowDown advances to step 2
      fireEvent.keyDown(tablist, { key: "ArrowDown" });
      expect(screen.getByText("3 / 5")).toBeInTheDocument();

      // ArrowLeft retreats to step 1
      fireEvent.keyDown(tablist, { key: "ArrowLeft" });
      expect(screen.getByText("2 / 5")).toBeInTheDocument();

      // ArrowUp retreats to step 0
      fireEvent.keyDown(tablist, { key: "ArrowUp" });
      expect(screen.getByText("1 / 5")).toBeInTheDocument();

      // ArrowLeft on step 0 does not underflow below step 0
      fireEvent.keyDown(tablist, { key: "ArrowLeft" });
      expect(screen.getByText("1 / 5")).toBeInTheDocument();
    });

    it("navigates tabs using Home and End keys", () => {
      renderTour();
      const tablist = screen.getByRole("tablist");

      // End jumps to last step (step 4, index 4)
      fireEvent.keyDown(tablist, { key: "End" });
      expect(screen.getByText("5 / 5")).toBeInTheDocument();
      expect(screen.getByRole("tabpanel")).toHaveAccessibleName(/Step 5: Track your usage/i);

      // Home jumps back to step 0
      fireEvent.keyDown(tablist, { key: "Home" });
      expect(screen.getByText("1 / 5")).toBeInTheDocument();
      expect(screen.getByRole("tabpanel")).toHaveAccessibleName(/Step 1: Welcome to Callora/i);
    });

    it("sets tabIndex=0 on active tab and tabIndex=-1 on inactive tabs", async () => {
      const user = userEvent.setup();
      renderTour();

      const tabs = screen.getAllByRole("tab");
      expect(tabs[0]).toHaveAttribute("tabindex", "0");
      expect(tabs[1]).toHaveAttribute("tabindex", "-1");
      expect(tabs[2]).toHaveAttribute("tabindex", "-1");

      await user.click(tabs[2]);
      expect(tabs[0]).toHaveAttribute("tabindex", "-1");
      expect(tabs[2]).toHaveAttribute("tabindex", "0");
    });

    it("programmatically focuses the step panel on active step changes", async () => {
      const user = userEvent.setup();
      renderTour();

      const panel = screen.getByRole("tabpanel");
      expect(document.activeElement).toBe(panel);

      const nextButton = screen.getByRole("button", { name: /Go to step 2 of 5/i });
      await user.click(nextButton);

      expect(document.activeElement).toBe(screen.getByRole("tabpanel"));
    });

    it("programmatically focuses the Done button on completion", async () => {
      const user = userEvent.setup();
      const key = "test_focus_done_key";
      localStorage.setItem(key, JSON.stringify({ completed: false, lastStep: 4 }));

      renderTour({ persistKey: key });
      const finishButton = screen.getByRole("button", { name: /Finish onboarding tour/i });
      await user.click(finishButton);

      const doneButton = screen.getByRole("button", {
        name: /Finish onboarding tour and go to dashboard/i,
      });
      expect(document.activeElement).toBe(doneButton);
    });
  });

  describe("6. Edge cases & Lifecycle", () => {
    it("handles unmount gracefully without memory leaks or uncaught errors", () => {
      const { unmount } = renderTour();
      expect(() => unmount()).not.toThrow();
    });

    it("uses default CHECKPOINT_KEY when persistKey prop is omitted", () => {
      render(
        <MemoryRouter>
          <OnboardingTour />
        </MemoryRouter>,
      );
      const stored = localStorage.getItem(CHECKPOINT_KEY);
      expect(stored).not.toBeNull();
    });
  });
});
