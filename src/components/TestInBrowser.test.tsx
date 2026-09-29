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

/** Props that include a sensitive-looking param alongside a safe one. */
const sensitiveProps = {
  endpointUrl: "https://api.callora.com/v1/secure",
  method: "GET",
  params: [
    { name: "apiKey", type: "string", required: true },
    { name: "token", type: "string", required: false },
    { name: "Authorization", type: "string", required: false },
    { name: "limit", type: "number", required: false },
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

  // ── Security: sensitive param inputs must be masked ───────────────────────

  describe("sensitive parameter masking", () => {
    it("renders apiKey param input as type=password", () => {
      render(<TestInBrowser {...sensitiveProps} />);
      fireEvent.click(screen.getByRole("button", { name: /test in browser/i }));

      const input = screen.getByLabelText(/apikey parameter value/i) as HTMLInputElement;
      expect(input.type).toBe("password");
    });

    it("renders token param input as type=password", () => {
      render(<TestInBrowser {...sensitiveProps} />);
      fireEvent.click(screen.getByRole("button", { name: /test in browser/i }));

      const input = screen.getByLabelText(/token parameter value/i) as HTMLInputElement;
      expect(input.type).toBe("password");
    });

    it("renders Authorization param input as type=password", () => {
      render(<TestInBrowser {...sensitiveProps} />);
      fireEvent.click(screen.getByRole("button", { name: /test in browser/i }));

      const input = screen.getByLabelText(/authorization parameter value/i) as HTMLInputElement;
      expect(input.type).toBe("password");
    });

    it("renders non-sensitive param inputs as type=text", () => {
      render(<TestInBrowser {...sensitiveProps} />);
      fireEvent.click(screen.getByRole("button", { name: /test in browser/i }));

      const input = screen.getByLabelText(/limit parameter value/i) as HTMLInputElement;
      expect(input.type).not.toBe("password");
    });

    it("sets autocomplete=new-password on sensitive inputs to prevent browser saves", () => {
      render(<TestInBrowser {...sensitiveProps} />);
      fireEvent.click(screen.getByRole("button", { name: /test in browser/i }));

      const input = screen.getByLabelText(/apikey parameter value/i) as HTMLInputElement;
      expect(input.getAttribute("autocomplete")).toBe("new-password");
    });

    it("shows the 🔒 indicator next to sensitive param names", () => {
      render(<TestInBrowser {...sensitiveProps} />);
      fireEvent.click(screen.getByRole("button", { name: /test in browser/i }));

      // The lock emoji should be present at least once for the sensitive params
      const lockIcons = document.querySelectorAll('[aria-label="sensitive — value will be masked"]');
      expect(lockIcons.length).toBeGreaterThanOrEqual(1);
    });

    it("includes '(sensitive — masked)' in the aria-label of masked inputs", () => {
      render(<TestInBrowser {...sensitiveProps} />);
      fireEvent.click(screen.getByRole("button", { name: /test in browser/i }));

      const input = screen.getByLabelText(/apikey parameter value \(sensitive — masked\)/i);
      expect(input).toBeTruthy();
    });

    it("non-sensitive param inputs do NOT carry the sensitive aria-label suffix", () => {
      render(<TestInBrowser {...sensitiveProps} />);
      fireEvent.click(screen.getByRole("button", { name: /test in browser/i }));

      // limit is safe; its label should not contain the masked note
      const input = screen.getByLabelText(/^limit parameter value$/i);
      expect(input).toBeTruthy();
    });
  });
});

