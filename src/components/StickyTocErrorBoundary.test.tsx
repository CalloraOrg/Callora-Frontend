// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StickyTocErrorBoundary } from "./StickyTocErrorBoundary";

function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("StickyToc render error");
  }
  return <nav aria-label="On this page">TOC content</nav>;
}

describe("StickyTocErrorBoundary", () => {
  beforeEach(() => {
    vi.stubGlobal("console", { error: vi.fn() });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders children when no error occurs", () => {
    render(
      <StickyTocErrorBoundary>
        <ThrowError shouldThrow={false} />
      </StickyTocErrorBoundary>,
    );
    expect(screen.getByText("TOC content")).toBeTruthy();
  });

  it("renders error fallback with retry button when child throws", () => {
    render(
      <StickyTocErrorBoundary>
        <ThrowError shouldThrow={true} />
      </StickyTocErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Unable to load the table of contents.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
  });

  it("re-renders children after retry button is clicked when error is resolved", () => {
    const { rerender } = render(
      <StickyTocErrorBoundary>
        <ThrowError shouldThrow={true} />
      </StickyTocErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeTruthy();

    screen.getByRole("button", { name: /retry/i }).click();

    rerender(
      <StickyTocErrorBoundary>
        <ThrowError shouldThrow={false} />
      </StickyTocErrorBoundary>,
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("TOC content")).toBeTruthy();
  });

  it("has aria-live polite on the fallback container", () => {
    render(
      <StickyTocErrorBoundary>
        <ThrowError shouldThrow={true} />
      </StickyTocErrorBoundary>,
    );
    const fallback = screen.getByRole("alert");
    expect(fallback.getAttribute("aria-live")).toBe("polite");
  });
});