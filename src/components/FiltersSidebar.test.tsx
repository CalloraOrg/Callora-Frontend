// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FiltersSidebar, {
  ALL_CATEGORIES,
  STATUS_OPTIONS,
} from "./FiltersSidebar";

type FiltersSidebarProps = Parameters<typeof FiltersSidebar>[0];

function mockMatchMedia(reducedMotion = false) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches:
        reducedMotion && query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function createProps(
  overrides: Partial<FiltersSidebarProps> = {},
): FiltersSidebarProps {
  return {
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
    selectedStatuses: new Set<string>(),
    toggleStatus: vi.fn(),
    ...overrides,
  };
}

function renderSidebar(overrides: Partial<FiltersSidebarProps> = {}) {
  const props = createProps(overrides);
  const utils = render(<FiltersSidebar {...props} />);
  return { ...utils, props };
}

describe("FiltersSidebar", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockMatchMedia(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  describe("category checkboxes", () => {
    it("renders one checkbox per ALL_CATEGORIES entry with expected id", () => {
      renderSidebar();

      for (const category of ALL_CATEGORIES) {
        const expectedId = `category-${category.replace(/\s+/g, "-").toLowerCase()}`;
        const checkbox = screen.getByLabelText(category) as HTMLInputElement;
        expect(checkbox.type).toBe("checkbox");
        expect(checkbox.id).toBe(expectedId);
        expect(checkbox.checked).toBe(false);
      }
    });

    it("reflects selectedCategories in checkbox checked state", () => {
      renderSidebar({
        selectedCategories: new Set(["Finance", "Security"]),
      });

      expect((screen.getByLabelText("Finance") as HTMLInputElement).checked).toBe(true);
      expect((screen.getByLabelText("Security") as HTMLInputElement).checked).toBe(true);
      expect((screen.getByLabelText("Utilities") as HTMLInputElement).checked).toBe(false);
    });

    it("calls toggleCategory with the category label when clicked", async () => {
      const user = userEvent.setup();
      const { props } = renderSidebar();

      await user.click(screen.getByLabelText("AI & ML"));

      expect(props.toggleCategory).toHaveBeenCalledTimes(1);
      expect(props.toggleCategory).toHaveBeenCalledWith("AI & ML");
    });
  });

  describe("price range", () => {
    it("calls setMinPrice and setMaxPrice with numbers when typing", async () => {
      const user = userEvent.setup();
      const { props } = renderSidebar();

      const minInput = screen.getByLabelText("Minimum price");
      const maxInput = screen.getByLabelText("Maximum price");

      await user.type(minInput, "5");
      await user.type(maxInput, "9");

      expect(props.setMinPrice).toHaveBeenCalledWith(5);
      expect(props.setMaxPrice).toHaveBeenCalledWith(9);
    });

    it("calls setters with null when clearing a price field to empty string", async () => {
      const user = userEvent.setup();
      const { props } = renderSidebar({ minPrice: 10, maxPrice: 50 });

      await user.clear(screen.getByLabelText("Minimum price"));
      await user.clear(screen.getByLabelText("Maximum price"));

      expect(props.setMinPrice).toHaveBeenCalledWith(null);
      expect(props.setMaxPrice).toHaveBeenCalledWith(null);
    });

    it("ignores non-numeric input in number fields and enforces min=0", async () => {
      const user = userEvent.setup();
      const { props } = renderSidebar();

      const minInput = screen.getByLabelText("Minimum price") as HTMLInputElement;
      const maxInput = screen.getByLabelText("Maximum price") as HTMLInputElement;

      expect(minInput.min).toBe("0");
      expect(maxInput.min).toBe("0");

      await user.type(minInput, "abc");
      await user.type(maxInput, "xyz");

      expect(props.setMinPrice).not.toHaveBeenCalled();
      expect(props.setMaxPrice).not.toHaveBeenCalled();
    });

    it("treats equal min and max price as valid without error", () => {
      renderSidebar({ minPrice: 25, maxPrice: 25 });

      expect(screen.queryByTestId("filters-price-error")).toBeNull();
      expect(screen.queryByTestId("filters-price-swap")).toBeNull();
      expect(
        screen.getByLabelText("Minimum price").getAttribute("aria-invalid"),
      ).toBe("false");
      expect(
        screen.getByLabelText("Maximum price").getAttribute("aria-invalid"),
      ).toBe("false");
    });

    it("shows inline warning and swaps values when minPrice > maxPrice", async () => {
      const user = userEvent.setup();
      const { props } = renderSidebar({ minPrice: 100, maxPrice: 20 });

      const errorEl = screen.getByTestId("filters-price-error");
      expect(errorEl.getAttribute("role")).toBe("alert");
      expect(errorEl.textContent).toContain("Min price cannot exceed max price");

      expect(
        screen.getByLabelText("Minimum price").getAttribute("aria-invalid"),
      ).toBe("true");
      expect(
        screen.getByLabelText("Maximum price").getAttribute("aria-invalid"),
      ).toBe("true");

      await user.click(screen.getByTestId("filters-price-swap"));

      expect(props.setMinPrice).toHaveBeenCalledWith(20);
      expect(props.setMaxPrice).toHaveBeenCalledWith(100);
    });
  });

  describe("collapse persistence", () => {
    it("toggles aria-expanded, hides the panel, writes to localStorage, and restores on remount", async () => {
      const user = userEvent.setup();
      const { unmount } = renderSidebar();

      const header = screen.getByRole("button", { name: "Categories" });
      const panel = screen.getByTestId("filter-panel-categories");

      expect(header.getAttribute("aria-expanded")).toBe("true");
      expect(header.getAttribute("aria-controls")).toBe("filter-panel-categories");
      expect(panel.hidden).toBe(false);

      await user.click(header);

      expect(header.getAttribute("aria-expanded")).toBe("false");
      expect(panel.hidden).toBe(true);
      expect(localStorage.getItem("callora.filters.categories.collapsed")).toBe(
        "true",
      );

      unmount();

      renderSidebar();

      const restoredHeader = screen.getByRole("button", { name: "Categories" });
      const restoredPanel = screen.getByTestId("filter-panel-categories");

      expect(restoredHeader.getAttribute("aria-expanded")).toBe("false");
      expect(restoredPanel.hidden).toBe(true);
    });

    it("disables transition on collapsed group header when prefers-reduced-motion is enabled", async () => {
      mockMatchMedia(true);
      const user = userEvent.setup();
      renderSidebar();

      const priceHeader = screen.getByRole("button", { name: "Price range" });
      expect(priceHeader.style.transition).toBe("none");

      await user.click(priceHeader);

      expect(priceHeader.getAttribute("aria-expanded")).toBe("false");
      expect(screen.getByTestId("filter-panel-price").hidden).toBe(true);
      expect(priceHeader.style.transition).toBe("none");
    });
  });

  describe("clear-all and zero-results state", () => {
    it("calls clearFilters when clicking Clear filters", async () => {
      const user = userEvent.setup();
      const { props } = renderSidebar({
        selectedCategories: new Set(["Finance"]),
      });

      await user.click(screen.getByRole("button", { name: "Clear filters" }));

      expect(props.clearFilters).toHaveBeenCalledTimes(1);
    });

    it("renders EmptyState with clear action only when hasActiveFilters is true and resultCount is 0", async () => {
      const user = userEvent.setup();
      const { rerender, props } = renderSidebar({ resultCount: 0 });

      const zeroResults = screen.getByTestId("filters-zero-results");
      expect(zeroResults).toBeTruthy();
      expect(
        within(zeroResults).queryByTestId("empty-state-clear-filters"),
      ).toBeNull();

      const activeProps = createProps({
        resultCount: 0,
        selectedCategories: new Set(["Finance"]),
        clearFilters: props.clearFilters,
      });
      rerender(<FiltersSidebar {...activeProps} />);

      const clearBtnInEmptyState = within(
        screen.getByTestId("filters-zero-results"),
      ).getByTestId("empty-state-clear-filters");

      await user.click(clearBtnInEmptyState);
      expect(props.clearFilters).toHaveBeenCalledTimes(1);
    });
  });

  describe("live region announcements", () => {
    it("updates announcement text when category selection changes", () => {
      const { rerender, props } = renderSidebar();
      const region = document.getElementById("filters-sidebar-announcements");
      expect(region).not.toBeNull();

      rerender(
        <FiltersSidebar
          {...props}
          selectedCategories={new Set(["Finance"])}
        />,
      );
      expect(region!.textContent).toContain('Category "Finance" selected.');

      rerender(
        <FiltersSidebar {...props} selectedCategories={new Set()} />,
      );
      expect(region!.textContent).toContain('Category "Finance" deselected.');
    });

    it("announces swapped price range and clears the announcement after 3s", () => {
      vi.useFakeTimers();
      renderSidebar({ minPrice: 100, maxPrice: 20 });

      const region = document.getElementById("filters-sidebar-announcements");
      expect(region).not.toBeNull();

      fireEvent.click(screen.getByTestId("filters-price-swap"));
      expect(region!.textContent).toContain(
        "Price range swapped. Min price $20, max price $100.",
      );

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(region!.textContent).toBe("");
    });
  });

  describe("other filter controls and mobile sheet", () => {
    it("toggles favorites only and status checkboxes", async () => {
      const user = userEvent.setup();
      const { props } = renderSidebar({
        favoritesOnly: true,
        selectedStatuses: new Set(["operational"]),
      });

      const favCheckbox = screen.getByLabelText(
        "Favorites only",
      ) as HTMLInputElement;
      expect(favCheckbox.checked).toBe(true);
      await user.click(favCheckbox);
      expect(props.toggleFavoritesOnly).toHaveBeenCalledTimes(1);

      for (const opt of STATUS_OPTIONS) {
        const statusCheckbox = screen.getByLabelText(
          opt.label,
        ) as HTMLInputElement;
        expect(statusCheckbox.checked).toBe(opt.value === "operational");
      }

      await user.click(screen.getByLabelText("Degraded"));
      expect(props.toggleStatus).toHaveBeenCalledWith("degraded");
    });

    it("opens and closes the mobile filters sheet via toggle, Escape, and Close button", async () => {
      const user = userEvent.setup();
      renderSidebar();

      const toggleBtn = screen.getByRole("button", { name: /^Filters$/i });
      expect(toggleBtn.getAttribute("aria-expanded")).toBe("false");

      await user.click(toggleBtn);
      expect(screen.getByRole("dialog", { name: "Filters" })).toBeTruthy();

      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByRole("dialog")).toBeNull();

      await user.click(toggleBtn);
      await user.click(screen.getByRole("button", { name: "Close filters" }));
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });
});
