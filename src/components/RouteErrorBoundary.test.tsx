import { vi, describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RouteErrorBoundary from "./RouteErrorBoundary";

function Boom({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error("kaboom");
  }
  return <div>recovered-content</div>;
}

describe("RouteErrorBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders children unchanged when there is no error", () => {
    render(
      <RouteErrorBoundary>
        <div>hello</div>
      </RouteErrorBoundary>,
    );
    expect(screen.getByText("hello")).toBeTruthy();
  });

  it("catches a render error and shows the recoverable fallback", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <RouteErrorBoundary message="A recoverable problem occurred.">
        <Boom />
      </RouteErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeTruthy();
    expect(screen.getByText("A recoverable problem occurred.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("recovers after the user clicks Try again once the child stops throwing", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { rerender } = render(
      <RouteErrorBoundary>
        <Boom />
      </RouteErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeTruthy();

    rerender(
      <RouteErrorBoundary>
        <Boom shouldThrow={false} />
      </RouteErrorBoundary>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(screen.getByText("recovered-content")).toBeTruthy();
  });

  it("shows the unrecoverable state once retries are exhausted", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <RouteErrorBoundary maxRetries={1}>
        <Boom />
      </RouteErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("This page couldn't be recovered")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.getByRole("button", { name: "Reload page" })).toBeTruthy();
  });

  it("resets automatically when resetKey changes", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { rerender } = render(
      <RouteErrorBoundary resetKey="/a">
        <Boom />
      </RouteErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeTruthy();

    rerender(
      <RouteErrorBoundary resetKey="/b">
        <Boom shouldThrow={false} />
      </RouteErrorBoundary>,
    );
    expect(screen.getByText("recovered-content")).toBeTruthy();
  });
});
