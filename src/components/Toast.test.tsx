// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "./Toast";

const MAX_TOASTS = 4;
const DEFAULT_DURATION = 5000;
const ERROR_DURATION = 10000;
const EXIT_ANIMATION = 200;
const DISMISS_LABEL = "Dismiss notification";

type ShowToast = ReturnType<typeof useToast>["showToast"];

let showToast: ShowToast = () => {};

function ToastHarness() {
  const { showToast: show } = useToast();
  showToast = show;
  return null;
}

function renderWithProvider() {
  return render(
    <ToastProvider>
      <ToastHarness />
    </ToastProvider>,
  );
}

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

function push(...messages: string[]) {
  act(() => {
    messages.forEach((message) => showToast(message));
  });
}

const queue = () => screen.getByRole("status", { name: "Notifications" });

const toastCount = () => queue().querySelectorAll(".toast-queue__toast").length;

const isPresent = (message: string) => screen.queryByText(message) !== null;

const getToast = (message: string) =>
  screen.getByText(message).closest(".toast-queue__toast") as HTMLElement;

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe("queue eviction", () => {
    it("keeps at most four toasts and evicts the oldest when a fifth is pushed", () => {
      renderWithProvider();

      push("T1", "T2", "T3", "T4");
      expect(toastCount()).toBe(MAX_TOASTS);

      push("T5");

      expect(toastCount()).toBe(MAX_TOASTS);
      expect(screen.queryByText("T1")).not.toBeInTheDocument();
      ["T2", "T3", "T4", "T5"].forEach((message) => {
        expect(screen.getByText(message)).toBeInTheDocument();
      });
    });

    it("evicts a non-persistent toast before a persistent one", () => {
      renderWithProvider();

      act(() => {
        showToast({ message: "P1", persistent: true });
        showToast({ message: "NP1" });
        showToast({ message: "P2", persistent: true });
        showToast({ message: "NP2" });
        showToast({ message: "P3", persistent: true });
      });

      expect(toastCount()).toBe(MAX_TOASTS);
      expect(screen.getByText("P1")).toBeInTheDocument();
      expect(screen.queryByText("NP1")).not.toBeInTheDocument();
      expect(screen.getByText("P2")).toBeInTheDocument();
      expect(screen.getByText("NP2")).toBeInTheDocument();
      expect(screen.getByText("P3")).toBeInTheDocument();
    });
  });

  describe("auto-dismiss", () => {
    it("removes a toast 200ms after its 5s duration, at 5200ms", () => {
      renderWithProvider();
      push("Solo");

      advance(DEFAULT_DURATION - 1);
      expect(isPresent("Solo")).toBe(true);

      // At 5000ms the timer only flags the toast as exiting so the CSS
      // transition can play, so it is still mounted.
      advance(1);
      expect(isPresent("Solo")).toBe(true);
      expect(getToast("Solo").className).toContain("toast-queue__toast--exiting");

      advance(EXIT_ANIMATION);
      expect(screen.queryByText("Solo")).not.toBeInTheDocument();
    });

    it("respects a custom duration before the same exit animation", () => {
      renderWithProvider();
      act(() => {
        showToast({ message: "Custom", duration: 1000 });
      });

      advance(1000 + EXIT_ANIMATION - 1);
      expect(isPresent("Custom")).toBe(true);

      advance(1);
      expect(screen.queryByText("Custom")).not.toBeInTheDocument();
    });

    it("defaults error toasts to 10s rather than 5s", () => {
      renderWithProvider();
      act(() => {
        showToast("Error Toast", "error");
      });

      advance(DEFAULT_DURATION);
      expect(isPresent("Error Toast")).toBe(true);

      advance(ERROR_DURATION + EXIT_ANIMATION - DEFAULT_DURATION);
      expect(screen.queryByText("Error Toast")).not.toBeInTheDocument();
    });

    it("never auto-dismisses a persistent toast", () => {
      renderWithProvider();
      act(() => {
        showToast({ message: "Sticky", persistent: true });
      });

      advance(ERROR_DURATION * 10);
      expect(isPresent("Sticky")).toBe(true);
    });
  });

  describe("pause on hover and focus", () => {
    it("pauses the countdown on mouse enter and resumes the remainder on mouse leave", () => {
      renderWithProvider();
      push("Hover");
      const toast = getToast("Hover");

      advance(3000);
      fireEvent.mouseEnter(toast);

      // Well past the original deadline, but the countdown is frozen.
      advance(DEFAULT_DURATION + EXIT_ANIMATION);
      expect(isPresent("Hover")).toBe(true);
      expect(getToast("Hover").className).not.toContain("toast-queue__toast--exiting");

      fireEvent.mouseLeave(toast);

      // 2000ms of the original 5000ms were left, so removal lands at 5200ms
      // from the original start.
      advance(2000 - 1);
      expect(isPresent("Hover")).toBe(true);

      advance(1);
      expect(isPresent("Hover")).toBe(true);
      expect(getToast("Hover").className).toContain("toast-queue__toast--exiting");

      advance(EXIT_ANIMATION);
      expect(screen.queryByText("Hover")).not.toBeInTheDocument();
    });

    it("pauses on focus and resumes on blur", () => {
      renderWithProvider();
      push("Focus");
      const toast = getToast("Focus");

      fireEvent.focus(toast);
      advance(DEFAULT_DURATION + EXIT_ANIMATION);
      expect(isPresent("Focus")).toBe(true);

      fireEvent.blur(toast);
      advance(DEFAULT_DURATION + EXIT_ANIMATION);
      expect(screen.queryByText("Focus")).not.toBeInTheDocument();
    });
  });

  describe("manual dismissal", () => {
    it("removes a toast when its dismiss button is clicked", () => {
      renderWithProvider();
      act(() => {
        showToast({ message: "Bye", persistent: true });
      });

      fireEvent.click(screen.getByRole("button", { name: `${DISMISS_LABEL}: Bye` }));

      advance(EXIT_ANIMATION - 1);
      expect(isPresent("Bye")).toBe(true);

      advance(1);
      expect(screen.queryByText("Bye")).not.toBeInTheDocument();
    });
  });

  describe("useToast", () => {
    it("throws when called outside a ToastProvider", () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      function Orphan() {
        useToast();
        return null;
      }

      try {
        expect(() => render(<Orphan />)).toThrow(
          "useToast must be used within a ToastProvider",
        );
      } finally {
        consoleError.mockRestore();
      }
    });
  });
});
