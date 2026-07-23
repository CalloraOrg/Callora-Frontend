// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FiltersSidebar from "./FiltersSidebar";

const baseProps = {
  selectedCategories: new Set<string>(),
  toggleCategory: vi.fn(),
  minPrice: null,
  maxPrice: null,
  setMinPrice: vi.fn(),
  setMaxPrice: vi.fn(),
  popularity: "any",
  setPopularity: vi.fn(),
  clearFilters: vi.fn(),
  favoritesOnly: false,
  toggleFavoritesOnly: vi.fn(),
};

describe("FiltersSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("renders all filter sections", () => {
    render(<FiltersSidebar {...baseProps} />);
    expect(screen.getByText("Categories")).toBeTruthy();
    expect(screen.getByText("Price range")).toBeTruthy();
    expect(screen.getByText("Popularity")).toBeTruthy();
  });

  it("renders category checkboxes", () => {
    render(<FiltersSidebar {...baseProps} />);
    expect(screen.getByLabelText("Data & Analytics")).toBeTruthy();
    expect(screen.getByLabelText("Payment Processing")).toBeTruthy();
    expect(screen.getByLabelText("Communication")).toBeTruthy();
    expect(screen.getByLabelText("AI/ML")).toBeTruthy();
    expect(screen.getByLabelText("Other")).toBeTruthy();
  });

  it("calls toggleCategory when checkbox is clicked", () => {
    const toggleCategory = vi.fn();
    render(<FiltersSidebar {...baseProps} toggleCategory={toggleCategory} />);
    fireEvent.click(screen.getByLabelText("Data & Analytics"));
    expect(toggleCategory).toHaveBeenCalledWith("Data & Analytics");
  });

  describe("collapse functionality", () => {
    it("expands panel by default when no persisted state", () => {
      render(<FiltersSidebar {...baseProps} />);
      const categoriesPanel = screen.getByTestId("filter-panel-categories");
      expect(categoriesPanel.hasAttribute("hidden")).toBe(false);
    });

    it("persists collapsed state on toggle", () => {
      const { unmount } = render(<FiltersSidebar {...baseProps} />);
      
      const header = screen.getByRole("button", { name: "Categories" });
      fireEvent.click(header);
      
      expect(localStorage.getItem("callora.filters.categories.collapsed")).toBe("true");
      unmount();
    });

    it("restores collapsed state from localStorage on re-render", () => {
      localStorage.setItem("callora.filters.categories.collapsed", "true");
      
      render(<FiltersSidebar {...baseProps} />);
      const categoriesPanel = screen.getByTestId("filter-panel-categories");
      expect(categoriesPanel.hasAttribute("hidden")).toBe(true);
    });

    it("restores expanded state from localStorage when set to false", () => {
      localStorage.setItem("callora.filters.popularity.collapsed", "false");
      
      render(<FiltersSidebar {...baseProps} />);
      const popularityPanel = screen.getByTestId("filter-panel-popularity");
      expect(popularityPanel.hasAttribute("hidden")).toBe(false);
    });

    it("sets aria-expanded to true when panel is expanded", () => {
      render(<FiltersSidebar {...baseProps} />);
      const header = screen.getByRole("button", { name: "Categories" });
      expect(header.getAttribute("aria-expanded")).toBe("true");
    });

    it("sets aria-expanded to false when panel is collapsed", () => {
      localStorage.setItem("callora.filters.categories.collapsed", "true");
      
      render(<FiltersSidebar {...baseProps} />);
      const header = screen.getByRole("button", { name: "Categories" });
      expect(header.getAttribute("aria-expanded")).toBe("false");
    });

    it("has correct aria-controls attribute on header", () => {
      render(<FiltersSidebar {...baseProps} />);
      const header = screen.getByRole("button", { name: "Categories" });
      expect(header.getAttribute("aria-controls")).toBe("filter-panel-categories");
    });

    it("collapses all sections independently", () => {
      render(<FiltersSidebar {...baseProps} />);
      
      const priceHeader = screen.getByRole("button", { name: "Price range" });
      fireEvent.click(priceHeader);
      
      const categoriesPanel = screen.getByTestId("filter-panel-categories");
      const pricePanel = screen.getByTestId("filter-panel-price");
      const popularityPanel = screen.getByTestId("filter-panel-popularity");
      
      expect(categoriesPanel.hasAttribute("hidden")).toBe(false);
      expect(pricePanel.hasAttribute("hidden")).toBe(true);
      expect(popularityPanel.hasAttribute("hidden")).toBe(false);
    });

    it("rotates chevron when collapsed", () => {
      localStorage.setItem("callora.filters.categories.collapsed", "true");
      
      render(<FiltersSidebar {...baseProps} />);
      const header = screen.getByRole("button", { name: "Categories" });
      const chevron = header.querySelector(".filter-group__chevron");
      expect(chevron?.classList.contains("filter-group__chevron--collapsed")).toBe(true);
    });
  });

  describe("clear filters", () => {
    it("calls clearFilters when Clear filters button is clicked", () => {
      const clearFilters = vi.fn();
      render(<FiltersSidebar {...baseProps} clearFilters={clearFilters} />);
      fireEvent.click(screen.getByText("Clear filters"));
      expect(clearFilters).toHaveBeenCalledTimes(1);
    });
  });

  describe("price validation", () => {
    it("shows error when min price exceeds max price", () => {
      render(
        <FiltersSidebar
          {...baseProps}
          minPrice={100}
          maxPrice={50}
        />
      );
      expect(screen.getByText(/Min price cannot exceed max price/i)).toBeTruthy();
    });

    it("does not show error when prices are valid", () => {
      render(
        <FiltersSidebar
          {...baseProps}
          minPrice={50}
          maxPrice={100}
        />
      );
      expect(screen.queryByText(/Min price cannot exceed max price/i)).toBeNull();
    });

    it("does not show error when both prices are null", () => {
      render(<FiltersSidebar {...baseProps} />);
      expect(screen.queryByText(/Min price cannot exceed max price/i)).toBeNull();
    });
  });
});