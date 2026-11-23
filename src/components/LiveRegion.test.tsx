import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import LiveRegion from "./LiveRegion";

describe("LiveRegion", () => {
  let rafCallbacks: FrameRequestCallback[];

  beforeEach(() => {
    rafCallbacks = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const flushFrames = () => {
    act(() => {
      const cbs = rafCallbacks.splice(0);
      cbs.forEach((cb) => cb(0));
    });
  };

  it("defaults to polite status role", () => {
    render(<LiveRegion message="Saved" />);
    const region = screen.getByTestId("live-region");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("role", "status");
  });

  it("uses assertive alert when assertive is set", () => {
    render(<LiveRegion message="Error" assertive />);
    const region = screen.getByTestId("live-region");
    expect(region).toHaveAttribute("aria-live", "assertive");
    expect(region).toHaveAttribute("role", "alert");
  });

  it("honours explicit aria-live and role overrides", () => {
    render(<LiveRegion message="Note" aria-live="off" role="log" />);
    const region = screen.getByTestId("live-region");
    expect(region).toHaveAttribute("aria-live", "off");
    expect(region).toHaveAttribute("role", "log");
  });

  it("renders the message into the DOM", () => {
    render(<LiveRegion message="Hello world" />);
    expect(screen.getByTestId("live-region")).toHaveTextContent("Hello world");
  });

  it("re-announces an identical repeated message via a trailing space", () => {
    const { rerender } = render(<LiveRegion message="Copied" />);
    flushFrames();
    const region = screen.getByTestId("live-region");
    expect(region).toHaveTextContent("Copied");

    rerender(<LiveRegion message="Copied" />);
    expect(region.textContent).toBe("Copied ");

    flushFrames();
    expect(region.textContent).toBe("Copied");
  });

  it("handles A -> B -> B transitions", () => {
    const { rerender } = render(<LiveRegion message="A" />);
    rerender(<LiveRegion message="B" />);
    expect(screen.getByTestId("live-region")).toHaveTextContent("B");
    rerender(<LiveRegion message="B" />);
    expect(screen.getByTestId("live-region").textContent).toBe("B ");
    flushFrames();
    expect(screen.getByTestId("live-region").textContent).toBe("B");
  });

  it("toggles aria-hidden when there is no message", () => {
    const { rerender } = render(<LiveRegion message="" />);
    expect(screen.getByTestId("live-region")).toHaveAttribute("aria-hidden", "true");
    rerender(<LiveRegion message="Visible now" />);
    expect(screen.getByTestId("live-region")).not.toHaveAttribute("aria-hidden", "true");
  });

  it("derives the test id from regionId", () => {
    render(<LiveRegion message="x" regionId="toast" />);
    expect(screen.getByTestId("live-region-toast")).toBeInTheDocument();
  });
});
