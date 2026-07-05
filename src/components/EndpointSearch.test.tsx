// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EndpointSearch from "./EndpointSearch";

describe("EndpointSearch", () => {
  it("renders an accessible combobox tied to the endpoint results", () => {
    render(
      <EndpointSearch
        value=""
        onChange={vi.fn()}
        resultCount={2}
        totalCount={2}
        resultsId="endpoint-results"
      />,
    );

    const input = screen.getByRole("combobox", { name: "Search endpoints" });
    expect(input.getAttribute("aria-controls")).toBe("endpoint-results");
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("status").textContent).toBe("2 endpoints available");
  });

  it("reports filtered result counts and clears the query", () => {
    const onChange = vi.fn();
    render(
      <EndpointSearch
        value="forecast"
        onChange={onChange}
        resultCount={1}
        totalCount={2}
        resultsId="endpoint-results"
      />,
    );

    expect(screen.getByRole("status").textContent).toBe("Showing 1 of 2 endpoints");
    fireEvent.click(screen.getByRole("button", { name: "Clear endpoint search" }));
    expect(onChange).toHaveBeenCalledWith("");
  });
});
