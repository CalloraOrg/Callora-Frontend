// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RecentlyActiveRail from "./RecentlyActiveRail";
import type { APIItem } from "../data/mockApis";

function makeApi(over: Partial<APIItem>): APIItem {
  return {
    id: "x",
    name: "Sample API",
    provider: { name: "Acme" },
    description: "desc",
    pricePerRequest: 0.01,
    ...over,
  };
}

const apis: APIItem[] = [
  makeApi({ id: "a", name: "Alpha", createdAt: "2026-06-28", usageCount: 10 }),
  makeApi({ id: "b", name: "Bravo", createdAt: "2026-01-01", usageCount: 99 }),
  makeApi({ id: "c", name: "Charlie", createdAt: "2026-06-29", usageCount: 1 }),
];

describe("RecentlyActiveRail", () => {
  afterEach(() => cleanup());

  it("renders a labelled region with a heading", () => {
    render(<RecentlyActiveRail apis={apis} />);
    expect(
      screen.getByRole("region", { name: /recently active apis/i }),
    ).toBeTruthy();
    expect(screen.getByText("Recently active")).toBeTruthy();
  });

  it("orders items by most recent first", () => {
    render(<RecentlyActiveRail apis={apis} />);
    const buttons = screen.getAllByRole("button");
    // Charlie (06-29) before Alpha (06-28) before Bravo (01-01)
    expect(buttons[0].textContent).toContain("Charlie");
    expect(buttons[1].textContent).toContain("Alpha");
    expect(buttons[2].textContent).toContain("Bravo");
  });

  it("respects the limit prop", () => {
    render(<RecentlyActiveRail apis={apis} limit={2} />);
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("renders nothing when there are no APIs", () => {
    const { container } = render(<RecentlyActiveRail apis={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("invokes onSelect with the chosen API", () => {
    const onSelect = vi.fn();
    render(<RecentlyActiveRail apis={apis} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /charlie/i }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0].id).toBe("c");
  });
});
