import { render, screen, waitFor } from "@testing-library/react";
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

describe("MarketplacePage backend catalogue integration (Issue #1327)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("lists backend APIs when configured with API_BASE", async () => {
    vi.spyOn(constants, "API_BASE", "get").mockReturnValue("https://api.callora.com");
    vi.spyOn(catalogApiModule, "fetchCatalog").mockResolvedValue(TEST_BACKEND_APIS);

    render(
      <MemoryRouter>
        <ToastProvider>
          <CollectionsProvider>
            <MarketplacePage />
          </CollectionsProvider>
        </ToastProvider>
      </MemoryRouter>,
    );

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

    render(
      <MemoryRouter>
        <ToastProvider>
          <CollectionsProvider>
            <MarketplacePage />
          </CollectionsProvider>
        </ToastProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/The marketplace service is unavailable right now|We encountered an error fetching the marketplace/i),
      ).toBeInTheDocument();
    });

    // Verify mock data is NOT silently displayed when a configured backend fails
    expect(screen.queryByText("GeoLocate")).not.toBeInTheDocument();
  });

  it("displays the 'Sample data' label when API_BASE is empty (demo mode)", async () => {
    vi.spyOn(constants, "API_BASE", "get").mockReturnValue("");

    render(
      <MemoryRouter>
        <ToastProvider>
          <CollectionsProvider>
            <MarketplacePage />
          </CollectionsProvider>
        </ToastProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Sample data")).toBeInTheDocument();
    });
  });
});
