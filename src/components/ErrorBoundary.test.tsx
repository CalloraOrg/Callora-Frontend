// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Render error");
  }
  return <div>Child content</div>;
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.stubGlobal("console", { error: vi.fn() });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders children when no error occurs", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Child content")).toBeTruthy();
  });

  it("renders default error fallback with retry button when child throws", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(
      screen.getByText("Something went wrong. Please try again."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
  });

  it("renders custom fallback when provided", () => {
    render(
      <ErrorBoundary
        fallback={(error, retry) => (
          <div role="alert">
            <p>Custom: {error.message}</p>
            <button onClick={retry}>Custom Retry</button>
          </div>
        )}
      >
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Custom: Render error")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /custom retry/i }),
    ).toBeTruthy();
  });

  it("uses custom error message in default fallback", () => {
    render(
      <ErrorBoundary message="Custom error message">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Custom error message")).toBeTruthy();
  });

  it("re-renders children after retry button is clicked when error is resolved", () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeTruthy();

    screen.getByRole("button", { name: /retry/i }).click();

    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("Child content")).toBeTruthy();
  });

  it("resets error state when resetKey changes", () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="a">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeTruthy();

    rerender(
      <ErrorBoundary resetKey="b">
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("Child content")).toBeTruthy();
  });

  it("has aria-live polite on the fallback container", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );
    const fallback = screen.getByRole("alert");
    expect(fallback.getAttribute("aria-live")).toBe("polite");
  });
});
