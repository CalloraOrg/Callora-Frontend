import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import React, { createRef, useState } from "react";
import ActiveFilterChips, { type ActiveFilterChipsProps } from "./ActiveFilterChips";

function defaultProps(overrides: Partial<ActiveFilterChipsProps> = {}): ActiveFilterChipsProps {
  return {
    categories: new Set(),
    statuses: new Set(),
    tag: null,
    minPrice: null,
    maxPrice: null,
    popularity: "any",
    favoritesOnly: false,
    onRemoveCategory: vi.fn(),
    onRemoveStatus: vi.fn(),
    onRemoveTag: vi.fn(),
    onRemoveMinPrice: vi.fn(),
    onRemoveMaxPrice: vi.fn(),
    onRemovePopularity: vi.fn(),
    onRemoveFavoritesOnly: vi.fn(),
    onClearAll: vi.fn(),
    ...overrides,
  };
}

describe("ActiveFilterChips", () => {
  it("renders nothing (no container) when no filters are active", () => {
    const { container } = render(<ActiveFilterChips {...defaultProps()} />);
    expect(container.firstChild).toBeNull();
  });

  describe("Category chips", () => {
    it("renders each category with accessible remove name and calls onRemoveCategory", async () => {
      const onRemoveCategory = vi.fn();
      render(
        <ActiveFilterChips
          {...defaultProps({
            categories: new Set(["Finance", "AI & ML"]),
            onRemoveCategory,
          })}
        />,
      );

      expect(screen.getByText("Category: Finance")).toBeInTheDocument();
      expect(screen.getByText("Category: AI & ML")).toBeInTheDocument();

      const removeFinanceBtn = screen.getByRole("button", {
        name: "Remove filter: Category Finance",
      });
      expect(removeFinanceBtn).toBeInTheDocument();

      await userEvent.click(removeFinanceBtn);
      expect(onRemoveCategory).toHaveBeenCalledWith("Finance");
    });

    it("renders and allows removing a category chip for a value no longer in the catalogue", async () => {
      const onRemoveCategory = vi.fn();
      render(
        <ActiveFilterChips
          {...defaultProps({
            categories: new Set(["LegacyCategoryNotInCatalog"]),
            onRemoveCategory,
          })}
        />,
      );

      expect(screen.getByText("Category: LegacyCategoryNotInCatalog")).toBeInTheDocument();
      const removeBtn = screen.getByRole("button", {
        name: "Remove filter: Category LegacyCategoryNotInCatalog",
      });
      await userEvent.click(removeBtn);
      expect(onRemoveCategory).toHaveBeenCalledWith("LegacyCategoryNotInCatalog");
    });
  });

  describe("Status chips", () => {
    it("renders status chips with accessible remove name and calls onRemoveStatus", async () => {
      const onRemoveStatus = vi.fn();
      render(
        <ActiveFilterChips
          {...defaultProps({
            statuses: new Set(["operational", "degraded"]),
            onRemoveStatus,
          })}
        />,
      );

      expect(screen.getByText("Status: Operational")).toBeInTheDocument();
      expect(screen.getByText("Status: Degraded")).toBeInTheDocument();

      const removeOperationalBtn = screen.getByRole("button", {
        name: "Remove filter: Status Operational",
      });
      await userEvent.click(removeOperationalBtn);
      expect(onRemoveStatus).toHaveBeenCalledWith("operational");
    });
  });

  describe("Tag chip", () => {
    it("renders tag chip with accessible remove name and calls onRemoveTag", async () => {
      const onRemoveTag = vi.fn();
      render(
        <ActiveFilterChips
          {...defaultProps({
            tag: "payments",
            onRemoveTag,
          })}
        />,
      );

      expect(screen.getByText("Tag: payments")).toBeInTheDocument();
      const removeTagBtn = screen.getByRole("button", {
        name: "Remove filter: Tag payments",
      });
      await userEvent.click(removeTagBtn);
      expect(onRemoveTag).toHaveBeenCalledTimes(1);
    });
  });

  describe("Price chips", () => {
    it("renders min and max price chips with accessible names and calls removal callbacks", async () => {
      const onRemoveMinPrice = vi.fn();
      const onRemoveMaxPrice = vi.fn();
      render(
        <ActiveFilterChips
          {...defaultProps({
            minPrice: 5,
            maxPrice: 25,
            onRemoveMinPrice,
            onRemoveMaxPrice,
          })}
        />,
      );

      expect(screen.getByText("Min price: $5")).toBeInTheDocument();
      expect(screen.getByText("Max price: $25")).toBeInTheDocument();

      const removeMinBtn = screen.getByRole("button", {
        name: "Remove filter: Min price $5",
      });
      const removeMaxBtn = screen.getByRole("button", {
        name: "Remove filter: Max price $25",
      });

      await userEvent.click(removeMinBtn);
      expect(onRemoveMinPrice).toHaveBeenCalledTimes(1);

      await userEvent.click(removeMaxBtn);
      expect(onRemoveMaxPrice).toHaveBeenCalledTimes(1);
    });

    it("displays inverted price range as inactive with explanatory title and (not applied) note", () => {
      render(
        <ActiveFilterChips
          {...defaultProps({
            minPrice: 50,
            maxPrice: 10,
          })}
        />,
      );

      const minChip = screen.getByTestId("filter-chip-minPrice");
      const maxChip = screen.getByTestId("filter-chip-maxPrice");

      expect(minChip).toHaveClass("filter-chip--inactive");
      expect(minChip).toHaveAttribute("data-inactive", "true");
      expect(minChip).toHaveAttribute("title", "Min price exceeds max price; price filter is inactive");

      expect(maxChip).toHaveClass("filter-chip--inactive");
      expect(maxChip).toHaveAttribute("data-inactive", "true");
      expect(maxChip).toHaveAttribute("title", "Min price exceeds max price; price filter is inactive");

      expect(screen.getAllByText("(not applied)")).toHaveLength(2);
    });

    it("displays normal price range without inactive styling", () => {
      render(
        <ActiveFilterChips
          {...defaultProps({
            minPrice: 10,
            maxPrice: 50,
          })}
        />,
      );

      const minChip = screen.getByTestId("filter-chip-minPrice");
      expect(minChip).not.toHaveClass("filter-chip--inactive");
      expect(minChip).toHaveAttribute("data-inactive", "false");
      expect(screen.queryByText("(not applied)")).toBeNull();
    });
  });

  describe("Popularity and Favorites", () => {
    it("renders popularity chip and calls onRemovePopularity", async () => {
      const onRemovePopularity = vi.fn();
      render(
        <ActiveFilterChips
          {...defaultProps({
            popularity: "mostUsed",
            onRemovePopularity,
          })}
        />,
      );

      expect(screen.getByText("Popularity: mostUsed")).toBeInTheDocument();
      const removeBtn = screen.getByRole("button", {
        name: "Remove filter: Popularity mostUsed",
      });
      await userEvent.click(removeBtn);
      expect(onRemovePopularity).toHaveBeenCalledTimes(1);
    });

    it("renders favorites only chip and calls onRemoveFavoritesOnly", async () => {
      const onRemoveFavoritesOnly = vi.fn();
      render(
        <ActiveFilterChips
          {...defaultProps({
            favoritesOnly: true,
            onRemoveFavoritesOnly,
          })}
        />,
      );

      expect(screen.getByText("Favorites only")).toBeInTheDocument();
      const removeBtn = screen.getByRole("button", {
        name: "Remove filter: Favorites only",
      });
      await userEvent.click(removeBtn);
      expect(onRemoveFavoritesOnly).toHaveBeenCalledTimes(1);
    });
  });

  describe("Clear all", () => {
    it("renders Clear all button and calls onClearAll when clicked", async () => {
      const onClearAll = vi.fn();
      render(
        <ActiveFilterChips
          {...defaultProps({
            categories: new Set(["Finance"]),
            minPrice: 10,
            onClearAll,
          })}
        />,
      );

      const clearBtn = screen.getByRole("button", { name: "Clear all" });
      await userEvent.click(clearBtn);
      expect(onClearAll).toHaveBeenCalledTimes(1);
    });
  });

  describe("Focus management and keyboard navigation", () => {
    function StatefulChipsHarness() {
      const [categories, setCategories] = useState(new Set(["Finance", "Security", "AI"]));
      const resultsHeadingRef = createRef<HTMLHeadingElement>();

      return (
        <div>
          <h2 ref={resultsHeadingRef} tabIndex={-1}>
            Marketplace results
          </h2>
          <ActiveFilterChips
            {...defaultProps({
              categories,
              onRemoveCategory: (c) => {
                setCategories((prev) => {
                  const next = new Set(prev);
                  next.delete(c);
                  return next;
                });
              },
              resultsHeadingRef,
            })}
          />
        </div>
      );
    }

    it("moves focus to the next chip when a chip is removed", async () => {
      render(<StatefulChipsHarness />);

      const removeFinanceBtn = screen.getByRole("button", {
        name: "Remove filter: Category Finance",
      });
      await userEvent.click(removeFinanceBtn);

      const removeSecurityBtn = screen.getByRole("button", {
        name: "Remove filter: Category Security",
      });
      expect(document.activeElement).toBe(removeSecurityBtn);
    });

    it("moves focus to results heading when the last remaining chip is removed", async () => {
      function SingleChipHarness() {
        const [categories, setCategories] = useState(new Set(["Finance"]));
        const resultsHeadingRef = createRef<HTMLHeadingElement>();

        return (
          <div>
            <h2 ref={resultsHeadingRef} tabIndex={-1}>
              Marketplace results
            </h2>
            <ActiveFilterChips
              {...defaultProps({
                categories,
                onRemoveCategory: () => setCategories(new Set()),
                resultsHeadingRef,
              })}
            />
          </div>
        );
      }

      render(<SingleChipHarness />);

      const heading = screen.getByRole("heading", { name: "Marketplace results" });
      const removeBtn = screen.getByRole("button", {
        name: "Remove filter: Category Finance",
      });

      await userEvent.click(removeBtn);
      expect(document.activeElement).toBe(heading);
    });

    it("buttons are operable via keyboard Enter and Space", async () => {
      const onRemoveCategory = vi.fn();
      render(
        <ActiveFilterChips
          {...defaultProps({
            categories: new Set(["Finance"]),
            onRemoveCategory,
          })}
        />,
      );

      const removeBtn = screen.getByRole("button", {
        name: "Remove filter: Category Finance",
      });
      removeBtn.focus();
      expect(removeBtn).toHaveFocus();

      await userEvent.keyboard("{Enter}");
      expect(onRemoveCategory).toHaveBeenCalledWith("Finance");
    });
  });
});
