// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Tooltip from "./Tooltip";

describe("Tooltip", () => {
  afterEach(() => cleanup());

  it("is hidden by default", () => {
    render(
      <Tooltip content="Helpful text">
        <button>Trigger</button>
      </Tooltip>,
    );
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("shows on hover and hides on leave", () => {
    render(
      <Tooltip content="Helpful text">
        <button>Trigger</button>
      </Tooltip>,
    );
    const trigger = screen.getByText("Trigger");
    fireEvent.mouseEnter(trigger);
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.mouseLeave(trigger);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("shows on keyboard focus and links via aria-describedby", () => {
    render(
      <Tooltip content="Helpful text">
        <button>Trigger</button>
      </Tooltip>,
    );
    const trigger = screen.getByText("Trigger");
    fireEvent.focus(trigger);
    const tip = screen.getByRole("tooltip");
    expect(trigger.getAttribute("aria-describedby")).toBe(tip.id);
  });

  it("dismisses on Escape", () => {
    render(
      <Tooltip content="Helpful text">
        <button>Trigger</button>
      </Tooltip>,
    );
    fireEvent.mouseEnter(screen.getByText("Trigger"));
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("respects hoverDelayMs before showing tooltip on hover", () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Helpful text" hoverDelayMs={300}>
        <button>Trigger</button>
      </Tooltip>,
    );
    const trigger = screen.getByText("Trigger");
    fireEvent.mouseEnter(trigger);

    expect(screen.queryByRole("tooltip")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByRole("tooltip")).toBeTruthy();

    vi.useRealTimers();
  });

  it("cancels hover delay if mouse leaves before timer finishes", () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Helpful text" hoverDelayMs={300}>
        <button>Trigger</button>
      </Tooltip>,
    );
    const trigger = screen.getByText("Trigger");
    fireEvent.mouseEnter(trigger);
    act(() => {
      vi.advanceTimersByTime(150);
    });
    fireEvent.mouseLeave(trigger);
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.queryByRole("tooltip")).toBeNull();

    vi.useRealTimers();
  });

  it("opens on touch long-press after longPressMs", () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Helpful text" longPressMs={400}>
        <button>Trigger</button>
      </Tooltip>,
    );
    const trigger = screen.getByText("Trigger");
    fireEvent.touchStart(trigger);

    expect(screen.queryByRole("tooltip")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByRole("tooltip")).toBeTruthy();

    vi.useRealTimers();
  });
});
