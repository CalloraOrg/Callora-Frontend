// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import InvoiceCard from "./InvoiceCard";
import type { Invoice } from "../types/invoice";

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-test",
    number: "INV-2026-001",
    status: "draft",
    version: 1,
    amount: 120.5,
    currency: "USDC",
    createdAt: "2026-08-15T10:00:00Z",
    dueAt: "2026-09-15T10:00:00Z",
    apiName: "Weather API",
    items: [],
    ...overrides,
  };
}

describe("InvoiceCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders invoice number and API name", () => {
    const invoice = makeInvoice();
    render(<InvoiceCard invoice={invoice} isPending={false} onAction={vi.fn()} />);
    expect(screen.getByText("INV-2026-001")).toBeTruthy();
    expect(screen.getByText("Weather API")).toBeTruthy();
  });

  it("displays formatted amount", () => {
    const invoice = makeInvoice({ amount: 120.5 });
    render(<InvoiceCard invoice={invoice} isPending={false} onAction={vi.fn()} />);
    expect(screen.getByText("120.50 USDC")).toBeTruthy();
  });

  it("displays due date", () => {
    render(<InvoiceCard invoice={makeInvoice()} isPending={false} onAction={vi.fn()} />);
    expect(screen.getByText(/Due/)).toBeTruthy();
  });

  it("shows action buttons for draft status", () => {
    render(<InvoiceCard invoice={makeInvoice()} isPending={false} onAction={vi.fn()} />);
    expect(screen.getByText("Send")).toBeTruthy();
    expect(screen.getByText("Cancel")).toBeTruthy();
  });

  it("shows action buttons for pending status", () => {
    const invoice = makeInvoice({ status: "pending" });
    render(<InvoiceCard invoice={invoice} isPending={false} onAction={vi.fn()} />);
    expect(screen.getByText("Mark Paid")).toBeTruthy();
    expect(screen.getByText("Cancel")).toBeTruthy();
  });

  it("shows no action buttons for paid status (terminal)", () => {
    const invoice = makeInvoice({ status: "paid" });
    render(<InvoiceCard invoice={invoice} isPending={false} onAction={vi.fn()} />);
    expect(screen.queryByText("Mark Paid")).toBeNull();
    expect(screen.queryByText("Cancel")).toBeNull();
  });

  it("shows no action buttons for cancelled status (terminal)", () => {
    const invoice = makeInvoice({ status: "cancelled" });
    render(<InvoiceCard invoice={invoice} isPending={false} onAction={vi.fn()} />);
    expect(screen.queryByRole("group")).toBeNull();
  });

  it("calls onAction with SEND when Send button clicked", async () => {
    const onAction = vi.fn().mockResolvedValue(true);
    render(<InvoiceCard invoice={makeInvoice()} isPending={false} onAction={onAction} />);
    fireEvent.click(screen.getByText("Send"));
    expect(onAction).toHaveBeenCalledWith({ type: "SEND", invoiceId: "inv-test" });
  });

  it("calls onAction with PAY when Mark Paid button clicked", async () => {
    const onAction = vi.fn().mockResolvedValue(true);
    const invoice = makeInvoice({ status: "pending" });
    render(<InvoiceCard invoice={invoice} isPending={false} onAction={onAction} />);
    fireEvent.click(screen.getByText("Mark Paid"));
    expect(onAction).toHaveBeenCalledWith({ type: "PAY", invoiceId: "inv-test" });
  });

  it("calls onAction with CANCEL when Cancel button clicked", async () => {
    const onAction = vi.fn().mockResolvedValue(true);
    render(<InvoiceCard invoice={makeInvoice()} isPending={false} onAction={onAction} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onAction).toHaveBeenCalledWith({ type: "CANCEL", invoiceId: "inv-test" });
  });

  it("disables action buttons when pending", () => {
    render(<InvoiceCard invoice={makeInvoice()} isPending={true} onAction={vi.fn()} />);
    const buttons = screen.getAllByText("Processing…");
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach((btn) => {
      expect(btn.getAttribute("disabled")).not.toBeNull();
      expect(btn.getAttribute("aria-busy")).toBe("true");
    });
  });

  it("reduces opacity when pending", () => {
    const { container } = render(
      <InvoiceCard invoice={makeInvoice()} isPending={true} onAction={vi.fn()} />
    );
    const card = container.querySelector(".invoice-card");
    expect(card?.getAttribute("aria-busy")).toBe("true");
  });

  it("shows paid date for paid invoices", () => {
    const invoice = makeInvoice({ status: "paid", paidAt: "2026-07-28T16:45:00Z" });
    render(<InvoiceCard invoice={invoice} isPending={false} onAction={vi.fn()} />);
    expect(screen.getByText(/Paid on/)).toBeTruthy();
  });

  it("shows cancelled date for cancelled invoices", () => {
    const invoice = makeInvoice({ status: "cancelled", cancelledAt: "2026-08-10T11:20:00Z" });
    render(<InvoiceCard invoice={invoice} isPending={false} onAction={vi.fn()} />);
    expect(screen.getByText(/Cancelled on/)).toBeTruthy();
  });
});
