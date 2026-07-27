// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import EndpointPreview, { type EndpointPreviewData } from "./EndpointPreview";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FULL_ENDPOINT: EndpointPreviewData = {
  id: "forecast",
  title: "Get Forecast",
  url: "/v1/forecast",
  method: "GET",
  params: [
    { name: "lat", type: "number", required: true },
    { name: "lon", type: "number", required: true },
    { name: "units", type: "string", required: false },
  ],
  response: '{ "temp_c": 12.3, "conditions": "rain" }',
};

const NO_PARAMS_ENDPOINT: EndpointPreviewData = {
  id: "ping",
  title: "Health Check",
  url: "/v1/ping",
  method: "GET",
  params: [],
};

const POST_ENDPOINT: EndpointPreviewData = {
  id: "alerts-create",
  title: "Create Alert",
  url: "/v1/alerts",
  method: "POST",
  params: [
    { name: "threshold", type: "number", required: true },
    { name: "channel", type: "string", required: false },
  ],
};

/** Endpoint with more params than MAX_PREVIEW_PARAMS (5) to test overflow. */
const MANY_PARAMS_ENDPOINT: EndpointPreviewData = {
  id: "search",
  title: "Search Records",
  url: "/v1/search",
  method: "GET",
  params: [
    { name: "q", type: "string", required: true },
    { name: "page", type: "number", required: false },
    { name: "limit", type: "number", required: false },
    { name: "sort", type: "string", required: false },
    { name: "filter", type: "string", required: false },
    { name: "lang", type: "string", required: false },
    { name: "region", type: "string", required: false },
  ],
};

// ── Helper ────────────────────────────────────────────────────────────────────

function renderPreview(
  endpoint: EndpointPreviewData,
  children = <div>Trigger content</div>,
) {
  return render(
    <EndpointPreview endpoint={endpoint}>{children}</EndpointPreview>,
  );
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("EndpointPreview", () => {
  afterEach(() => {
    cleanup();
  });

  // ── Initial state ─────────────────────────────────────────────────────────

  it("does not show the panel initially", () => {
    renderPreview(FULL_ENDPOINT);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("renders the trigger wrapper with an accessible aria-label", () => {
    renderPreview(FULL_ENDPOINT);
    expect(
      screen.getByRole("button", { name: /preview schema for get forecast/i }),
    ).toBeTruthy();
  });

  // ── Hover (pointer) interaction ───────────────────────────────────────────

  it("shows the panel on mouseEnter and hides it on mouseLeave", () => {
    renderPreview(FULL_ENDPOINT);

    // Use the wrapper div (endpoint-preview__wrapper) which carries the handlers.
    const wrapper = screen
      .getByRole("button", { name: /preview schema for get forecast/i })
      .closest(".endpoint-preview__wrapper") as HTMLElement;

    fireEvent.mouseEnter(wrapper);
    expect(screen.getByRole("tooltip")).toBeTruthy();

    fireEvent.mouseLeave(wrapper);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  // ── Keyboard (focus) interaction ──────────────────────────────────────────

  it("shows the panel when the trigger receives focus", () => {
    renderPreview(FULL_ENDPOINT);

    const trigger = screen.getByRole("button", {
      name: /preview schema for get forecast/i,
    });
    fireEvent.focus(trigger);

    expect(screen.getByRole("tooltip")).toBeTruthy();
  });

  it("links the trigger to the panel via aria-describedby while open", () => {
    renderPreview(FULL_ENDPOINT);

    const trigger = screen.getByRole("button", {
      name: /preview schema for get forecast/i,
    });
    fireEvent.focus(trigger);

    const panel = screen.getByRole("tooltip");
    expect(trigger.getAttribute("aria-describedby")).toBe(panel.id);
  });

  it("has no aria-describedby when the panel is closed", () => {
    renderPreview(FULL_ENDPOINT);
    const trigger = screen.getByRole("button", {
      name: /preview schema for get forecast/i,
    });
    expect(trigger.getAttribute("aria-describedby")).toBeNull();
  });

  it("closes on Escape and clears aria-describedby", () => {
    renderPreview(FULL_ENDPOINT);

    const trigger = screen.getByRole("button", {
      name: /preview schema for get forecast/i,
    });
    fireEvent.focus(trigger);
    expect(screen.getByRole("tooltip")).toBeTruthy();

    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(trigger.getAttribute("aria-describedby")).toBeNull();
  });

  // ── Panel content: method badge ───────────────────────────────────────────

  it("shows the method badge with the correct class", () => {
    renderPreview(FULL_ENDPOINT);

    const trigger = screen.getByRole("button", {
      name: /preview schema for get forecast/i,
    });
    fireEvent.focus(trigger);

    // The method badge text is visible inside the panel.
    const badges = screen.getAllByText("GET");
    // At least one badge inside the tooltip panel
    const panel = screen.getByRole("tooltip");
    expect(panel.querySelector(".method-badge--get")).toBeTruthy();
  });

  it("shows the correct method badge class for POST endpoints", () => {
    renderPreview(POST_ENDPOINT);

    const trigger = screen.getByRole("button", {
      name: /preview schema for create alert/i,
    });
    fireEvent.focus(trigger);

    const panel = screen.getByRole("tooltip");
    expect(panel.querySelector(".method-badge--post")).toBeTruthy();
  });

  // ── Panel content: endpoint title and URL ─────────────────────────────────

  it("displays the endpoint title in the panel", () => {
    renderPreview(FULL_ENDPOINT);

    fireEvent.focus(
      screen.getByRole("button", { name: /preview schema for get forecast/i }),
    );

    const panel = screen.getByRole("tooltip");
    expect(panel).toHaveTextContent("Get Forecast");
  });

  it("displays the endpoint URL in the panel", () => {
    renderPreview(FULL_ENDPOINT);

    fireEvent.focus(
      screen.getByRole("button", { name: /preview schema for get forecast/i }),
    );

    const panel = screen.getByRole("tooltip");
    expect(panel).toHaveTextContent("/v1/forecast");
  });

  // ── Panel content: parameters ─────────────────────────────────────────────

  it("renders the parameters table when params are present", () => {
    renderPreview(FULL_ENDPOINT);

    fireEvent.focus(
      screen.getByRole("button", { name: /preview schema for get forecast/i }),
    );

    expect(screen.getByText("lat")).toBeTruthy();
    expect(screen.getByText("lon")).toBeTruthy();
    expect(screen.getByText("units")).toBeTruthy();
  });

  it("marks required parameters correctly", () => {
    renderPreview(FULL_ENDPOINT);

    fireEvent.focus(
      screen.getByRole("button", { name: /preview schema for get forecast/i }),
    );

    // lat and lon are required; units is not
    const requiredCells = screen.getAllByText("Yes");
    expect(requiredCells).toHaveLength(2);

    const optionalCells = screen.getAllByText("No");
    expect(optionalCells).toHaveLength(1);
  });

  it("shows type tags for each parameter", () => {
    renderPreview(FULL_ENDPOINT);

    fireEvent.focus(
      screen.getByRole("button", { name: /preview schema for get forecast/i }),
    );

    const panel = screen.getByRole("tooltip");
    expect(panel).toHaveTextContent("number");
    expect(panel).toHaveTextContent("string");
  });

  it("shows 'No parameters' message when the endpoint has no params", () => {
    renderPreview(NO_PARAMS_ENDPOINT);

    fireEvent.focus(
      screen.getByRole("button", { name: /preview schema for health check/i }),
    );

    expect(screen.getByText("No parameters.")).toBeTruthy();
  });

  it("caps the visible parameter rows at 5 and shows an overflow notice", () => {
    renderPreview(MANY_PARAMS_ENDPOINT);

    fireEvent.focus(
      screen.getByRole("button", { name: /preview schema for search records/i }),
    );

    // First 5 params are visible; 6th and 7th are hidden
    expect(screen.getByText("q")).toBeTruthy();
    expect(screen.getByText("page")).toBeTruthy();
    expect(screen.getByText("limit")).toBeTruthy();
    expect(screen.getByText("sort")).toBeTruthy();
    expect(screen.getByText("filter")).toBeTruthy();
    // "lang" and "region" should NOT appear
    expect(screen.queryByText("lang")).toBeNull();
    expect(screen.queryByText("region")).toBeNull();

    // Overflow notice mentions 2 hidden params
    expect(screen.getByText(/\+2 more parameters — see full docs/i)).toBeTruthy();
  });

  // ── Panel content: response snippet ──────────────────────────────────────

  it("shows the response shape snippet when provided", () => {
    renderPreview(FULL_ENDPOINT);

    fireEvent.focus(
      screen.getByRole("button", { name: /preview schema for get forecast/i }),
    );

    expect(
      screen.getByText(/temp_c.*conditions/s),
    ).toBeTruthy();
  });

  it("does not render a response section when response is absent", () => {
    renderPreview(POST_ENDPOINT);

    fireEvent.focus(
      screen.getByRole("button", { name: /preview schema for create alert/i }),
    );

    expect(screen.queryByText("Response shape")).toBeNull();
  });

  // ── Accessibility ─────────────────────────────────────────────────────────

  it("gives the panel an accessible aria-label that includes the endpoint title", () => {
    renderPreview(FULL_ENDPOINT);

    fireEvent.focus(
      screen.getByRole("button", { name: /preview schema for get forecast/i }),
    );

    const panel = screen.getByRole("tooltip");
    expect(panel.getAttribute("aria-label")).toMatch(/get forecast schema preview/i);
  });

  it("renders children inside the trigger zone", () => {
    renderPreview(
      FULL_ENDPOINT,
      <span data-testid="inner-child">Header content</span>,
    );

    expect(screen.getByTestId("inner-child")).toBeTruthy();
  });
});
