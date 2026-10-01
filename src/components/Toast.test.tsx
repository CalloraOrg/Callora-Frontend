// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { ToastProvider, useToast } from "./Toast";

afterEach(cleanup);

/**
 * Mounts a probe button that shows a toast when clicked, wrapped in the
 * single ToastProvider (the app mounts exactly one in src/main.tsx).
 */
function setup() {
  function Probe() {
    const { showToast } = useToast();
    return (
      <button onClick={() => showToast("Settings saved.")}>
        show toast
      </button>
    );
  }

  const utils = render(
    <ToastProvider>
      <Probe />
    </ToastProvider>
  );

  return {
    ...utils,
    show: () => act(() => { fireEvent.click(utils.getByRole("button", { name: "show toast" })); }),
    showVariant: (variant: "success" | "error" | "warning") =>
      act(() => {
        fireEvent.click(utils.getByRole("button", { name: "show toast" }));
      }),
    queue: () => utils.container.querySelector<HTMLElement>(".toast-queue")!,
    toasts: () => utils.container.querySelectorAll<HTMLElement>(".toast-queue__toast"),
  };
}

/** Advance timers inside act so React state updates flush. */
function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("Toast", () => {
  describe("Rendering and variants", () => {
    it("renders nothing before a toast is shown", () => {
      const { toasts, queue } = setup();
      expect(queue()).toBeTruthy();
      expect(toasts().length).toBe(0);
    });

    it("shows a toast with the given message", () => {
      const { show, toasts } = setup();
      show();
      expect(toasts().length).toBe(1);
      expect(screen.getByText("Settings saved.")).toBeTruthy();
    });

    it("renders the success icon for the default variant", () => {
      const { show } = setup();
      show();
      const toast = screen.getByText("Settings saved.").closest(".toast-queue__toast")!;
      expect(toast.className).toContain("toast-queue__toast--success");
    });

    it("renders the error variant class on demand", () => {
      function ErrorProbe() {
        const { showToast } = useToast();
        return (
          <button onClick={() => showToast("Upload failed.", "error")}>
            show error
          </button>
        );
      }
      const { container, getByRole } = render(
        <ToastProvider>
          <ErrorProbe />
        </ToastProvider>
      );
      fireEvent.click(getByRole("button", { name: "show error" }));
      const toast = container.querySelector(".toast-queue__toast")!;
      expect(toast.className).toContain("toast-queue__toast--error");
    });

    it("renders the warning variant class on demand", () => {
      function WarnProbe() {
        const { showToast } = useToast();
        return (
          <button onClick={() => showToast("Balance is low.", "warning")}>
            show warning
          </button>
        );
      }
      const { container, getByRole } = render(
        <ToastProvider>
          <WarnProbe />
        </ToastProvider>
      );
      fireEvent.click(getByRole("button", { name: "show warning" }));
      const toast = container.querySelector(".toast-queue__toast")!;
      expect(toast.className).toContain("toast-queue__toast--warning");
    });
  });

  describe("Queue cap and timing", () => {
    it("keeps at most 4 toasts, evicting the oldest non-persistent toast", () => {
      vi.useFakeTimers();
      function MultiProbe() {
        const { showToast } = useToast();
        return (
          <button
            onClick={() => {
              for (let i = 0; i < 6; i++) showToast(`Toast ${i}`);
            }}
          >
            show six
          </button>
        );
      }
      const { container, getByRole } = render(
        <ToastProvider>
          <MultiProbe />
        </ToastProvider>
      );
      fireEvent.click(getByRole("button", { name: "show six" }));

      const toasts = container.querySelectorAll(".toast-queue__toast");
      expect(toasts.length).toBe(4);
      // The two oldest toasts were evicted; the newest 4 remain.
      const messages = Array.from(toasts).map((t) => t.textContent);
      expect(messages.some((m) => m?.includes("Toast 0"))).toBe(false);
      expect(messages.some((m) => m?.includes("Toast 2"))).toBe(true);
      expect(messages.some((m) => m?.includes("Toast 5"))).toBe(true);
      vi.useRealTimers();
    });

    it("auto-dismisses a toast 5000ms after it is shown, with a 200ms exit", () => {
      vi.useFakeTimers();
      const utils = setup();
      utils.show();

      advance(4999);
      expect(utils.toasts().length).toBe(1);

      advance(1); // duration elapsed -> exiting starts
      expect(utils.toasts()[0].className).toContain("toast-queue__toast--exiting");

      advance(200); // exit animation done -> removed from the DOM
      expect(utils.toasts().length).toBe(0);
      vi.useRealTimers();
    });

    it("dismisses toasts independently of each other", () => {
      vi.useFakeTimers();
      function SequencedProbe() {
        const { showToast } = useToast();
        return (
          <button
            onClick={() => {
              showToast("First");
              window.setTimeout(() => showToast("Second"), 1000);
            }}
          >
            show sequence
          </button>
        );
      }
      const { container, getByRole } = render(
        <ToastProvider>
          <SequencedProbe />
        </ToastProvider>
      );
      fireEvent.click(getByRole("button", { name: "show sequence" }));
      advance(1000);

      // "First" is still within its 5s window; "Second" was added at t=1000ms.
      const all = container.querySelectorAll(".toast-queue__toast");
      expect(all.length).toBe(2);
      expect(all[0].textContent).toContain("First");
      expect(all[1].textContent).toContain("Second");
      vi.useRealTimers();
    });
  });

  describe("Pause behaviour", () => {
    it("pauses the auto-dismiss timer while hovered and resumes with the remaining time", () => {
      vi.useFakeTimers();
      const utils = setup();
      utils.show();
      const toast = utils.toasts()[0];

      advance(3000); // 2s remaining
      fireEvent.mouseEnter(toast); // pause
      advance(4000); // far past the original deadline
      expect(utils.toasts().length).toBe(1);
      expect(utils.toasts()[0].className).not.toContain("toast-queue__toast--exiting");

      fireEvent.mouseLeave(toast); // resume
      advance(1999); // just before the remaining 2s elapses
      expect(utils.toasts().length).toBe(1);

      advance(1); // remaining time elapsed -> exiting
      expect(utils.toasts()[0].className).toContain("toast-queue__toast--exiting");
      advance(200);
      expect(utils.toasts().length).toBe(0);
      vi.useRealTimers();
    });

    it("pauses on focus and resumes on blur for keyboard users", () => {
      vi.useFakeTimers();
      const utils = setup();
      utils.show();
      const toast = utils.toasts()[0];

      advance(3000);
      fireEvent.focus(toast);
      advance(4000);
      expect(utils.toasts().length).toBe(1);

      fireEvent.blur(toast);
      advance(1999);
      expect(utils.toasts().length).toBe(1);

      advance(1); // remaining time elapsed -> exiting
      expect(utils.toasts()[0].className).toContain("toast-queue__toast--exiting");
      advance(200);
      expect(utils.toasts().length).toBe(0);
      vi.useRealTimers();
    });
  });

  describe("Manual dismissal", () => {
    it("removes the toast when its close button is clicked", () => {
      vi.useFakeTimers();
      const utils = setup();
      utils.show();

      const close = screen.getByRole("button", {
        name: "Dismiss notification: Settings saved.",
      });
      act(() => {
        fireEvent.click(close);
      });
      advance(200);
      expect(utils.toasts().length).toBe(0);
      vi.useRealTimers();
    });
  });

  describe("Provider guard", () => {
    it("throws when useToast is used outside a ToastProvider", () => {
      function Orphan() {
        useToast();
        return null;
      }
      // Silence React's error-boundary noise for the expected throw.
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      expect(() => render(<Orphan />)).toThrow(
        "useToast must be used within a ToastProvider"
      );
      spy.mockRestore();
    });
  });

  describe("Accessibility", () => {
    it("exposes the queue as a polite status region", () => {
      const { queue } = setup();
      expect(queue().getAttribute("role")).toBe("status");
      expect(queue().getAttribute("aria-live")).toBe("polite");
      expect(queue().getAttribute("aria-label")).toBe("Notifications");
    });

    it("labels each close button with the toast message", () => {
      const { show } = setup();
      show();
      expect(
        screen.getByRole("button", { name: "Dismiss notification: Settings saved." })
      ).toBeTruthy();
    });

    it("pauses on focus so screen reader users can finish reading", () => {
      vi.useFakeTimers();
      const utils = setup();
      utils.show();
      const toast = utils.toasts()[0];

      advance(3000);
      fireEvent.focus(toast);
      advance(5000);
      expect(utils.toasts().length).toBe(1);
      vi.useRealTimers();
    });
  });
});

// ─── Options API (issue #1261): persistent toasts and custom durations ───────

const OptionsProbe = ({ testCase }: { testCase: number }) => {
  const { showToast } = useToast();

  useEffect(() => {
    if (testCase === 1) {
      showToast({ message: 'Persistent Toast', persistent: true });
    } else if (testCase === 2) {
      showToast({ message: 'Custom Duration', duration: 1000 });
    } else if (testCase === 3) {
      showToast('Error Toast', 'error');
    } else if (testCase === 4) {
      showToast({ message: '1', persistent: true });
      showToast({ message: '2', persistent: false });
      showToast({ message: '3', persistent: true });
      showToast({ message: '4', persistent: false });
      showToast({ message: '5', persistent: true });
    }
  }, [testCase, showToast]);

  return null;
};

describe('Toast options (persistent / duration)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('keeps persistent toast until dismissed', () => {
    render(
      <ToastProvider>
        <OptionsProbe testCase={1} />
      </ToastProvider>
    );
    expect(screen.getByText('Persistent Toast')).toBeInTheDocument();
    
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    
    expect(screen.getByText('Persistent Toast')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /Dismiss notification/i });
    fireEvent.click(closeBtn);
    
    act(() => {
      vi.advanceTimersByTime(500);
    });
    
    expect(screen.queryByText('Persistent Toast')).not.toBeInTheDocument();
  });

  it('custom duration dismisses the toast after that many milliseconds', () => {
    render(
      <ToastProvider>
        <OptionsProbe testCase={2} />
      </ToastProvider>
    );
    expect(screen.getByText('Custom Duration')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(screen.getByText('Custom Duration')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(300); // 900 + 300 = 1200 > 1000 + 200 (animation)
    });
    expect(screen.queryByText('Custom Duration')).not.toBeInTheDocument();
  });

  it('existing showToast(message, "error") calls continue to compile and work, defaulting to 10s', () => {
    render(
      <ToastProvider>
        <OptionsProbe testCase={3} />
      </ToastProvider>
    );
    expect(screen.getByText('Error Toast')).toBeInTheDocument();
    
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    // Should still be there because error default is 10s
    expect(screen.getByText('Error Toast')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5500); // 10500 total
    });
    expect(screen.queryByText('Error Toast')).not.toBeInTheDocument();
  });

  it('when the queue exceeds four, a non-persistent toast is evicted before a persistent one', () => {
    render(
      <ToastProvider>
        <OptionsProbe testCase={4} />
      </ToastProvider>
    );
    // added: 1(P), 2(NP), 3(P), 4(NP), 5(P)
    // max toasts = 4
    // when 5(P) is added, we have 4 items: 1(P), 2(NP), 3(P), 4(NP)
    // 2(NP) should be evicted because it's the first non-persistent
    // remaining: 1(P), 3(P), 4(NP), 5(P)
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.queryByText('2')).not.toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});
