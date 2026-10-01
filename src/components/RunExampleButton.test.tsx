// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RunExampleButton, type RunExampleConfig } from "./RunExampleButton";

/** Minimal Response-like object for the stubbed fetch. */
function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  };
}

/** A Response whose .json() rejects — exercises the `{ status }` fallback. */
function nonJsonResponse(status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      throw new Error("Unexpected token < in JSON");
    },
  };
}

function getResponseRegion() {
  return screen.getByRole("region", { name: "Example response" });
}

describe("RunExampleButton", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function setup() {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("renders the idle label before any run", () => {
    setup();
    render(<RunExampleButton config={{ endpoint: "/api/ping", method: "GET" }} />);
    const button = screen.getByRole("button", { name: "Run example" });
    expect(button).toBeTruthy();
    expect(button.getAttribute("aria-busy")).toBe("false");
  });

  it("shows 'Running…' and aria-busy while the request is pending", async () => {
    const mock = setup();
    let resolveFetch!: (value: unknown) => void;
    mock.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const config: RunExampleConfig = { endpoint: "/api/ping", method: "GET" };
    render(<RunExampleButton config={config} />);

    fireEvent.click(screen.getByRole("button", { name: "Run example" }));

    const pending = screen.getByRole("button", { name: "Running…" });
    expect(pending.getAttribute("aria-busy")).toBe("true");
    expect((pending as HTMLButtonElement).disabled).toBe(true);

    resolveFetch(jsonResponse({ ok: true }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Run again" })).toBeTruthy(),
    );
    expect(screen.getByRole("button").getAttribute("aria-busy")).toBe("false");
  });

  it("sends GET requests without a body", async () => {
    const mock = setup();
    mock.mockResolvedValue(jsonResponse({ ok: true }));

    render(<RunExampleButton config={{ endpoint: "/api/items", method: "GET" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Run example" }));

    await waitFor(() => expect(mock).toHaveBeenCalledTimes(1));
    const [url, options] = mock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/items");
    expect(options.method).toBe("GET");
    expect(options.body).toBeUndefined();
  });

  it("sends POST requests with the JSON example body and forwards parsed data to onResult", async () => {
    const mock = setup();
    mock.mockResolvedValue(jsonResponse({ id: 7, status: "created" }, 201));
    const onResult = vi.fn();

    const config: RunExampleConfig = {
      endpoint: "/api/items",
      method: "POST",
      exampleBody: { name: "widget" },
    };
    render(<RunExampleButton config={config} onResult={onResult} />);
    fireEvent.click(screen.getByRole("button", { name: "Run example" }));

    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(1));

    const [, options] = mock.mock.calls[0] as [string, RequestInit];
    expect(options.method).toBe("POST");
    expect(options.body).toBe(JSON.stringify({ name: "widget" }));
    expect(onResult).toHaveBeenCalledWith({ id: 7, status: "created" });
  });

  it("falls back to { status } when the response is not JSON", async () => {
    const mock = setup();
    mock.mockResolvedValue(nonJsonResponse(502));

    render(<RunExampleButton config={{ endpoint: "/api/broken", method: "GET" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Run example" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Run again" })).toBeTruthy());
    expect(getResponseRegion().textContent).toContain('"status": 502');
  });

  it("renders the error message when the request rejects", async () => {
    const mock = setup();
    mock.mockRejectedValue(new Error("Failed to fetch"));

    render(<RunExampleButton config={{ endpoint: "/api/offline", method: "GET" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Run example" }));

    await waitFor(() =>
      expect(getResponseRegion().textContent).toContain("Failed to fetch"),
    );
    // Error state returns the button to its idle label so it can be retried.
    expect(screen.getByRole("button", { name: "Run example" })).toBeTruthy();
  });
});
