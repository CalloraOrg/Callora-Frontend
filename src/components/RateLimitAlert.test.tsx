// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import RateLimitAlert from "./RateLimitAlert";

describe("RateLimitAlert", () => {
  afterEach(() => {
    cleanup();
  });

  describe("hidden when not rate limited", () => {
    it("renders nothing when timeUntilReset is 0", () => {
      const { container } = render(<RateLimitAlert timeUntilReset={0} />);

      expect(container.firstChild).toBeNull();
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("renders nothing when timeUntilReset is negative", () => {
      const { container } = render(<RateLimitAlert timeUntilReset={-5_000} />);

      expect(container.firstChild).toBeNull();
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("renders nothing in compact mode when timeUntilReset is 0 or negative", () => {
      const { container, rerender } = render(
        <RateLimitAlert timeUntilReset={0} compact />,
      );

      expect(container.firstChild).toBeNull();

      rerender(<RateLimitAlert timeUntilReset={-1} compact />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe("full variant", () => {
    it("renders semantic alert attributes, hourglass icon, and countdown for 45_000 ms", () => {
      render(<RateLimitAlert timeUntilReset={45_000} />);

      const alert = screen.getByRole("alert");
      expect(alert.tagName).toBe("SECTION");
      expect(alert.getAttribute("aria-live")).toBe("polite");
      expect(alert.getAttribute("aria-atomic")).toBe("true");

      const hiddenIconWrapper = alert.querySelector('[aria-hidden="true"]');
      expect(hiddenIconWrapper).not.toBeNull();
      expect(hiddenIconWrapper?.querySelector("svg")).not.toBeNull();

      expect(screen.getByText("Rate Limit Exceeded")).toBeTruthy();
      expect(screen.getByText("Retry available in")).toBeTruthy();
      expect(screen.getByText("45s")).toBeTruthy();
    });

    it("formats countdown text for 3_723_000 ms and very large hour values", () => {
      const { rerender } = render(<RateLimitAlert timeUntilReset={3_723_000} />);
      expect(screen.getByText("1h 2m 3s")).toBeTruthy();

      rerender(<RateLimitAlert timeUntilReset={90_061_000} />);
      expect(screen.getByText("25h 1m 1s")).toBeTruthy();
    });

    it("shows limit and remaining stats only when both are provided", () => {
      const { rerender } = render(<RateLimitAlert timeUntilReset={45_000} />);
      expect(screen.queryByText("Limit")).toBeNull();
      expect(screen.queryByText("Remaining")).toBeNull();

      rerender(<RateLimitAlert timeUntilReset={45_000} limit={1000} />);
      expect(screen.queryByText("Limit")).toBeNull();
      expect(screen.queryByText("Remaining")).toBeNull();

      rerender(<RateLimitAlert timeUntilReset={45_000} remaining={5} />);
      expect(screen.queryByText("Limit")).toBeNull();
      expect(screen.queryByText("Remaining")).toBeNull();

      rerender(
        <RateLimitAlert timeUntilReset={45_000} limit={1000} remaining={250} />,
      );
      expect(screen.getByText("Limit")).toBeTruthy();
      expect(screen.getByText("1,000")).toBeTruthy();
      expect(screen.getByText("Remaining")).toBeTruthy();
      expect(screen.getByText("250")).toBeTruthy();
    });

    it("renders stats when remaining is 0", () => {
      render(
        <RateLimitAlert timeUntilReset={45_000} limit={100} remaining={0} />,
      );

      expect(screen.getByText("Limit")).toBeTruthy();
      expect(screen.getByText("100")).toBeTruthy();
      expect(screen.getByText("Remaining")).toBeTruthy();
      expect(screen.getByText("0")).toBeTruthy();
    });

    it("calls onRetry once when 'Try again' is clicked and omits button without onRetry", async () => {
      const user = userEvent.setup();
      const onRetry = vi.fn();

      const { rerender } = render(<RateLimitAlert timeUntilReset={45_000} />);
      expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();

      rerender(<RateLimitAlert timeUntilReset={45_000} onRetry={onRetry} />);
      const button = screen.getByRole("button", { name: "Try again" });
      await user.click(button);

      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe("compact variant", () => {
    it("renders alert role, countdown text, and omits 'Try now' without onRetry", () => {
      render(<RateLimitAlert timeUntilReset={45_000} compact />);

      const alert = screen.getByRole("alert");
      expect(alert.tagName).toBe("DIV");
      expect(alert.getAttribute("aria-live")).toBe("off");
      expect(alert.textContent).toContain("Rate limited. Retry in 45s");
      expect(screen.queryByRole("button", { name: "Try now" })).toBeNull();
    });

    it("calls onRetry once when 'Try now' is clicked", async () => {
      const user = userEvent.setup();
      const onRetry = vi.fn();

      render(
        <RateLimitAlert
          timeUntilReset={3_723_000}
          onRetry={onRetry}
          compact
        />,
      );

      const alert = screen.getByRole("alert");
      expect(alert.textContent).toContain("Rate limited. Retry in 1h 2m 3s");

      const button = screen.getByRole("button", { name: "Try now" });
      await user.click(button);

      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe("prop-driven updates", () => {
    it("updates countdown on re-render with smaller timeUntilReset and removes alert at 0", () => {
      const { rerender } = render(<RateLimitAlert timeUntilReset={45_000} />);
      expect(screen.getByRole("alert")).toBeTruthy();
      expect(screen.getByText("45s")).toBeTruthy();

      rerender(<RateLimitAlert timeUntilReset={12_000} />);
      expect(screen.getByText("12s")).toBeTruthy();
      expect(screen.queryByText("45s")).toBeNull();

      rerender(<RateLimitAlert timeUntilReset={0} />);
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("updates compact countdown on re-render and removes alert at 0", () => {
      const { rerender } = render(
        <RateLimitAlert timeUntilReset={30_000} compact />,
      );
      expect(screen.getByRole("alert").textContent).toContain(
        "Rate limited. Retry in 30s",
      );

      rerender(<RateLimitAlert timeUntilReset={5_000} compact />);
      expect(screen.getByRole("alert").textContent).toContain(
        "Rate limited. Retry in 5s",
      );

      rerender(<RateLimitAlert timeUntilReset={0} compact />);
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });
});
