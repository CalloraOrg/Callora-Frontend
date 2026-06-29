// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestInBrowser from "./TestInBrowser";

afterEach(cleanup);

const defaultProps = {
  endpointUrl: "https://api.callora.com/v1/forecast",
  method: "GET",
  params: [
    { name: "lat", type: "number", required: true },
    { name: "lon", type: "number", required: true },
    { name: "units", type: "string", required: false },
  ],
};

describe("TestInBrowser", () => {
  it("renders the trigger button in a collapsed state by default", () => {
    render(<TestInBrowser {...defaultProps} />);

    const trigger = screen.getByRole("button", { name: /test in browser/i });
    expect(trigger).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    // Panel should not be visible
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("opens the test panel when the trigger is clicked", () => {
    render(<TestInBrowser {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /test in browser/i }));

    // Panel should be present
    expect(screen.getByRole("region")).toBeTruthy();
    // Trigger should now say "close"
    expect(
      screen.getByRole("button", { name: /close test runner/i }),
    ).toBeTruthy();
    // Parameter inputs should appear
    expect(screen.getByLabelText(/lat parameter value/i)).toBeTruthy();
    expect(screen.getByLabelText(/lon parameter value/i)).toBeTruthy();
  });

  it("shows an error message when the fetch fails", async () => {
    // Simulate a network error
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error")),
    );

    render(<TestInBrowser {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /test in browser/i }));
    fireEvent.click(screen.getByRole("button", { name: /^run$/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
      expect(screen.getByText(/network error/i)).toBeTruthy();
    });

    vi.unstubAllGlobals();
  });

  it("displays the response body and HTTP status on success", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ temperature: 22 }),
    } as unknown as Response;

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

    render(<TestInBrowser {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /test in browser/i }));
    fireEvent.click(screen.getByRole("button", { name: /^run$/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/http status 200/i)).toBeTruthy();
      expect(screen.getByLabelText(/response body/i).textContent).toContain("temperature");
    });

    vi.unstubAllGlobals();
  });
});
