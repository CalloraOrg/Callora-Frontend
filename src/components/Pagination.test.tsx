// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Pagination } from "./Pagination";

afterEach(() => {
  cleanup();
});

/** Ellipses are the only place the component renders a literal "...". */
function ellipsisCount(container: HTMLElement): number {
  return container.querySelectorAll(".ellipsis").length;
}

/** Page numbers currently rendered as buttons, in DOM order. */
function renderedPageNumbers(container: HTMLElement): number[] {
  return Array.from(container.querySelectorAll(".page-numbers button")).map(
    (button) => Number(button.textContent),
  );
}

type OffsetOverrides = {
  currentPage?: number;
  totalPages?: number;
  pageSize?: number;
};

function renderOffset(overrides: OffsetOverrides = {}) {
  const onPageChange = vi.fn();
  const onPageSizeChange = vi.fn();

  const utils = render(
    <Pagination
      currentPage={1}
      totalPages={10}
      pageSize={12}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      {...overrides}
    />,
  );

  return { ...utils, onPageChange, onPageSizeChange };
}

describe("Pagination - offset mode", () => {
  describe("when there is nothing to paginate", () => {
    it("renders nothing for a single page", () => {
      const { container } = renderOffset({ totalPages: 1 });

      expect(container.querySelector("nav")).toBeNull();
      expect(container).toBeEmptyDOMElement();
    });

    it("renders nothing when totalPages is zero", () => {
      const { container } = renderOffset({ totalPages: 0 });

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("page number window", () => {
    it("lists every page without ellipses up to seven pages", () => {
      const { container } = renderOffset({ totalPages: 7, currentPage: 1 });

      expect(renderedPageNumbers(container)).toEqual([1, 2, 3, 4, 5, 6, 7]);
      expect(ellipsisCount(container)).toBe(0);
    });

    it("collapses to first, neighbours, and last once the count exceeds seven", () => {
      const { container } = renderOffset({ totalPages: 8, currentPage: 1 });

      expect(renderedPageNumbers(container)).toEqual([1, 2, 8]);
      expect(ellipsisCount(container)).toBe(1);
    });

    it("brackets the current page with ellipses in the middle of a large set", () => {
      const { container } = renderOffset({ totalPages: 10, currentPage: 5 });

      expect(renderedPageNumbers(container)).toEqual([1, 4, 5, 6, 10]);
      expect(ellipsisCount(container)).toBe(2);
      // Pages between the two windows must not be rendered at all.
      expect(screen.queryByRole("button", { name: "Page 3" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Page 7" })).toBeNull();
    });

    it("drops the leading ellipsis near the first page", () => {
      const { container } = renderOffset({ totalPages: 10, currentPage: 2 });

      expect(renderedPageNumbers(container)).toEqual([1, 2, 3, 10]);
      expect(ellipsisCount(container)).toBe(1);
    });

    it("drops the trailing ellipsis near the last page", () => {
      const { container } = renderOffset({ totalPages: 10, currentPage: 10 });

      expect(renderedPageNumbers(container)).toEqual([1, 9, 10]);
      expect(ellipsisCount(container)).toBe(1);
    });

    it("drops both ellipses when the window reaches both ends", () => {
      const { container } = renderOffset({ totalPages: 7, currentPage: 4 });

      expect(renderedPageNumbers(container)).toEqual([1, 2, 3, 4, 5, 6, 7]);
      expect(ellipsisCount(container)).toBe(0);
    });

    it("keeps first and last reachable at the window boundaries", () => {
      const first = renderOffset({ totalPages: 10, currentPage: 1 });
      expect(renderedPageNumbers(first.container)[0]).toBe(1);
      expect(
        screen.getByRole("button", { name: "Page 10" }),
      ).toBeInTheDocument();
      cleanup();

      const last = renderOffset({ totalPages: 10, currentPage: 3 });
      expect(renderedPageNumbers(last.container)).toEqual([1, 2, 3, 4, 10]);
    });
  });

  describe("current page state", () => {
    it("marks only the active page with aria-current and the current-page class", () => {
      renderOffset({ totalPages: 10, currentPage: 5 });

      const active = screen.getByRole("button", { name: "Page 5" });
      expect(active).toHaveAttribute("aria-current", "page");
      expect(active).toHaveClass("current-page");

      const inactive = screen.getByRole("button", { name: "Page 6" });
      expect(inactive).not.toHaveAttribute("aria-current");
      expect(inactive).not.toHaveClass("current-page");
      expect(inactive).toHaveClass("ghost-button");
    });

    it("exposes the active page even when it sits at an edge of the window", () => {
      renderOffset({ totalPages: 50, currentPage: 1 });

      expect(screen.getByRole("button", { name: "Page 1" })).toHaveAttribute(
        "aria-current",
        "page",
      );
    });
  });

  describe("navigation button boundaries", () => {
    it("disables First and Prev on the first page", () => {
      renderOffset({ totalPages: 10, currentPage: 1 });

      expect(screen.getByRole("button", { name: "First page" })).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Previous page" }),
      ).toBeDisabled();
      expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Last page" })).toBeEnabled();
    });

    it("disables Next and Last on the last page", () => {
      renderOffset({ totalPages: 10, currentPage: 10 });

      expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Last page" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "First page" })).toBeEnabled();
      expect(
        screen.getByRole("button", { name: "Previous page" }),
      ).toBeEnabled();
    });

    it("enables every navigation button on a middle page", () => {
      renderOffset({ totalPages: 10, currentPage: 5 });

      for (const label of [
        "First page",
        "Previous page",
        "Next page",
        "Last page",
      ]) {
        expect(screen.getByRole("button", { name: label })).toBeEnabled();
      }
    });
  });

  describe("interactions", () => {
    it("reports the clicked page number", async () => {
      const user = userEvent.setup();
      const { onPageChange } = renderOffset({ totalPages: 10, currentPage: 5 });

      await user.click(screen.getByRole("button", { name: "Page 6" }));

      expect(onPageChange).toHaveBeenCalledTimes(1);
      expect(onPageChange).toHaveBeenCalledWith(6);
    });

    it("reports relative moves from the First, Prev, Next, and Last controls", async () => {
      const user = userEvent.setup();
      const { onPageChange } = renderOffset({ totalPages: 10, currentPage: 5 });

      await user.click(screen.getByRole("button", { name: "First page" }));
      await user.click(screen.getByRole("button", { name: "Previous page" }));
      await user.click(screen.getByRole("button", { name: "Next page" }));
      await user.click(screen.getByRole("button", { name: "Last page" }));

      expect(onPageChange.mock.calls.map(([page]) => page)).toEqual([
        1, 4, 6, 10,
      ]);
    });

    it("does not fire onPageChange when a disabled control is clicked", async () => {
      const user = userEvent.setup();
      const { onPageChange } = renderOffset({ totalPages: 10, currentPage: 1 });

      await user.click(screen.getByRole("button", { name: "Previous page" }));
      await user.click(screen.getByRole("button", { name: "First page" }));

      expect(onPageChange).not.toHaveBeenCalled();
    });

    it("reports the page size as a number when the select changes", async () => {
      const user = userEvent.setup();
      const { onPageSizeChange } = renderOffset({ pageSize: 12 });

      await user.selectOptions(
        screen.getByLabelText("Items per page:"),
        "24",
      );

      expect(onPageSizeChange).toHaveBeenCalledTimes(1);
      expect(onPageSizeChange).toHaveBeenCalledWith(24);
      expect(typeof onPageSizeChange.mock.calls[0][0]).toBe("number");
    });

    it("reflects the controlled page size in the select", () => {
      renderOffset({ pageSize: 48 });

      expect(screen.getByLabelText("Items per page:")).toHaveValue("48");
    });
  });

  describe("accessibility and layout affordances", () => {
    it("exposes a labelled navigation landmark with labelled controls", () => {
      renderOffset({ totalPages: 10, currentPage: 5 });

      const nav = screen.getByRole("navigation", { name: "Pagination" });
      expect(nav).toBeInTheDocument();

      // Every interactive control has an accessible name.
      expect(
        within(nav).getByRole("button", { name: "First page" }),
      ).toBeInTheDocument();
      expect(within(nav).getByLabelText("Items per page:")).toBeInTheDocument();
      expect(within(nav).getByRole("button", { name: "Page 5" })).toHaveClass(
        "current-page",
      );
    });

    it("renders the mobile page indicator with the current and total pages", () => {
      const { container } = renderOffset({ totalPages: 10, currentPage: 5 });

      const indicator = container.querySelector(".mobile-page-indicator");
      expect(indicator).not.toBeNull();
      expect(indicator?.textContent).toBe("Page 5 of 10");
    });
  });
});

describe("Pagination - cursor mode", () => {
  function renderCursor(
    overrides: Partial<{
      currentPageIndex: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      totalItemCount: number;
      pageSize: number;
    }> = {},
  ) {
    const onGoNext = vi.fn();
    const onGoPrevious = vi.fn();
    const onPageSizeChange = vi.fn();

    const utils = render(
      <Pagination
        mode="cursor"
        currentPageIndex={0}
        hasNextPage
        hasPreviousPage={false}
        totalItemCount={40}
        pageSize={12}
        onGoNext={onGoNext}
        onGoPrevious={onGoPrevious}
        onPageSizeChange={onPageSizeChange}
        {...overrides}
      />,
    );

    return { ...utils, onGoNext, onGoPrevious, onPageSizeChange };
  }

  it("renders a cursor indicator instead of numbered pages", () => {
    const { container } = renderCursor();

    expect(
      screen.getByRole("navigation", { name: "Pagination" }),
    ).toBeInTheDocument();
    expect(container.querySelector(".page-numbers")).toBeNull();

    const indicator = container.querySelector(".cursor-page-indicator");
    expect(indicator?.textContent).toBe("1 / 4");
    expect(indicator).toHaveAttribute("aria-current", "page");
  });

  it("derives the page number from the zero-based index", () => {
    const { container } = renderCursor({ currentPageIndex: 2 });

    expect(
      container.querySelector(".cursor-page-indicator")?.textContent,
    ).toBe("3 / 4");
  });

  it("falls back to a single page when the result set is empty", () => {
    const { container } = renderCursor({ totalItemCount: 0 });

    expect(
      container.querySelector(".cursor-page-indicator")?.textContent,
    ).toBe("1 / 1");
    expect(container.querySelector(".mobile-page-indicator")?.textContent).toBe(
      "Page 1 of 1",
    );
  });

  it("rounds the page count up for a partial final page", () => {
    const { container } = renderCursor({ totalItemCount: 25, pageSize: 12 });

    expect(
      container.querySelector(".cursor-page-indicator")?.textContent,
    ).toBe("1 / 3");
  });

  it("disables Prev on the first page", () => {
    renderCursor({ hasPreviousPage: false, hasNextPage: true });

    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled();
  });

  it("disables Next on the last page", () => {
    const { container } = renderCursor({
      hasPreviousPage: true,
      hasNextPage: false,
    });

    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeEnabled();
    expect(container.querySelector("nav")).not.toBeNull();
  });

  it("reports next and previous moves without computing page numbers itself", async () => {
    const user = userEvent.setup();
    const { onGoNext, onGoPrevious } = renderCursor({
      currentPageIndex: 1,
      hasPreviousPage: true,
      hasNextPage: true,
    });

    await user.click(screen.getByRole("button", { name: "Next page" }));
    await user.click(screen.getByRole("button", { name: "Previous page" }));

    expect(onGoNext).toHaveBeenCalledTimes(1);
    expect(onGoPrevious).toHaveBeenCalledTimes(1);
  });

  it("ignores clicks on disabled cursor controls", async () => {
    const user = userEvent.setup();
    const { onGoPrevious } = renderCursor({ hasPreviousPage: false });

    await user.click(screen.getByRole("button", { name: "Previous page" }));

    expect(onGoPrevious).not.toHaveBeenCalled();
  });

  it("reports page size changes in cursor mode too", async () => {
    const user = userEvent.setup();
    const { onPageSizeChange } = renderCursor({ pageSize: 12 });

    await user.selectOptions(screen.getByLabelText("Items per page:"), "48");

    expect(onPageSizeChange).toHaveBeenCalledWith(48);
  });

  it("renders the mobile summary for the current cursor page", () => {
    const { container } = renderCursor({ currentPageIndex: 1 });

    expect(
      container.querySelector(".mobile-page-indicator")?.textContent,
    ).toBe("Page 2 of 4");
  });
});
