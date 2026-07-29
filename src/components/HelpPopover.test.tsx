// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import HelpPopover from "./HelpPopover";

afterEach(cleanup);

describe("HelpPopover", () => {
  it("renders an info icon button with the default accessible label", () => {
    render(<HelpPopover content="Helpful explanation" />);

    const btn = screen.getByRole("button", { name: "Help" });
    expect(btn).toBeTruthy();
  });

  it("renders an info icon button with a custom accessible label", () => {
    render(
      <HelpPopover
        content="Helpful explanation"
        ariaLabel="What does subscription mean?"
      />
    );

    const btn = screen.getByRole("button", { name: "What does subscription mean?" });
    expect(btn).toBeTruthy();
  });

  it("shows the tooltip/popover content on hover via the Tooltip component", async () => {
    render(<HelpPopover content="Helpful explanation for new users" />);

    // Popover should not be visible initially
    expect(screen.queryByRole("tooltip")).toBeNull();

    // Hover the trigger button
    const btn = screen.getByRole("button", { name: "Help" });
    fireEvent.mouseEnter(btn);

    // The default hover delay is 300ms, so wait for the tooltip to appear
    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeTruthy();
    });

    expect(screen.getByText("Helpful explanation for new users")).toBeTruthy();
  });

  it("shows the tooltip on keyboard focus", async () => {
    render(<HelpPopover content="Focus-revealed content" />);

    expect(screen.queryByRole("tooltip")).toBeNull();

    // Focus the trigger button
    const btn = screen.getByRole("button", { name: "Help" });
    fireEvent.focus(btn);

    // Tooltip should appear immediately on focus (Tooltip behaviour)
    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeTruthy();
    });

    expect(screen.getByText("Focus-revealed content")).toBeTruthy();
  });

  it("dismisses the tooltip when the trigger loses focus", async () => {
    render(<HelpPopover content="Dismiss on blur" />);

    const btn = screen.getByRole("button", { name: "Help" });
    fireEvent.focus(btn);

    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeTruthy();
    });

    fireEvent.blur(btn);

    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).toBeNull();
    });
  });

  it("dismisses the tooltip on Escape key press", async () => {
    render(<HelpPopover content="Escape dismisses" />);

    const btn = screen.getByRole("button", { name: "Help" });
    fireEvent.mouseEnter(btn);

    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeTruthy();
    });

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).toBeNull();
    });
  });

  it("has a visible InfoIcon SVG inside the trigger button", () => {
    const { container } = render(<HelpPopover content="Icon test" />);

    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("applies the help-popover-trigger class to the icon button", () => {
    render(<HelpPopover content="Class test" />);

    const btn = screen.getByRole("button", { name: "Help" });
    expect(btn.className).toContain("help-popover-trigger");
  });

  it("forwards an additional className to the trigger button", () => {
    render(
      <HelpPopover content="Class test" className="custom-class" />
    );

    const btn = screen.getByRole("button", { name: "Help" });
    expect(btn.className).toContain("help-popover-trigger");
    expect(btn.className).toContain("custom-class");
  });
});
