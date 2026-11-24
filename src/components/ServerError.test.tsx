import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ServerError from "./ServerError";

const DEFAULT_TITLE = "Something went wrong on our end";
const DEFAULT_DESCRIPTION =
  "This is not your fault. Our team has been notified and we're working on a fix. Please try again in a moment.";
const RATE_LIMIT_TITLE = "Rate Limit Exceeded";
const RATE_LIMIT_DESCRIPTION =
  "You've made too many requests. Please wait before trying again.";

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function mockClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    writable: true,
    value: { writeText },
  });
}

describe("ServerError", () => {
  beforeEach(() => {
    mockClipboard(vi.fn().mockResolvedValue(undefined));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("defaults and overrides", () => {
    it("renders the default heading and description inside an alert region", () => {
      render(<ServerError />);

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { level: 2, name: DEFAULT_TITLE }),
      ).toBeInTheDocument();
      expect(screen.getByText(DEFAULT_DESCRIPTION)).toBeInTheDocument();
    });

    it("uses custom title and description when provided", () => {
      render(
        <ServerError title="Custom title" description="Custom description" />,
      );

      expect(
        screen.getByRole("heading", { level: 2, name: "Custom title" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Custom description")).toBeInTheDocument();
      expect(screen.queryByText(DEFAULT_TITLE)).not.toBeInTheDocument();
    });

    it("switches to rate-limit copy when resetAt is provided", () => {
      render(<ServerError resetAt="2026-04-29T12:00:00.000Z" />);

      expect(
        screen.getByRole("heading", { level: 2, name: RATE_LIMIT_TITLE }),
      ).toBeInTheDocument();
      expect(screen.getByText(RATE_LIMIT_DESCRIPTION)).toBeInTheDocument();
      expect(screen.getByText("Rate limit resets at")).toBeInTheDocument();
    });

    it("shows the rate-limit stats when limit and remaining are provided", () => {
      render(
        <ServerError
          resetAt="2026-04-29T12:00:00.000Z"
          limit={1000}
          remaining={25}
        />,
      );

      expect(screen.getByText("Limit")).toBeInTheDocument();
      expect(screen.getByText("1,000")).toBeInTheDocument();
      expect(screen.getByText("Remaining")).toBeInTheDocument();
      expect(screen.getByText("25")).toBeInTheDocument();
    });

    it("does not show rate-limit stats without resetAt", () => {
      render(<ServerError limit={1000} remaining={25} />);

      expect(screen.queryByText("Limit")).not.toBeInTheDocument();
      expect(screen.queryByText("Remaining")).not.toBeInTheDocument();
    });
  });

  describe("retry", () => {
    it("does not render a retry button without onRetry", () => {
      render(<ServerError />);

      expect(
        screen.queryByRole("button", { name: "Try again" }),
      ).not.toBeInTheDocument();
    });

    it("focuses the retry button on mount", () => {
      render(<ServerError onRetry={vi.fn()} />);

      expect(screen.getByRole("button", { name: "Try again" })).toHaveFocus();
    });

    it("calls onRetry once per click", async () => {
      const onRetry = vi.fn().mockResolvedValue(undefined);
      render(<ServerError onRetry={onRetry} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Try again" }));
      });

      expect(onRetry).toHaveBeenCalledOnce();
      expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
    });

    it("shows the retrying state until the promise settles", async () => {
      const pending = deferred();
      const onRetry = vi.fn(() => pending.promise);
      render(<ServerError onRetry={onRetry} />);

      fireEvent.click(screen.getByRole("button", { name: "Try again" }));

      const retrying = await screen.findByRole("button", {
        name: "Retrying…",
      });
      expect(retrying).toBeDisabled();
      expect(retrying).toHaveAttribute("aria-busy", "true");

      await act(async () => {
        pending.resolve();
        await pending.promise;
      });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
      });
      expect(
        screen.getByRole("button", { name: "Try again" }),
      ).toHaveAttribute("aria-busy", "false");
    });

    it("ignores a second click while a retry is in flight", async () => {
      const pending = deferred();
      const onRetry = vi.fn(() => pending.promise);
      render(<ServerError onRetry={onRetry} />);

      const button = screen.getByRole("button", { name: "Try again" });
      fireEvent.click(button);
      await screen.findByRole("button", { name: "Retrying…" });
      fireEvent.click(screen.getByRole("button", { name: "Retrying…" }));

      expect(onRetry).toHaveBeenCalledOnce();

      await act(async () => {
        pending.resolve();
        await pending.promise;
      });
    });

    it("re-enables the button after a rejected retry", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const onRetry = vi.fn().mockRejectedValue(new Error("network down"));
      render(<ServerError onRetry={onRetry} />);

      fireEvent.click(screen.getByRole("button", { name: "Try again" }));

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
      });
      expect(consoleError).toHaveBeenCalled();
    });

    it("re-enables the button when onRetry throws synchronously", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const onRetry = vi.fn(() => {
        throw new Error("boom");
      });
      render(<ServerError onRetry={onRetry} />);

      fireEvent.click(screen.getByRole("button", { name: "Try again" }));

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
      });
    });

    it("does not warn when unmounted during a retry", async () => {
      const pending = deferred();
      const onRetry = vi.fn(() => pending.promise);
      const { unmount } = render(<ServerError onRetry={onRetry} />);

      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
      await screen.findByRole("button", { name: "Retrying…" });
      unmount();

      await act(async () => {
        pending.resolve();
        await pending.promise;
      });
    });
  });

  describe("request id", () => {
    it("does not render a reference without a requestId", () => {
      render(<ServerError />);

      expect(screen.queryByText(/Reference:/)).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Copy request ID" }),
      ).not.toBeInTheDocument();
    });

    it("renders the reference and copy control with a requestId", () => {
      render(<ServerError requestId="REF-123" />);

      expect(screen.getByText("Reference: REF-123")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Copy request ID" }),
      ).toBeInTheDocument();
    });

    it("copies the request id and announces it", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      mockClipboard(writeText);
      render(<ServerError requestId="REF-123" />);

      fireEvent.click(screen.getByRole("button", { name: "Copy request ID" }));

      await screen.findByText("Copied!");
      expect(writeText).toHaveBeenCalledWith("REF-123");
      expect(
        screen.getByText("Request ID copied to clipboard"),
      ).toBeInTheDocument();
    });

    it("resets the copied label after two seconds", async () => {
      vi.useFakeTimers();
      render(<ServerError requestId="REF-123" />);

      fireEvent.click(screen.getByRole("button", { name: "Copy request ID" }));
      await act(async () => {
        await Promise.resolve();
      });
      expect(screen.getByText("Copied!")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.getByText("Copy")).toBeInTheDocument();
      expect(screen.queryByText("Copied!")).not.toBeInTheDocument();
    });

    it("logs a clipboard failure without showing the copied state", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const writeText = vi.fn().mockRejectedValue(new Error("denied"));
      mockClipboard(writeText);
      render(<ServerError requestId="REF-123" />);

      fireEvent.click(screen.getByRole("button", { name: "Copy request ID" }));

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalled();
      });
      expect(screen.queryByText("Copied!")).not.toBeInTheDocument();
      expect(screen.getByText("Copy")).toBeInTheDocument();
    });
  });

  describe("go home", () => {
    it("does not render a go-home control without onGoHome", () => {
      render(<ServerError />);

      expect(
        screen.queryByRole("button", { name: "Go home" }),
      ).not.toBeInTheDocument();
    });

    it("calls onGoHome once when clicked", async () => {
      const onGoHome = vi.fn();
      const user = userEvent.setup();
      render(<ServerError onGoHome={onGoHome} />);

      await user.click(screen.getByRole("button", { name: "Go home" }));

      expect(onGoHome).toHaveBeenCalledOnce();
    });
  });
});
