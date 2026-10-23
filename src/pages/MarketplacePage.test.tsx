import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import MarketplacePage from "./MarketplacePage";
import { ToastProvider } from "../components/Toast";
import { CollectionsProvider } from "../state/collectionsStore";
import * as catalogApiModule from "../api/catalogApi";
import * as constants from "../config/constants";
import type { APIItem } from "../data/mockApis";

vi.mock("../hooks/useDocumentTitle", () => ({
  default: vi.fn(),
}));

const TEST_BACKEND_APIS: APIItem[] = [
  {
    id: "backend-101",
    name: "Live Blockchain Indexer",
    provider: { name: "Stellar Labs", url: "https://stellar.org" },
    description: "Real-time ledger events and stream query API",
    pricePerRequest: 0.005,
    status: "operational",
    category: "Data & Analytics",
  },
  {
    id: "backend-102",
    name: "Enterprise KYC Verifier",
    provider: { name: "Identity Corp" },
    description: "Automated document verification",
    pricePerRequest: 0,
    pricingOnRequest: true,
    status: "operational",
    category: "Security",
  },
];

function renderMarketplace() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <CollectionsProvider>
          <MarketplacePage />
        </CollectionsProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("MarketplacePage backend catalogue integration (Issue #1327 & #1328)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("lists backend APIs when configured with API_BASE", async () => {
    vi.spyOn(constants, "API_BASE", "get").mockReturnValue("https://api.callora.com");
    vi.spyOn(catalogApiModule, "fetchCatalog").mockResolvedValue(TEST_BACKEND_APIS);

    renderMarketplace();

    await waitFor(() => {
      expect(screen.getAllByText("Live Blockchain Indexer").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Enterprise KYC Verifier").length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText("Pricing on request").length).toBeGreaterThan(0);
  });

  it("surfaces error state when API_BASE is configured and fetchCatalog rejects", async () => {
    vi.spyOn(constants, "API_BASE", "get").mockReturnValue("https://api.callora.com");
    vi.spyOn(catalogApiModule, "fetchCatalog").mockRejectedValue(
      new catalogApiModule.CatalogFetchError("The marketplace service is unavailable right now.", 500),
    );

    renderMarketplace();

    await waitFor(() => {
      expect(
        screen.getByText(/The marketplace service is unavailable right now|We encountered an error fetching the marketplace/i),
      ).toBeInTheDocument();
    });

    expect(screen.queryByText("GeoLocate")).not.toBeInTheDocument();
  });

  it("displays the 'Sample data' label when API_BASE is empty (demo mode)", async () => {
    vi.spyOn(constants, "API_BASE", "get").mockReturnValue("");

    renderMarketplace();

    await waitFor(() => {
      expect(screen.getByText("Sample data")).toBeInTheDocument();
    });
  });

  describe("Server query parameters (Issue #1328)", () => {
    it("sends search param after debounce when in backend mode (Scenario 1)", async () => {
      vi.spyOn(constants, "API_BASE", "get").mockReturnValue("https://api.callora.com");
      const fetchCatalogSpy = vi
        .spyOn(catalogApiModule, "fetchCatalog")
        .mockResolvedValue(TEST_BACKEND_APIS);

      renderMarketplace();

      await waitFor(() => {
        expect(fetchCatalogSpy).toHaveBeenCalledTimes(1);
      });

      const searchInput = screen.getByRole("searchbox");
      await userEvent.type(searchInput, "geo");

      await waitFor(
        () => {
          expect(fetchCatalogSpy).toHaveBeenCalledWith(
            expect.any(AbortSignal),
            expect.objectContaining({ search: "geo" }),
          );
        },
        { timeout: 1500 },
      );
    });

    it("sends category param when single category selected (Scenario 2)", async () => {
      vi.spyOn(constants, "API_BASE", "get").mockReturnValue("https://api.callora.com");
      const fetchCatalogSpy = vi
        .spyOn(catalogApiModule, "fetchCatalog")
        .mockResolvedValue(TEST_BACKEND_APIS);

      renderMarketplace();

      await waitFor(() => {
        expect(fetchCatalogSpy).toHaveBeenCalledTimes(1);
      });

      const checkbox = screen.getByLabelText("Security");
      await userEvent.click(checkbox);

      await waitFor(() => {
        expect(fetchCatalogSpy).toHaveBeenCalledWith(
          expect.any(AbortSignal),
          expect.objectContaining({ category: "Security" }),
        );
      });
    });

    it("fetches without category param when multiple categories selected (Scenario 3)", async () => {
      vi.spyOn(constants, "API_BASE", "get").mockReturnValue("https://api.callora.com");
      const fetchCatalogSpy = vi
        .spyOn(catalogApiModule, "fetchCatalog")
        .mockResolvedValue(TEST_BACKEND_APIS);

      renderMarketplace();

      await waitFor(() => {
        expect(fetchCatalogSpy).toHaveBeenCalledTimes(1);
      });

      const checkbox1 = screen.getByLabelText("Security");
      const checkbox2 = screen.getByLabelText("Data & Analytics");
      await userEvent.click(checkbox1);
      await userEvent.click(checkbox2);

      await waitFor(() => {
        expect(fetchCatalogSpy).toHaveBeenLastCalledWith(
          expect.any(AbortSignal),
          expect.not.objectContaining({ category: expect.anything() }),
        );
      });
    });

    it("does not send server queries in demo mode (Scenario 5)", async () => {
      vi.spyOn(constants, "API_BASE", "get").mockReturnValue("");
      const fetchCatalogSpy = vi
        .spyOn(catalogApiModule, "fetchCatalog")
        .mockResolvedValue(TEST_BACKEND_APIS);

      renderMarketplace();

      await waitFor(() => {
        expect(fetchCatalogSpy).toHaveBeenCalledTimes(1);
      });

      const searchInput = screen.getByRole("searchbox");
      await userEvent.type(searchInput, "geo");

      // In demo mode, fetchCatalog is not called again on typing
      expect(fetchCatalogSpy).toHaveBeenCalledTimes(1);
    });

    it("omits whitespace-only search param (Scenario 8)", async () => {
      vi.spyOn(constants, "API_BASE", "get").mockReturnValue("https://api.callora.com");
      const fetchCatalogSpy = vi
        .spyOn(catalogApiModule, "fetchCatalog")
        .mockResolvedValue(TEST_BACKEND_APIS);

      renderMarketplace();

      await waitFor(() => {
        expect(fetchCatalogSpy).toHaveBeenCalledTimes(1);
      });

      const searchInput = screen.getByRole("searchbox");
      await userEvent.type(searchInput, "   ");

      await waitFor(() => {
        expect(fetchCatalogSpy).toHaveBeenLastCalledWith(
          expect.any(AbortSignal),
          {},
        );
      });
    });
  });
});
