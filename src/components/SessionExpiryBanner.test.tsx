// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSessionExpiry } from "../hooks/useSessionExpiry";
import { clearSessionExpiry, signalExpiry } from "../services/sessionExpiry";
import SessionExpiryBanner from "./SessionExpiryBanner";

const DEFAULT_MESSAGE =
  "Your session has expired. Sign in again to submit this API for review — your draft has been kept.";

afterEach(() => {
  cleanup();
  clearSessionExpiry();
});

describe("SessionExpiryBanner", () => {
  it("renders its default message as an assertive alert", () => {
    render(<SessionExpiryBanner />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
    expect(alert).toHaveTextContent(DEFAULT_MESSAGE);
  });

  it("renders a custom message", () => {
    render(<SessionExpiryBanner message="Please sign in again." />);

    expect(screen.getByRole("alert")).toHaveTextContent("Please sign in again.");
  });

  it("only provides Dismiss when an onDismiss handler is supplied", () => {
    const { rerender } = render(<SessionExpiryBanner />);
    expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull();

    const onDismiss = vi.fn();
    rerender(<SessionExpiryBanner onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe("SessionExpiryBanner with useSessionExpiry", () => {
  function ExpiryBanner() {
    const { isExpired, dismiss } = useSessionExpiry();
    return isExpired ? <SessionExpiryBanner onDismiss={dismiss} /> : null;
  }

  it("appears on expiry, dismisses, and appears again after a new signal", () => {
    render(<ExpiryBanner />);
    expect(screen.queryByRole("alert")).toBeNull();

    act(() => {
      signalExpiry("unauthorized");
      signalExpiry("unauthorized");
    });
    expect(screen.getAllByRole("alert")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).toBeNull();

    act(() => {
      signalExpiry("unauthorized");
    });
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });
});
