// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import DesignSystemDocs from "./DesignSystemDocs";

describe("DesignSystemDocs", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the page heading", () => {
    render(<DesignSystemDocs />);
    expect(screen.getByRole("heading", { name: "Design System" })).toBeTruthy();
  });

  it("shows the first component expanded by default and the rest collapsed", () => {
    render(<DesignSystemDocs />);
    // First component section (Primary Button) is open by default
    expect(screen.getByText("Live example")).toBeTruthy();
    // Verify the collapse/expand toggle buttons are present
    const expandAllBtn = screen.getByRole("button", { name: "Expand all" });
    expect(expandAllBtn).toBeTruthy();
  });

  it("collapses all sections when 'Collapse all' is clicked", () => {
    render(<DesignSystemDocs />);
    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    // All component headers remain but no prop tables are shown
    expect(screen.queryAllByText("Live example")).toHaveLength(0);
  });

  it("expands all sections when 'Expand all' is clicked", () => {
    render(<DesignSystemDocs />);
    // Collapse everything first
    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    expect(screen.queryAllByText("Live example")).toHaveLength(0);
    // Then expand all
    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    // Every component section should now show a "Live example" label
    const liveExampleLabels = screen.queryAllByText("Live example");
    expect(liveExampleLabels.length).toBeGreaterThan(1);
  });
});
