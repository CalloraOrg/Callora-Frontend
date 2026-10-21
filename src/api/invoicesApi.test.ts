import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  adaptBackendInvoice,
  DEMO_INVOICE,
  fetchLatestInvoices,
  getSharedAuthenticatedFetch,
  INVOICES_PATH,
  InvoicesFetchError,
  isInvoiceDemoMode,
  isInvoicesAbortError,
  normalizeInvoiceStatus,
  selectNewestPendingInvoice,
  validateInvoicesResponse,
} from "./invoicesApi";
import { addAccount, switchAccount, _reset } from "../state/accountStore";
import * as constants from "../config/constants";
import { formatUsdcDecimal } from "../utils/format";

describe("invoicesApi (Issue #1321)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    _reset();
  });

  afterEach(() => {
    localStorage.clear();
    _reset();
  });

  describe("normalizeInvoiceStatus", () => {
    it("normalises known statuses case-insensitively", () => {
      expect(normalizeInvoiceStatus("pending")).toBe("pending");
      expect(normalizeInvoiceStatus("PAID")).toBe("paid");
      expect(normalizeInvoiceStatus(" Void ")).toBe("void");
      expect(normalizeInvoiceStatus("canceled")).toBe("canceled");
    });

    it("maps unknown or non-string statuses to 'unknown'", () => {
      expect(normalizeInvoiceStatus("weird")).toBe("unknown");
      expect(normalizeInvoiceStatus("")).toBe("unknown");
      expect(normalizeInvoiceStatus(null)).toBe("unknown");
      expect(normalizeInvoiceStatus(undefined)).toBe("unknown");
      expect(normalizeInvoiceStatus(123)).toBe("unknown");
    });
  });

  describe("adaptBackendInvoice & validateInvoicesResponse", () => {
    it("adapts a valid backend invoice keeping all 7 decimals exact as string", () => {
      const row = {
        id: 42,
        invoice_number: "INV-2026-009",
        status: "pending",
        total_amount_usdc: "12.3456789",
        currency: "USDC",
        period_start: "2026-08-01T00:00:00Z",
        period_end: "2026-09-01T01:00:00Z",
        created_at: "2026-09-01T01:05:00Z",
      };

      const adapted = adaptBackendInvoice(row);
      expect(adapted).toEqual({
        id: "42",
        invoiceNumber: "INV-2026-009",
        status: "pending",
        rawStatus: "pending",
        totalAmountUsdc: "12.3456789",
        currency: "USDC",
        periodStart: "2026-08-01T00:00:00Z",
        periodEnd: "2026-09-01T01:00:00Z",
        createdAt: "2026-09-01T01:05:00Z",
      });
    });

    it("defaults id to invoiceNumber and currency to USDC when omitted", () => {
      const adapted = adaptBackendInvoice({
        invoiceNumber: "INV-2026-010",
        status: "weird",
        totalAmountUsdc: "100.0000000",
        periodStart: "2026-08-01T00:00:00Z",
        periodEnd: "2026-09-01T00:00:00Z",
        createdAt: "2026-09-01T00:00:00Z",
      });

      expect(adapted.id).toBe("INV-2026-010");
      expect(adapted.currency).toBe("USDC");
      expect(adapted.status).toBe("unknown");
      expect(adapted.rawStatus).toBe("weird");
    });

    it("throws InvoicesFetchError on malformed invoice entries", () => {
      expect(() => adaptBackendInvoice(null)).toThrow(InvoicesFetchError);
      expect(() => adaptBackendInvoice("not-an-object")).toThrow(InvoicesFetchError);
      expect(() =>
        adaptBackendInvoice({ invoice_number: "", total_amount_usdc: "10.00" }),
      ).toThrow(/invoice_number/);
      expect(() =>
        adaptBackendInvoice({ invoice_number: "INV-1", total_amount_usdc: "not-a-number" }),
      ).toThrow(/total_amount_usdc/);
      expect(() =>
        adaptBackendInvoice({ invoice_number: "INV-1", total_amount_usdc: 12.34 }),
      ).toThrow(/total_amount_usdc/);
    });

    it("validates { data, meta } response shape", () => {
      const response = validateInvoicesResponse({
        data: [
          {
            id: "inv_1",
            invoice_number: "INV-2026-001",
            status: "paid",
            total_amount_usdc: "50.0000000",
          },
        ],
        meta: {
          limit: 10,
          nextCursor: "Y3Vyc29y",
          hasMore: true,
        },
      });

      expect(response.data).toHaveLength(1);
      expect(response.meta).toEqual({
        limit: 10,
        nextCursor: "Y3Vyc29y",
        hasMore: true,
      });
    });

    it("provides fallback meta defaults when meta is omitted", () => {
      const response = validateInvoicesResponse({
        data: [],
      });
      expect(response.data).toEqual([]);
      expect(response.meta).toEqual({
        limit: 0,
        nextCursor: null,
        hasMore: false,
      });
    });

    it("throws InvoicesFetchError when payload is not { data: [...] }", () => {
      expect(() => validateInvoicesResponse(null)).toThrow(InvoicesFetchError);
      expect(() => validateInvoicesResponse([])).toThrow(InvoicesFetchError);
      expect(() => validateInvoicesResponse({ data: "invalid" })).toThrow(InvoicesFetchError);
    });
  });

  describe("selectNewestPendingInvoice", () => {
    it("picks the first pending invoice from descending-ordered list", () => {
      const items = [
        adaptBackendInvoice({
          invoice_number: "INV-2026-003",
          status: "paid",
          total_amount_usdc: "25.0000000",
        }),
        adaptBackendInvoice({
          invoice_number: "INV-2026-002",
          status: "pending",
          total_amount_usdc: "12.3456789",
        }),
        adaptBackendInvoice({
          invoice_number: "INV-2026-001",
          status: "pending",
          total_amount_usdc: "5.0000000",
        }),
      ];

      const selected = selectNewestPendingInvoice(items);
      expect(selected?.invoiceNumber).toBe("INV-2026-002");
      expect(selected?.totalAmountUsdc).toBe("12.3456789");
    });

    it("returns null when only paid/void/canceled invoices exist or list is empty", () => {
      const paidOnly = [
        adaptBackendInvoice({
          invoice_number: "INV-2026-003",
          status: "paid",
          total_amount_usdc: "25.0000000",
        }),
        adaptBackendInvoice({
          invoice_number: "INV-2026-002",
          status: "void",
          total_amount_usdc: "10.0000000",
        }),
      ];

      expect(selectNewestPendingInvoice(paidOnly)).toBeNull();
      expect(selectNewestPendingInvoice([])).toBeNull();
    });
  });

  describe("fetchLatestInvoices & getSharedAuthenticatedFetch", () => {
    it("fetches from /api/invoices with clamped limit, cursor, and auth header", async () => {
      addAccount({
        id: "acc-1",
        label: "Primary",
        apiKey: "ck_live_test_token_123",
      });
      switchAccount("acc-1");

      let capturedUrl = "";
      let capturedInit: RequestInit | undefined;

      const baseFetch: typeof fetch = vi.fn().mockImplementation((url, init) => {
        capturedUrl = String(url);
        capturedInit = init;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [
                {
                  id: "1",
                  invoice_number: "INV-2026-100",
                  status: "pending",
                  total_amount_usdc: "12.3456789",
                  currency: "USDC",
                  period_end: "2026-09-01T00:00:00Z",
                },
              ],
              meta: { limit: 5, nextCursor: null, hasMore: false },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      });

      const sharedFetch = getSharedAuthenticatedFetch(baseFetch);
      const res = await fetchLatestInvoices({
        limit: 5,
        cursor: "abc123cursor",
        baseUrl: "https://api.callora.test/",
        fetchImpl: sharedFetch,
      });

      expect(capturedUrl).toBe(
        `https://api.callora.test${INVOICES_PATH}?limit=5&cursor=abc123cursor`,
      );
      const headers = new Headers(capturedInit?.headers);
      expect(headers.get("Authorization")).toBe("Bearer ck_live_test_token_123");
      expect(headers.get("Accept")).toBe("application/json");
      expect(capturedInit?.credentials).toBe("include");
      expect(res.data).toHaveLength(1);
      expect(res.data[0].invoiceNumber).toBe("INV-2026-100");
    });

    it("throws InvoicesFetchError with code UNAUTHORIZED on 401", async () => {
      const fetchImpl: typeof fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
      );

      await expect(
        fetchLatestInvoices({ baseUrl: "https://api.callora.test", fetchImpl }),
      ).rejects.toMatchObject({
        name: "InvoicesFetchError",
        status: 401,
        code: "UNAUTHORIZED",
      });
    });

    it("throws InvoicesFetchError with code HTTP_ERROR on 500", async () => {
      const fetchImpl: typeof fetch = vi.fn().mockResolvedValue(
        new Response("Internal Server Error", { status: 500 }),
      );

      await expect(
        fetchLatestInvoices({ baseUrl: "https://api.callora.test", fetchImpl }),
      ).rejects.toMatchObject({
        name: "InvoicesFetchError",
        status: 500,
        code: "HTTP_ERROR",
      });
    });

    it("throws InvoicesFetchError with code INVALID_RESPONSE on invalid JSON", async () => {
      const fetchImpl: typeof fetch = vi.fn().mockResolvedValue(
        new Response("not-json", { status: 200 }),
      );

      await expect(
        fetchLatestInvoices({ baseUrl: "https://api.callora.test", fetchImpl }),
      ).rejects.toMatchObject({
        name: "InvoicesFetchError",
        code: "INVALID_RESPONSE",
      });
    });

    it("throws InvoicesFetchError with code NETWORK_ERROR when fetch rejects", async () => {
      const fetchImpl: typeof fetch = vi
        .fn()
        .mockRejectedValue(new TypeError("Failed to fetch"));

      await expect(
        fetchLatestInvoices({ baseUrl: "https://api.callora.test", fetchImpl }),
      ).rejects.toMatchObject({
        name: "InvoicesFetchError",
        code: "NETWORK_ERROR",
      });
    });

    it("rejects with AbortError when signal is already aborted or aborts mid-flight", async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        fetchLatestInvoices({ signal: controller.signal, fetchImpl: vi.fn() }),
      ).rejects.toSatisfy(isInvoicesAbortError);

      const inFlightController = new AbortController();
      const abortingFetch: typeof fetch = vi.fn().mockImplementation(() => {
        inFlightController.abort();
        const err = new Error("Aborted");
        err.name = "AbortError";
        return Promise.reject(err);
      });

      await expect(
        fetchLatestInvoices({
          signal: inFlightController.signal,
          fetchImpl: abortingFetch,
        }),
      ).rejects.toSatisfy(isInvoicesAbortError);
    });

    it("detects demo mode based on API_BASE and provides DEMO_INVOICE", () => {
      vi.spyOn(constants, "API_BASE", "get").mockReturnValue("");
      expect(isInvoiceDemoMode()).toBe(true);
      expect(DEMO_INVOICE.invoiceNumber).toContain("DEMO");

      vi.spyOn(constants, "API_BASE", "get").mockReturnValue("https://api.callora.com");
      expect(isInvoiceDemoMode()).toBe(false);
    });
  });

  describe("formatUsdcDecimal", () => {
    it("formats 7-decimal USDC strings without parseFloat or $ sign", () => {
      expect(formatUsdcDecimal("12.3456789", { locale: "en-US" })).toBe("12.3456789 USDC");
      expect(formatUsdcDecimal("42.5000000", { locale: "en-US" })).toBe("42.50 USDC");
      expect(formatUsdcDecimal("4200", { locale: "en-US" })).toBe("4,200.00 USDC");
      expect(formatUsdcDecimal("12.3456789", { locale: "en-US" })).not.toContain("$");
    });
  });
});
