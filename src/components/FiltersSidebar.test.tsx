// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
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

  it("renders the skeleton when isLoading is true", () => {
    const { container } = render(<FiltersSidebar {...baseProps} isLoading={true} />);
    const skeleton = container.querySelector(".filters-sidebar-skeleton");
    expect(skeleton).toBeTruthy();
    // Verify that the actual categories are not rendered
    expect(screen.queryByText("Categories")).toBeNull();
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

      expect(localStorage.getItem("callora.filters.categories.collapsed")).toBe(
        "true",
      );
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
      expect(header.getAttribute("aria-controls")).toBe(
        "filter-panel-categories",
      );
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
      expect(
        chevron?.classList.contains("filter-group__chevron--collapsed"),
      ).toBe(true);
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
      render(<FiltersSidebar {...baseProps} minPrice={100} maxPrice={50} />);
      expect(
        screen.getByText(/Min price cannot exceed max price/i),
      ).toBeTruthy();
    });

    it("does not show error when prices are valid", () => {
      render(<FiltersSidebar {...baseProps} minPrice={50} maxPrice={100} />);
      expect(
        screen.queryByText(/Min price cannot exceed max price/i),
      ).toBeNull();
    });

    it("does not show error when both prices are null", () => {
      render(<FiltersSidebar {...baseProps} />);
      expect(
        screen.queryByText(/Min price cannot exceed max price/i),
      ).toBeNull();
    });
  });

  describe("mobile sheet behavior", () => {
    it("opens and closes via toggle and Escape", () => {
      render(<FiltersSidebar {...baseProps} />);

      const toggle = screen.getByRole(
        "button",
        { name: "Filters" },
        { hidden: true },
      );
      toggle.style.display = "inline-block";
      fireEvent.click(toggle);

      expect(screen.getByRole("dialog", { name: /Filters/i })).toBeTruthy();

      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByRole("dialog", { name: /Filters/i })).toBeNull();
    });

    it("calls clearFilters from within the sheet", () => {
      const clearFilters = vi.fn();
      render(<FiltersSidebar {...baseProps} clearFilters={clearFilters} />);

      const toggle = screen.getByRole(
        "button",
        { name: "Filters" },
        { hidden: true },
      );
      toggle.style.display = "inline-block";
      fireEvent.click(toggle);

      const dialog = screen.getByRole("dialog", { name: /Filters/i });
      const clearBtn = within(dialog).getByText("Clear filters");
      fireEvent.click(clearBtn);

      expect(clearFilters).toHaveBeenCalled();
    });
  });

  describe("empty-state illustration (v7)", () => {
    it("does NOT render zero-results block when resultCount is undefined", () => {
      render(
        <FiltersSidebar
          {...baseProps}
          selectedCategories={new Set(["AI/ML"])}
        />,
      );
      expect(screen.queryByTestId("filters-zero-results")).toBeNull();
    });

    it("does NOT render zero-results block when resultCount > 0 even with active filters", () => {
      render(
        <FiltersSidebar
          {...baseProps}
          selectedCategories={new Set(["AI/ML"])}
          resultCount={5}
        />,
      );
      expect(screen.queryByTestId("filters-zero-results")).toBeNull();
    });

    it("does NOT render zero-results block when resultCount is 0 but NO filters active", () => {
      render(<FiltersSidebar {...baseProps} resultCount={0} />);
      expect(screen.queryByTestId("filters-zero-results")).toBeNull();
    });

    it("renders zero-results illustration when resultCount=0 and categories selected", () => {
      render(
        <FiltersSidebar
          {...baseProps}
          selectedCategories={new Set(["Data & Analytics"])}
          resultCount={0}
        />,
      );
      const block = screen.getByTestId("filters-zero-results");
      expect(block).toBeTruthy();
      expect(block.getAttribute("role")).toBe("status");
      expect(block.getAttribute("aria-live")).toBe("polite");
      expect(
        block.querySelector('[data-testid="empty-state-filtered"]'),
      ).toBeTruthy();
    });

    it("renders zero-results illustration when resultCount=0 and minPrice set", () => {
      render(<FiltersSidebar {...baseProps} minPrice={9999} resultCount={0} />);
      expect(screen.getByTestId("filters-zero-results")).toBeTruthy();
    });

    it("renders zero-results illustration when resultCount=0 and maxPrice set", () => {
      render(<FiltersSidebar {...baseProps} maxPrice={0} resultCount={0} />);
      expect(screen.getByTestId("filters-zero-results")).toBeTruthy();
    });

    it("renders zero-results illustration when resultCount=0 and popularity !== any", () => {
      render(
        <FiltersSidebar {...baseProps} popularity="mostUsed" resultCount={0} />,
      );
      expect(screen.getByTestId("filters-zero-results")).toBeTruthy();
    });

    it("renders zero-results illustration when resultCount=0 and favoritesOnly=true", () => {
      render(
        <FiltersSidebar {...baseProps} favoritesOnly={true} resultCount={0} />,
      );
      expect(screen.getByTestId("filters-zero-results")).toBeTruthy();
    });

    it("uses compact size EmptyState inside the sidebar", () => {
      render(
        <FiltersSidebar
          {...baseProps}
          selectedCategories={new Set(["Other"])}
          resultCount={0}
        />,
      );
      const emptyState = screen.getByTestId("empty-state-filtered");
      expect(emptyState.getAttribute("data-size")).toBe("compact");
    });

    it("inline clear-filters button inside zero-results calls clearFilters callback", () => {
      const clearFilters = vi.fn();
      render(
        <FiltersSidebar
          {...baseProps}
          selectedCategories={new Set(["AI/ML"])}
          resultCount={0}
          clearFilters={clearFilters}
        />,
      );
      const btn = screen.getByTestId("empty-state-clear-filters");
      fireEvent.click(btn);
      expect(clearFilters).toHaveBeenCalledTimes(1);
    });

    it("renders zero-results illustration inside mobile sheet when applicable", () => {
      render(
        <FiltersSidebar
          {...baseProps}
          selectedCategories={new Set(["Payment Processing"])}
          resultCount={0}
        />,
      );
      const toggle = screen.getByRole(
        "button",
        { name: "Filters" },
        { hidden: true },
      );
      toggle.style.display = "inline-block";
      fireEvent.click(toggle);
      const dialog = screen.getByRole("dialog", { name: /Filters/i });
      expect(within(dialog).getByTestId("filters-zero-results")).toBeTruthy();
      expect(within(dialog).getByTestId("empty-state-filtered")).toBeTruthy();
    });
  });

  describe("empty-state illustration (v7) visual refinements", () => {
    it("zero-results wrapper uses a token-based top border for visual separation", () => {
      render(
        <FiltersSidebar
          {...baseProps}
          selectedCategories={new Set(["AI/ML"])}
          resultCount={0}
        />,
      );
      const block = screen.getByTestId("filters-zero-results") as HTMLElement;
      expect(block.style.borderTop).toMatch(/var\(--line\)/);
      expect(block.style.paddingTop).toBe("12px");
    });

    it("zero-results wrapper keeps role='status' and aria-live='polite' for assistive tech", () => {
      render(<FiltersSidebar {...baseProps} minPrice={9999} resultCount={0} />);
      const block = screen.getByTestId("filters-zero-results");
      expect(block.getAttribute("role")).toBe("status");
      expect(block.getAttribute("aria-live")).toBe("polite");
    });

    it("zero-results wrapper does NOT appear when resultCount > 0 (no false-positive separators)", () => {
      render(
        <FiltersSidebar
          {...baseProps}
          selectedCategories={new Set(["Data & Analytics"])}
          resultCount={3}
        />,
      );
      expect(screen.queryByTestId("filters-zero-results")).toBeNull();
    });

    it("nested EmptyState inside FiltersSidebar always uses size=compact (sidebar layout)", () => {
      render(
        <FiltersSidebar {...baseProps} popularity="newest" resultCount={0} />,
      );
      const emptyState = screen.getByTestId("empty-state-filtered");
      expect(emptyState.getAttribute("data-size")).toBe("compact");
    });

    it("nested EmptyState inside FiltersSidebar renders clear-filters CTA inline", () => {
      const clearFilters = vi.fn();
      render(
        <FiltersSidebar
          {...baseProps}
          selectedCategories={new Set(["Communication"])}
          resultCount={0}
          clearFilters={clearFilters}
        />,
      );
      const clearBtn = screen.getByTestId("empty-state-clear-filters");
      expect(clearBtn).toBeTruthy();
      fireEvent.click(clearBtn);
      expect(clearFilters).toHaveBeenCalledTimes(1);
    });

    it("mobile sheet also renders the token-based top-border separator on zero results", () => {
      render(
        <FiltersSidebar
          {...baseProps}
          selectedCategories={new Set(["Other"])}
          resultCount={0}
        />,
      );
      const toggle = screen.getByRole(
        "button",
        { name: "Filters" },
        { hidden: true },
      );
      toggle.style.display = "inline-block";
      fireEvent.click(toggle);
      const dialog = screen.getByRole("dialog", { name: /Filters/i });
      const block = within(dialog).getByTestId(
        "filters-zero-results",
      ) as HTMLElement;
      expect(block.style.borderTop).toMatch(/var\(--line\)/);
    });
  });
});
