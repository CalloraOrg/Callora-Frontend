import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import StandaloneShell from "./StandaloneShell";

describe("StandaloneShell", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
  });

  it("exposes banner, navigation, main and contentinfo landmarks", () => {
    render(<StandaloneShell><p>Body</p></StandaloneShell>);
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("renders six primary navigation links", () => {
    render(<StandaloneShell><p>Body</p></StandaloneShell>);
    const nav = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(within(nav).getAllByRole("link")).toHaveLength(6);
  });

  it("places children inside the main landmark", () => {
    render(<StandaloneShell><p>Page content</p></StandaloneShell>);
    expect(within(screen.getByRole("main")).getByText("Page content")).toBeInTheDocument();
  });

  it("provides a skip link targeting the main id as the first focusable element", () => {
    const { container } = render(<StandaloneShell><p>Body</p></StandaloneShell>);
    const skip = screen.getByRole("link", { name: "Skip to main content" });
    expect(skip).toHaveAttribute("href", "#main-content");
    expect(skip).toHaveClass("skip-link");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    const focusable = container.querySelectorAll("a[href], button, input, select, textarea");
    expect(focusable[0]).toBe(skip);
  });

  it("marks the active link based on window.location.pathname", () => {
    window.history.pushState({}, "", "/marketplace");
    render(<StandaloneShell><p>Body</p></StandaloneShell>);
    const nav = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(within(nav).getByRole("link", { name: "Marketplace" })).toHaveClass("active");
    expect(within(nav).getByRole("link", { name: "Dashboard" })).not.toHaveClass("active");
  });

  it("keeps My APIs active on nested paths", () => {
    window.history.pushState({}, "", "/apis/my-apis/123");
    render(<StandaloneShell><p>Body</p></StandaloneShell>);
    const nav = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(within(nav).getByRole("link", { name: "My APIs" })).toHaveClass("active");
  });
});
