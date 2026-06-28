// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import EndpointGroupHover, { type EndpointGroupPreview } from "./EndpointGroupHover";

const groups: EndpointGroupPreview[] = [
  {
    id: "forecast",
    label: "Forecast",
    summary: "2 endpoints and 3 request parameters.",
    methods: ["GET"],
    endpointCount: 2,
    totalParams: 3,
    endpoints: [
      {
        id: "forecast-current",
        title: "Current Forecast",
        url: "/v1/forecast/current",
        method: "GET",
        paramsCount: 2,
        requiredCount: 2,
      },
      {
        id: "forecast-hourly",
        title: "Hourly Forecast",
        url: "/v1/forecast/hourly",
        method: "GET",
        paramsCount: 1,
        requiredCount: 1,
      },
    ],
  },
  {
    id: "alerts",
    label: "Alerts",
    summary: "1 endpoint and 2 request parameters.",
    methods: ["POST"],
    endpointCount: 1,
    totalParams: 2,
    endpoints: [
      {
        id: "alerts-create",
        title: "Create Alert",
        url: "/v1/alerts",
        method: "POST",
        paramsCount: 2,
        requiredCount: 1,
      },
    ],
  },
];

describe("EndpointGroupHover", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows a preview when a group trigger is hovered", () => {
    render(<EndpointGroupHover groups={groups} />);

    fireEvent.mouseEnter(screen.getByRole("button", { name: /forecast 2 endpoints/i }));

    expect(screen.getByLabelText("Forecast group preview")).toBeTruthy();
    expect(screen.getByText("2 endpoints and 3 request parameters.")).toBeTruthy();
    expect(screen.getByText("Current Forecast")).toBeTruthy();
  });

  it("supports keyboard focus as the non-pointer equivalent", () => {
    render(<EndpointGroupHover groups={groups} />);

    fireEvent.focus(screen.getByRole("button", { name: /alerts 1 endpoint/i }));

    expect(screen.getByLabelText("Alerts group preview")).toBeTruthy();
    expect(screen.getByText("Create Alert")).toBeTruthy();
  });

  it("clears the preview when escape is pressed on the active trigger", () => {
    render(<EndpointGroupHover groups={groups} />);

    const trigger = screen.getByRole("button", { name: /forecast 2 endpoints/i });
    fireEvent.focus(trigger);
    fireEvent.keyDown(trigger, { key: "Escape" });

    expect(screen.queryByLabelText("Forecast group preview")).toBeNull();
    expect(
      screen.getByText(/select a group to preview endpoints/i),
    ).toBeTruthy();
  });
});
