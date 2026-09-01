// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InvoiceStatusBadge from "./InvoiceStatusBadge";
import type { InvoiceStatus } from "../types/invoice";

describe("InvoiceStatusBadge", () => {
  afterEach(() => {
    cleanup();
  });

  const statuses: InvoiceStatus[] = ["draft", "pending", "paid", "overdue", "cancelled"];

  it.each(statuses)("renders status badge for %s", (status) => {
    render(<InvoiceStatusBadge status={status} />);
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it.each(statuses)("displays correct label for %s", (status) => {
    render(<InvoiceStatusBadge status={status} />);
    const expected = status.charAt(0).toUpperCase() + status.slice(1);
    expect(screen.getByText(expected)).toBeTruthy();
  });

  it("has accessible aria-label", () => {
    render(<InvoiceStatusBadge status="paid" />);
    const badge = screen.getByRole("status");
    expect(badge.getAttribute("aria-label")).toBe("Status: Paid");
  });

  it("includes a status indicator dot", () => {
    const { container } = render(<InvoiceStatusBadge status="overdue" />);
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot).toBeTruthy();
  });
});
