// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import StatusIndicator from "./StatusIndicator";

afterEach(cleanup);

describe("StatusIndicator", () => {
  it("renders the live status text and dot for the active state", () => {
    render(<StatusIndicator label="API is Active" active />);

    const status = screen.getByRole("status", { name: /api is active/i });
    expect(status).toBeTruthy();
    expect(status.textContent).toContain("API is Active");
    expect(status.querySelector(".status-dot")).toBeTruthy();
  });

  it("applies the status-indicator classes targeted by high-contrast overrides", () => {
    render(<StatusIndicator label="API is Active" active />);

    const status = screen.getByRole("status", { name: /api is active/i });
    expect(status.classList.contains("status-indicator")).toBe(true);
    expect(status.classList.contains("active")).toBe(true);
  });

  it("loads the contrast stylesheet for prefers-contrast overrides", () => {
    render(<StatusIndicator label="API is Active" active />);

    const status = screen.getByRole("status", { name: /api is active/i });
    expect(status).toBeTruthy();
  });
});
