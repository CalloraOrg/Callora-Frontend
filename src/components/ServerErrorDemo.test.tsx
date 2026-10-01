import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ServerErrorDemo from "./ServerErrorDemo";

// ServerErrorDemo uses a 1 500 ms simulated delay inside handleRetry.
// We use fake timers so we can fast-forward without real waiting.
describe("ServerErrorDemo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  // ─── helpers ────────────────────────────────────────────────────────────────

  /** Click a scenario selector button by its visible label. */
  async function selectScenario(user: ReturnType<typeof userEvent.setup>, label: string) {
    await user.click(screen.getByRole("button", { name: label }));
  }

  // ─── initial state ───────────────────────────────────────────────────────────

  it("renders the demo page heading", () => {
    render(<ServerErrorDemo />);
    expect(screen.getByRole("heading", { name: /ServerError Component Demo/i })).toBeInTheDocument();
  });

  it("renders all four scenario selector buttons", () => {
    render(<ServerErrorDemo />);
    expect(screen.getByRole("button", { name: "No Props" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "With Retry" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "With Request ID" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Full (Retry + Request ID)" })).toBeInTheDocument();
  });

  it("defaults to the 'full' scenario on mount", () => {
    render(<ServerErrorDemo />);
    // Full scenario has both retry button and request ID
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByText(/REF-2026-04-29-A7F3B2C1/)).toBeInTheDocument();
  });

  // ─── Acceptance criterion: 'no-props' renders no retry button ───────────────

  describe("'no-props' scenario", () => {
    it("renders the default error heading", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<ServerErrorDemo />);
      await selectScenario(user, "No Props");

      expect(screen.getByText("Something went wrong on our end")).toBeInTheDocument();
    });

    it("does NOT render a retry button", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<ServerErrorDemo />);
      await selectScenario(user, "No Props");

      expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
    });

    it("does NOT show a request ID reference", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<ServerErrorDemo />);
      await selectScenario(user, "No Props");

      expect(screen.queryByText(/Reference:/i)).not.toBeInTheDocument();
    });
  });

  // ─── 'with-retry' scenario ───────────────────────────────────────────────────

  describe("'with-retry' scenario", () => {
    it("renders the retry button", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<ServerErrorDemo />);
      await selectScenario(user, "With Retry");

      expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    });

    it("does NOT show a request ID reference", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<ServerErrorDemo />);
      await selectScenario(user, "With Retry");

      expect(screen.queryByText(/Reference:/i)).not.toBeInTheDocument();
    });
  });

  // ─── Acceptance criterion: 'with-requestid' shows the request ID ─────────────

  describe("'with-requestid' scenario", () => {
    it("shows the request ID reference", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<ServerErrorDemo />);
      await selectScenario(user, "With Request ID");

      expect(screen.getByText(/REF-2026-04-29-A7F3B2C1/)).toBeInTheDocument();
    });

    it("does NOT render a retry button", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<ServerErrorDemo />);
      await selectScenario(user, "With Request ID");

      expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
    });
  });

  // ─── Acceptance criterion: 'full' shows all ServerError affordances ──────────

  describe("'full' scenario", () => {
    it("renders the retry button", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<ServerErrorDemo />);
      // Navigate away and back to ensure clean re-render
      await selectScenario(user, "No Props");
      await selectScenario(user, "Full (Retry + Request ID)");

      expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    });

    it("shows the request ID reference", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<ServerErrorDemo />);
      await selectScenario(user, "No Props");
      await selectScenario(user, "Full (Retry + Request ID)");

      expect(screen.getByText(/REF-2026-04-29-A7F3B2C1/)).toBeInTheDocument();
    });

    it("renders the alert region", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<ServerErrorDemo />);
      await selectScenario(user, "No Props");
      await selectScenario(user, "Full (Retry + Request ID)");

      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  // ─── Acceptance criterion: retry increments the displayed count ──────────────

  describe("retry counter", () => {
    it("does not show the retry count before any retry", () => {
      render(<ServerErrorDemo />);
      // 'full' is default; no retries yet
      expect(screen.queryByText(/Retry called/i)).not.toBeInTheDocument();
    });

    it("shows 'Retry called 1 time' after one retry", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<ServerErrorDemo />);

      const retryButton = screen.getByRole("button", { name: /try again/i });
      await user.click(retryButton);

      // Fast-forward the 1 500 ms simulated delay
      await act(async () => {
        vi.advanceTimersByTime(1500);
      });

      expect(screen.getByText("Retry called 1 time")).toBeInTheDocument();
    });

    it("shows 'Retry called 2 times' after two retries", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<ServerErrorDemo />);

      const retryButton = screen.getByRole("button", { name: /try again/i });

      // First retry
      await user.click(retryButton);
      await act(async () => { vi.advanceTimersByTime(1500); });

      // Second retry
      await user.click(screen.getByRole("button", { name: /try again/i }));
      await act(async () => { vi.advanceTimersByTime(1500); });

      expect(screen.getByText("Retry called 2 times")).toBeInTheDocument();
    });

    it("increments count independently for each retry", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<ServerErrorDemo />);

      for (let i = 1; i <= 3; i++) {
        await user.click(screen.getByRole("button", { name: /try again/i }));
        await act(async () => { vi.advanceTimersByTime(1500); });
        expect(
          screen.getByText(`Retry called ${i} time${i > 1 ? "s" : ""}`)
        ).toBeInTheDocument();
      }
    });

    it("resets count display when switching to a no-retry scenario mid-session", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<ServerErrorDemo />);

      // Fire a retry on the default 'full' scenario
      await user.click(screen.getByRole("button", { name: /try again/i }));
      await act(async () => { vi.advanceTimersByTime(1500); });
      expect(screen.getByText(/Retry called 1 time/)).toBeInTheDocument();

      // Switch to 'no-props' — the counter text should still exist in the DOM
      // (it lives outside ServerError, in the demo wrapper) but the retry
      // button provided to ServerError is gone.
      await selectScenario(user, "No Props");

      expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
      // Counter stays visible (demo doesn't reset it on scenario change — by design)
      expect(screen.getByText(/Retry called 1 time/)).toBeInTheDocument();
    });
  });

  // ─── 'with-retry' scenario also increments counter ──────────────────────────

  describe("retry counter via 'with-retry' scenario", () => {
    it("increments counter when retrying from the 'with-retry' scenario", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<ServerErrorDemo />);
      await selectScenario(user, "With Retry");

      await user.click(screen.getByRole("button", { name: /try again/i }));
      await act(async () => { vi.advanceTimersByTime(1500); });

      expect(screen.getByText("Retry called 1 time")).toBeInTheDocument();
    });
  });
});
