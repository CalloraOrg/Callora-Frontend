import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ServerError from "../ServerError";

describe("ServerError", () => {
  it("renders with default error message", () => {
    render(<ServerError />);

    expect(
      screen.getByText("Something went wrong on our end"),
    ).toBeInTheDocument();
    expect(screen.getByText(/This is not your fault/i)).toBeInTheDocument();
  });

  it("renders with custom title and description", () => {
    render(
      <ServerError
        title="Custom Error"
        description="This is a custom error message."
      />,
    );

    expect(screen.getByText("Custom Error")).toBeInTheDocument();
    expect(
      screen.getByText("This is a custom error message."),
    ).toBeInTheDocument();
  });

  it("renders retry button when onRetry is provided", () => {
    const onRetry = vi.fn();
    render(<ServerError onRetry={onRetry} />);

    expect(
      screen.getByRole("button", { name: /try again/i }),
    ).toBeInTheDocument();
  });

  it("calls onRetry when retry button is clicked", async () => {
    const onRetry = vi.fn();
    render(<ServerError onRetry={onRetry} />);

    const retryButton = screen.getByRole("button", { name: /try again/i });
    await userEvent.click(retryButton);

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('shows "Retrying..." text while retrying', async () => {
    const onRetry = vi.fn(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    );
    render(<ServerError onRetry={onRetry} />);

    const retryButton = screen.getByRole("button", { name: /try again/i });
    await userEvent.click(retryButton);

    expect(screen.getByText("Retrying…")).toBeInTheDocument();
  });

  it("renders request ID when provided", () => {
    render(<ServerError requestId="req_123456" />);

    expect(screen.getByText(/Reference: req_123456/i)).toBeInTheDocument();
  });

  it("allows copying request ID", async () => {
    render(<ServerError requestId="req_123456" />);

    const copyButton = screen.getByRole("button", { name: /copy/i });
    await userEvent.click(copyButton);

    expect(screen.getByText("Copied!")).toBeInTheDocument();
  });

  describe("Rate-limit error display", () => {
    it("renders rate-limit specific title when resetAt is provided", () => {
      const resetTime = new Date(Date.now() + 30000).toISOString();
      render(<ServerError resetAt={resetTime} limit={100} remaining={0} />);

      expect(screen.getByText("Rate Limit Exceeded")).toBeInTheDocument();
    });

    it("renders rate-limit specific description when resetAt is provided", () => {
      const resetTime = new Date(Date.now() + 30000).toISOString();
      render(<ServerError resetAt={resetTime} limit={100} remaining={0} />);

      expect(
        screen.getByText(/You've made too many requests/i),
      ).toBeInTheDocument();
    });

    it("displays limit and remaining stats", () => {
      const resetTime = new Date(Date.now() + 30000).toISOString();
      render(<ServerError resetAt={resetTime} limit={1000} remaining={0} />);

      expect(screen.getByText("1,000")).toBeInTheDocument(); // limit
      expect(screen.getByText("0")).toBeInTheDocument(); // remaining
    });

    it("displays reset time", () => {
      const now = Date.now();
      const resetTime = new Date(now + 60000).toISOString();
      render(<ServerError resetAt={resetTime} limit={100} remaining={0} />);

      expect(screen.getByText(/Rate limit resets at/i)).toBeInTheDocument();
    });

    it("uses danger color for rate-limit icon", () => {
      const resetTime = new Date(Date.now() + 30000).toISOString();
      const { container } = render(
        <ServerError resetAt={resetTime} limit={100} remaining={0} />,
      );

      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("stroke", "var(--danger)");
    });

    it("uses normal color for server error icon", () => {
      const { container } = render(<ServerError />);

      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("stroke", "var(--muted)");
    });

    it("allows custom title to override default rate-limit title", () => {
      const resetTime = new Date(Date.now() + 30000).toISOString();
      render(
        <ServerError
          resetAt={resetTime}
          title="Custom Rate Limit Message"
          limit={100}
          remaining={0}
        />,
      );

      expect(screen.getByText("Custom Rate Limit Message")).toBeInTheDocument();
    });

    it("allows custom description to override default rate-limit description", () => {
      const resetTime = new Date(Date.now() + 30000).toISOString();
      render(
        <ServerError
          resetAt={resetTime}
          description="Custom rate-limit description"
          limit={100}
          remaining={0}
        />,
      );

      expect(
        screen.getByText("Custom rate-limit description"),
      ).toBeInTheDocument();
    });
  });

  it("has proper accessibility attributes", () => {
    render(<ServerError />);

    const section = screen.getByRole("alert");
    expect(section).toBeInTheDocument();
  });

  it("does not render request ID section when requestId is not provided", () => {
    render(<ServerError />);

    const referenceText = screen.queryByText(/Reference:/);
    expect(referenceText).not.toBeInTheDocument();
  });

  it("does not render retry button when onRetry is not provided", () => {
    render(<ServerError />);

    const retryButton = screen.queryByRole("button", { name: /try again/i });
    expect(retryButton).not.toBeInTheDocument();
  });
});
