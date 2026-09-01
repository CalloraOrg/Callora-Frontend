// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import InvoiceList from "./InvoiceList";
import type { Invoice, InvoiceAction, InvoiceFilter, InvoiceSort } from "../types/invoice";

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-test",
    number: "INV-2026-001",
    status: "draft",
    version: 1,
    amount: 100,
    currency: "USDC",
    createdAt: "2026-08-15T10:00:00Z",
    dueAt: "2026-09-15T10:00:00Z",
    apiName: "Test API",
    items: [],
    ...overrides,
  };
}

const defaultProps = {
  invoices: [] as Invoice[],
  isLoading: false,
  error: null as string | null,
  pendingActions: new Set<string>(),
  filter: {} as InvoiceFilter,
  sort: { field: "createdAt", direction: "desc" } as InvoiceSort,
  total: 0,
  page: 1,
  hasMore: false,
  onAction: vi.fn().mockResolvedValue(true),
  onFilterChange: vi.fn(),
  onSortChange: vi.fn(),
  onPageChange: vi.fn(),
  onRetry: vi.fn().mockResolvedValue(undefined),
};

describe("InvoiceList", () => {
  afterEach(() => {
    cleanup();
  });

  describe("error state", () => {
    it("renders error EmptyState when error is set", () => {
      render(<InvoiceList {...defaultProps} error="Network error" />);
      expect(screen.getByText("Failed to load invoices")).toBeTruthy();
      expect(screen.getByText("Network error")).toBeTruthy();
    });

    it("renders retry button in error state", () => {
      render(<InvoiceList {...defaultProps} error="Timeout" />);
      expect(screen.getByText("Retry")).toBeTruthy();
    });

    it("calls onRetry when retry button clicked", () => {
      const onRetry = vi.fn().mockResolvedValue(undefined);
      render(<InvoiceList {...defaultProps} error="Timeout" onRetry={onRetry} />);
      fireEvent.click(screen.getByText("Retry"));
      expect(onRetry).toHaveBeenCalledOnce();
    });
  });

  describe("loading state", () => {
    it("renders skeleton list when loading with no data", () => {
      const { container } = render(<InvoiceList {...defaultProps} isLoading={true} />);
      const skeletons = container.querySelectorAll(".surface");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("shows invoice cards when loading but data exists", () => {
      render(
        <InvoiceList
          {...defaultProps}
          isLoading={true}
          invoices={[makeInvoice({ id: "inv-1" })]}
          total={1}
        />
      );
      expect(screen.getByText("INV-2026-001")).toBeTruthy();
    });
  });

  describe("empty state", () => {
    it("renders empty state when no invoices", () => {
      render(<InvoiceList {...defaultProps} />);
      expect(screen.getByText("No invoices found")).toBeTruthy();
    });

    it("shows filter hint when filters active", () => {
      render(
        <InvoiceList
          {...defaultProps}
          filter={{ status: "paid" }}
        />
      );
      expect(screen.getByText("No invoices match your filters.")).toBeTruthy();
    });
  });

  describe("invoice list", () => {
    it("renders invoice cards", () => {
      const invoices = [
        makeInvoice({ id: "inv-1", number: "INV-001" }),
        makeInvoice({ id: "inv-2", number: "INV-002" }),
      ];
      render(<InvoiceList {...defaultProps} invoices={invoices} total={2} />);
      expect(screen.getByText("INV-001")).toBeTruthy();
      expect(screen.getByText("INV-002")).toBeTruthy();
    });

    it("displays total count", () => {
      const invoices = [makeInvoice({ id: "inv-1" })];
      render(<InvoiceList {...defaultProps} invoices={invoices} total={5} />);
      expect(screen.getByText("5 invoices found")).toBeTruthy();
    });

    it("displays singular count", () => {
      const invoices = [makeInvoice({ id: "inv-1" })];
      render(<InvoiceList {...defaultProps} invoices={invoices} total={1} />);
      expect(screen.getByText("1 invoice found")).toBeTruthy();
    });
  });

  describe("filters", () => {
    it("renders status filter", () => {
      render(<InvoiceList {...defaultProps} />);
      expect(screen.getByLabelText("Status:")).toBeTruthy();
    });

    it("renders search input", () => {
      render(<InvoiceList {...defaultProps} />);
      expect(screen.getByLabelText("Search:")).toBeTruthy();
    });

    it("calls onFilterChange when status filter changes", () => {
      const onFilterChange = vi.fn();
      render(<InvoiceList {...defaultProps} onFilterChange={onFilterChange} />);
      fireEvent.change(screen.getByLabelText("Status:"), { target: { value: "paid" } });
      expect(onFilterChange).toHaveBeenCalledWith({ status: "paid" });
    });

    it("calls onFilterChange when search input changes", () => {
      const onFilterChange = vi.fn();
      render(<InvoiceList {...defaultProps} onFilterChange={onFilterChange} />);
      fireEvent.change(screen.getByLabelText("Search:"), { target: { value: "weather" } });
      expect(onFilterChange).toHaveBeenCalledWith({ search: "weather" });
    });

    it("shows clear filters button when filters active", () => {
      render(<InvoiceList {...defaultProps} filter={{ status: "paid" }} />);
      expect(screen.getByText("Clear filters")).toBeTruthy();
    });

    it("calls onFilterChange with empty object on clear", () => {
      const onFilterChange = vi.fn();
      render(
        <InvoiceList
          {...defaultProps}
          filter={{ status: "paid" }}
          onFilterChange={onFilterChange}
        />
      );
      fireEvent.click(screen.getByText("Clear filters"));
      expect(onFilterChange).toHaveBeenCalledWith({});
    });
  });

  describe("pagination", () => {
    it("renders previous/next buttons", () => {
      render(<InvoiceList {...defaultProps} total={20} hasMore={true} />);
      expect(screen.getByText("Previous")).toBeTruthy();
      expect(screen.getByText("Next")).toBeTruthy();
    });

    it("disables previous on page 1", () => {
      render(<InvoiceList {...defaultProps} total={20} page={1} hasMore={true} />);
      expect(screen.getByText("Previous").getAttribute("disabled")).not.toBeNull();
    });

    it("enables next when hasMore is true", () => {
      render(<InvoiceList {...defaultProps} total={20} page={1} hasMore={true} />);
      expect(screen.getByText("Next").getAttribute("disabled")).toBeNull();
    });

    it("disables next when hasMore is false", () => {
      render(<InvoiceList {...defaultProps} total={10} page={1} hasMore={false} />);
      expect(screen.getByText("Next").getAttribute("disabled")).not.toBeNull();
    });

    it("calls onPageChange when next clicked", () => {
      const onPageChange = vi.fn();
      render(
        <InvoiceList {...defaultProps} total={20} page={1} hasMore={true} onPageChange={onPageChange} />
      );
      fireEvent.click(screen.getByText("Next"));
      expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it("calls onPageChange when previous clicked", () => {
      const onPageChange = vi.fn();
      render(
        <InvoiceList {...defaultProps} total={20} page={2} hasMore={true} onPageChange={onPageChange} />
      );
      fireEvent.click(screen.getByText("Previous"));
      expect(onPageChange).toHaveBeenCalledWith(1);
    });

    it("displays current page", () => {
      render(<InvoiceList {...defaultProps} total={20} page={3} hasMore={true} />);
      expect(screen.getByText("Page 3")).toBeTruthy();
    });
  });

  describe("pending actions", () => {
    it("marks card as pending when action is in progress", () => {
      const invoices = [makeInvoice({ id: "inv-1" })];
      const pendingActions = new Set(["inv-1"]);
      render(
        <InvoiceList {...defaultProps} invoices={invoices} total={1} pendingActions={pendingActions} />
      );
      const card = screen.getByLabelText("Invoice INV-2026-001");
      expect(card.getAttribute("aria-busy")).toBe("true");
    });
  });
});
