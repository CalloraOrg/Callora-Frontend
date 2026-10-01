import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CategoryPills from "./CategoryPills";

afterEach(cleanup);

const categories = ["Weather", "Finance", "Geo"] as const;

function renderPills(
  selected: Set<string> = new Set(),
  overrides: Partial<{
    categories: readonly string[];
    toggleCategory: (category: string) => void;
    clearCategories: () => void;
  }> = {}
) {
  const toggleCategory = overrides.toggleCategory ?? vi.fn();
  const clearCategories = overrides.clearCategories ?? vi.fn();
  const utils = render(
    <CategoryPills
      categories={overrides.categories ?? categories}
      selectedCategories={selected}
      toggleCategory={toggleCategory}
      clearCategories={clearCategories}
    />
  );
  return { ...utils, toggleCategory, clearCategories };
}

describe("CategoryPills", () => {
  it("exposes the group with role=group and the Filter by category label", () => {
    renderPills();

    const group = screen.getByRole("group", { name: "Filter by category" });
    expect(group).toBeTruthy();
    expect(group.getAttribute("aria-label")).toBe("Filter by category");
  });

  it("renders All plus one pill per category", () => {
    renderPills();

    const group = screen.getByRole("group", { name: "Filter by category" });
    const buttons = within(group).getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["All", ...categories]);
  });

  it("marks All as pressed and no category pressed when the selection is empty", () => {
    renderPills(new Set());

    const group = screen.getByRole("group", { name: "Filter by category" });
    expect(within(group).getByRole("button", { name: "All" }).getAttribute("aria-pressed")).toBe("true");
    for (const c of categories) {
      expect(within(group).getByRole("button", { name: c }).getAttribute("aria-pressed")).toBe("false");
    }
  });

  it("marks the selected category as pressed and All as not pressed", () => {
    renderPills(new Set(["Finance"]));

    const group = screen.getByRole("group", { name: "Filter by category" });
    expect(within(group).getByRole("button", { name: "Finance" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(group).getByRole("button", { name: "All" }).getAttribute("aria-pressed")).toBe("false");
    expect(within(group).getByRole("button", { name: "Weather" }).getAttribute("aria-pressed")).toBe("false");
    expect(within(group).getByRole("button", { name: "Geo" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("calls toggleCategory with the pill's name when a category pill is clicked", () => {
    const { toggleCategory } = renderPills(new Set());

    fireEvent.click(screen.getByRole("button", { name: "Weather" }));

    expect(toggleCategory).toHaveBeenCalledTimes(1);
    expect(toggleCategory).toHaveBeenCalledWith("Weather");
  });

  it("calls clearCategories and not toggleCategory when All is clicked", () => {
    const { toggleCategory, clearCategories } = renderPills(new Set(["Weather"]));

    fireEvent.click(screen.getByRole("button", { name: "All" }));

    expect(clearCategories).toHaveBeenCalledTimes(1);
    expect(toggleCategory).not.toHaveBeenCalled();
  });

  it("reflects aria-pressed from props and does not leak state between pills on rerender", () => {
    const { rerender, toggleCategory, clearCategories } = render(
      <CategoryPills
        categories={categories}
        selectedCategories={new Set(["Weather"])}
        toggleCategory={vi.fn()}
        clearCategories={vi.fn()}
      />
    );

    const group = screen.getByRole("group", { name: "Filter by category" });
    expect(within(group).getByRole("button", { name: "Weather" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(group).getByRole("button", { name: "Geo" }).getAttribute("aria-pressed")).toBe("false");

    rerender(
      <CategoryPills
        categories={categories}
        selectedCategories={new Set(["Geo"])}
        toggleCategory={toggleCategory}
        clearCategories={clearCategories}
      />
    );

    expect(within(group).getByRole("button", { name: "Weather" }).getAttribute("aria-pressed")).toBe("false");
    expect(within(group).getByRole("button", { name: "Geo" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(group).getByRole("button", { name: "All" }).getAttribute("aria-pressed")).toBe("false");
  });
});
