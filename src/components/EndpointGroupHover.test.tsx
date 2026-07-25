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

  it("renders null when groups array is empty", () => {
    const { container } = render(<EndpointGroupHover groups={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("displays method badges correctly", () => {
    render(<EndpointGroupHover groups={groups} />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: /forecast 2 endpoints/i }));
    
    const getBadge = screen.getByText("GET");
    expect(getBadge).toBeTruthy();
    expect(getBadge.className).toContain("method-badge--get");
  });

  it("limits endpoint preview to 3 items", () => {
    const largeGroup: EndpointGroupPreview = {
      id: "large",
      label: "Large Group",
      summary: "5 endpoints",
      methods: ["GET"],
      endpointCount: 5,
      totalParams: 10,
      endpoints: [
        { id: "1", title: "Endpoint 1", url: "/1", method: "GET", paramsCount: 2, requiredCount: 1 },
        { id: "2", title: "Endpoint 2", url: "/2", method: "GET", paramsCount: 2, requiredCount: 1 },
        { id: "3", title: "Endpoint 3", url: "/3", method: "GET", paramsCount: 2, requiredCount: 1 },
        { id: "4", title: "Endpoint 4", url: "/4", method: "GET", paramsCount: 2, requiredCount: 1 },
        { id: "5", title: "Endpoint 5", url: "/5", method: "GET", paramsCount: 2, requiredCount: 1 },
      ],
    };

    render(<EndpointGroupHover groups={[largeGroup]} />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: /large group 5 endpoints/i }));

    expect(screen.getByText("Endpoint 1")).toBeTruthy();
    expect(screen.getByText("Endpoint 3")).toBeTruthy();
    expect(screen.queryByText("Endpoint 4")).toBeNull();
  });

  it("handles multiple HTTP methods in badges", () => {
    const multiMethodGroup: EndpointGroupPreview = {
      id: "multi",
      label: "Multi Method",
      summary: "Multiple methods",
      methods: ["GET", "POST", "PUT", "DELETE"],
      endpointCount: 1,
      totalParams: 2,
      endpoints: [
        { id: "1", title: "Endpoint 1", url: "/1", method: "GET", paramsCount: 2, requiredCount: 1 },
      ],
    };

    render(<EndpointGroupHover groups={[multiMethodGroup]} />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: /multi method 1 endpoint/i }));

    expect(screen.getByText("GET")).toBeTruthy();
    expect(screen.getByText("POST")).toBeTruthy();
    expect(screen.getByText("PUT")).toBeTruthy();
    expect(screen.getByText("DELETE")).toBeTruthy();
  });

  it("clears preview when mouse leaves the shell", () => {
    render(<EndpointGroupHover groups={groups} />);
    
    const trigger = screen.getByRole("button", { name: /forecast 2 endpoints/i });
    fireEvent.mouseEnter(trigger);
    
    expect(screen.getByLabelText("Forecast group preview")).toBeTruthy();
    
    const shell = screen.getByRole("list", { name: "Endpoint groups" }).parentElement;
    if (shell) {
      fireEvent.mouseLeave(shell);
    }
    
    expect(screen.queryByLabelText("Forecast group preview")).toBeNull();
  });
});
