// @vitest-environment jsdom

import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import React from "react";
import CompareTray from "./CompareTray";
import { compareStore } from "../state/compareStore";
import type { APIItem } from "../data/mockApis";

describe("CompareTray", () => {
  beforeEach(() => {
    compareStore.clear();
  });

  afterEach(() => {
    compareStore.clear();
    cleanup();
  });

  it("renders nothing with zero APIs", () => {
    const { container } = render(<CompareTray />);
    expect(container.firstChild).toBeNull();
  });

  it("shows 'Compare (2)' with two APIs and lists names", () => {
    compareStore.addApi({ id: "api-1", name: "Weather API", endpoints: [] } as unknown as APIItem);
    compareStore.addApi({ id: "api-2", name: "Payment API", endpoints: [] } as unknown as APIItem);

    render(<CompareTray />);

    expect(screen.getByText("Weather API")).toBeInTheDocument();
    expect(screen.getByText("Payment API")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Compare (2)" })).toBeInTheDocument();
  });

  it("remove button removes that API only", () => {
    compareStore.addApi({ id: "api-1", name: "Weather API", endpoints: [] } as unknown as APIItem);
    compareStore.addApi({ id: "api-2", name: "Payment API", endpoints: [] } as unknown as APIItem);

    render(<CompareTray />);

    expect(screen.getByText("Weather API")).toBeInTheDocument();
    expect(screen.getByText("Payment API")).toBeInTheDocument();

    const removeBtn = screen.getByLabelText("Remove Weather API from comparison");
    fireEvent.click(removeBtn);

    expect(screen.queryByText("Weather API")).not.toBeInTheDocument();
    expect(screen.getByText("Payment API")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Compare (1)" })).toBeInTheDocument();
  });

  it("Compare button opens the drawer via the store", () => {
    compareStore.addApi({ id: "api-1", name: "Weather API", endpoints: [] } as unknown as APIItem);
    compareStore.addApi({ id: "api-2", name: "Payment API", endpoints: [] } as unknown as APIItem);

    render(<CompareTray />);

    expect(compareStore.getSnapshot().isOpen).toBe(false);

    const compareBtn = screen.getByRole("button", { name: "Compare (2)" });
    fireEvent.click(compareBtn);

    expect(compareStore.getSnapshot().isOpen).toBe(true);
  });
});
