import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RateLimitAlert from "../RateLimitAlert";

describe("RateLimitAlert", () => {
  it("renders nothing when timeUntilReset is 0", () => {
    const { container } = render(<RateLimitAlert timeUntilReset={0} />);

    expect(container.firstChild).toBeNull();
  });

  it("renders alert when timeUntilReset is positive", () => {
    render(<RateLimitAlert timeUntilReset={30000} limit={100} remaining={0} />);

    expect(screen.getByText("Rate Limit Exceeded")).toBeInTheDocument();
    expect(
      screen.getByText(/You've made too many requests/i),
    ).toBeInTheDocument();
  });

  it("displays countdown in human-readable format", () => {
    render(<RateLimitAlert timeUntilReset={63000} limit={100} remaining={0} />);

    expect(screen.getByText("1m 3s")).toBeInTheDocument();
  });

  it("displays limit and remaining in stats", () => {
    render(
      <RateLimitAlert timeUntilReset={30000} limit={1000} remaining={0} />,
    );

    expect(screen.getByText("1,000")).toBeInTheDocument(); // limit
    expect(screen.getByText("0")).toBeInTheDocument(); // remaining
  });

  it("omits stats section when limit is undefined", () => {
    const { container } = render(
      <RateLimitAlert timeUntilReset={30000} remaining={0} />,
    );

    const statsSection = container.querySelector(
      '[data-testid="rate-limit-stats"]',
    );
    expect(statsSection).not.toBeInTheDocument();
  });

  it("calls onRetry when Try again button is clicked", async () => {
    const onRetry = vi.fn();
    render(
      <RateLimitAlert
        timeUntilReset={30000}
        limit={100}
        remaining={0}
        onRetry={onRetry}
      />,
    );

    const tryAgainButton = screen.getByRole("button", { name: /try again/i });
    await userEvent.click(tryAgainButton);

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("does not render try again button when onRetry is not provided", () => {
    render(<RateLimitAlert timeUntilReset={30000} limit={100} remaining={0} />);

    const tryAgainButton = screen.queryByRole("button", { name: /try again/i });
    expect(tryAgainButton).not.toBeInTheDocument();
  });

  it("renders compact version when compact prop is true", () => {
    const { container } = render(
      <RateLimitAlert
        timeUntilReset={30000}
        limit={100}
        remaining={0}
        compact={true}
      />,
    );

    const compactAlert = container.querySelector(".rate-limit-alert-compact");
    expect(compactAlert).toBeInTheDocument();
  });

  it("compact version displays inline countdown", () => {
    render(<RateLimitAlert timeUntilReset={30000} compact={true} />);

    expect(screen.getByText(/Rate limited. Retry in/i)).toBeInTheDocument();
  });

  it("has proper accessibility attributes", () => {
    render(<RateLimitAlert timeUntilReset={30000} limit={100} remaining={0} />);

    const section = screen.getByRole("alert");
    expect(section).toHaveAttribute("aria-live", "polite");
    expect(section).toHaveAttribute("aria-atomic", "true");
  });

  it("includes support contact information", () => {
    render(<RateLimitAlert timeUntilReset={30000} limit={100} remaining={0} />);

    const supportLink = screen.getByRole("link", {
      name: /support@callora.com/i,
    });
    expect(supportLink).toHaveAttribute("href", "mailto:support@callora.com");
  });

  it("compact version calls onRetry when Try now is clicked", async () => {
    const onRetry = vi.fn();
    render(
      <RateLimitAlert
        timeUntilReset={30000}
        limit={100}
        remaining={0}
        onRetry={onRetry}
        compact={true}
      />,
    );

    const tryNowButton = screen.getByRole("button", { name: /try now/i });
    await userEvent.click(tryNowButton);

    expect(onRetry).toHaveBeenCalledOnce();
  });
});
