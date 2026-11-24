import { act, render, screen, waitFor } from "@testing-library/react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import MarketplacePage from "./MarketplacePage";
import { ToastProvider } from "../components/Toast";
import { CollectionsProvider } from "../state/collectionsStore";
import * as catalogApiModule from "../api/catalogApi";
import * as constants from "../config/constants";
import { setCache } from "../utils/offlineApiCache";
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

function renderMarketplace(initialEntries: string[] = ["/"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
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

  describe("ActiveFilterChips integration (Issue #1400)", () => {
    it("renders active chips when category is filtered and removing chip updates results and live region", async () => {
      vi.spyOn(constants, "API_BASE", "get").mockReturnValue("https://api.callora.com");
      vi.spyOn(catalogApiModule, "fetchCatalog").mockResolvedValue(TEST_BACKEND_APIS);

      renderMarketplace(["/?categories=Security"]);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Remove filter: Category Security" })).toBeInTheDocument();
      });

      const grid = document.querySelector(".marketplace-grid")!;
      expect(grid).toBeInTheDocument();
      expect(within(grid).getByText("Enterprise KYC Verifier")).toBeInTheDocument();
      expect(within(grid).queryByText("Live Blockchain Indexer")).not.toBeInTheDocument();

      // Remove the chip
      const removeBtn = screen.getByRole("button", {
        name: "Remove filter: Category Security",
      });
      await userEvent.click(removeBtn);

      // Now both APIs are visible in the grid and chip is gone
      await waitFor(() => {
        expect(screen.queryByRole("button", { name: "Remove filter: Category Security" })).not.toBeInTheDocument();
        expect(within(grid).getByText("Live Blockchain Indexer")).toBeInTheDocument();
      });

      // Announcement in live region
      await waitFor(() => {
        expect(screen.getByText(/Removed filter Category Security/i)).toBeInTheDocument();
      });
    });

    it("renders chips for status, tag, and price and clicking Clear all resets them", async () => {
      vi.spyOn(constants, "API_BASE", "get").mockReturnValue("https://api.callora.com");
      vi.spyOn(catalogApiModule, "fetchCatalog").mockResolvedValue(TEST_BACKEND_APIS);

      renderMarketplace(["/?statuses=operational&tag=events&minPrice=1"]);

      await waitFor(() => {
        expect(screen.getByText("Status: Operational")).toBeInTheDocument();
        expect(screen.getByText("Tag: events")).toBeInTheDocument();
        expect(screen.getByText("Min price: $1")).toBeInTheDocument();
      });

      const clearAllBtn = screen.getByRole("button", { name: "Clear all" });
      await userEvent.click(clearAllBtn);

      await waitFor(() => {
        expect(screen.queryByRole("button", { name: "Clear all" })).not.toBeInTheDocument();
      });
    });

    it("renders inverted price range as inactive chips without filtering results", async () => {
      vi.spyOn(constants, "API_BASE", "get").mockReturnValue("https://api.callora.com");
      vi.spyOn(catalogApiModule, "fetchCatalog").mockResolvedValue(TEST_BACKEND_APIS);

      renderMarketplace(["/?minPrice=50&maxPrice=10"]);

      await waitFor(() => {
        const minChip = screen.getByTestId("filter-chip-minPrice");
        const maxChip = screen.getByTestId("filter-chip-maxPrice");
        expect(minChip).toHaveClass("filter-chip--inactive");
        expect(maxChip).toHaveClass("filter-chip--inactive");
        expect(minChip).toHaveAttribute("title", "Min price exceeds max price; price filter is inactive");
      });

      // Inverted price skips price filtering, so both APIs are still displayed in grid
      const grid = document.querySelector(".marketplace-grid")!;
      expect(within(grid).getByText("Live Blockchain Indexer")).toBeInTheDocument();
      expect(within(grid).getByText("Enterprise KYC Verifier")).toBeInTheDocument();
    });
  });
});

describe("Offline reconnect (Issue #1403)", () => {
  const originalOnLine = navigator.onLine;

  function setOnline(value: boolean) {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value,
    });
  }

  afterEach(() => {
    setOnline(originalOnLine);
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("refetches a stale catalogue once connectivity returns", async () => {
    vi.spyOn(constants, "API_BASE", "get").mockReturnValue("https://api.callora.com");
    setCache("marketplace", catalogApiModule.buildCacheKey({}), TEST_BACKEND_APIS);
    setOnline(false);

    const fetchCatalogSpy = vi
      .spyOn(catalogApiModule, "fetchCatalog")
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValue(TEST_BACKEND_APIS);

    renderMarketplace();

    await waitFor(() => {
      expect(screen.getByText(/Showing saved results/i)).toBeInTheDocument();
    });
    expect(fetchCatalogSpy).toHaveBeenCalledTimes(1);

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => {
      expect(fetchCatalogSpy).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.queryByText(/Showing saved results/i)).not.toBeInTheDocument();
    });
  });

  it("does not refetch when the catalogue was never stale", async () => {
    vi.spyOn(constants, "API_BASE", "get").mockReturnValue("https://api.callora.com");
    setOnline(false);

    const fetchCatalogSpy = vi
      .spyOn(catalogApiModule, "fetchCatalog")
      .mockResolvedValue(TEST_BACKEND_APIS);

    renderMarketplace();
    await waitFor(() => expect(fetchCatalogSpy).toHaveBeenCalledTimes(1));

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => {
      expect(screen.getAllByText("Live Blockchain Indexer").length).toBeGreaterThan(0);
    });
    expect(fetchCatalogSpy).toHaveBeenCalledTimes(1);
  });
});
