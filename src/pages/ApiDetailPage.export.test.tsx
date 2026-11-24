// @vitest-environment jsdom

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ApiDetailPage from "./ApiDetailPage";
import { ToastProvider } from "../components/Toast";
import * as catalogApi from "../api/catalogApi";

vi.mock("../api/catalogApi", () => ({
  fetchApiDetail: vi.fn(),
  fetchCatalog: vi.fn(),
  isCatalogAbortError: vi.fn(() => false),
}));

vi.mock("../components/HealthTimeline", () => ({
  default: () => null,
}));

vi.mock("../hooks/useApiHealth", () => ({
  useApiHealth: () => ({ status: "idle", data: null, error: null }),
}));

vi.mock("../state/collectionsStore", () => ({
  useCollections: () => ({
    collections: [],
    collectionIdsForEndpoint: () => new Set<string>(),
    isEndpointSaved: () => false,
    addEndpointToCollection: vi.fn(),
    removeEndpointFromCollection: vi.fn(),
    createCollectionWithEndpoint: vi.fn(),
  }),
}));

const MOCK_API = {
  id: "weather-pro",
  name: "Weather Pro API",
  description: "Forecasts and alerts",
  category: "Weather",
  provider: "Callora",
  rating: 4.8,
  reviewCount: 12,
  pricePerCall: 0.001,
  stats: { totalCalls: 1000, avgResponseMs: 42, uptimePct: 99.9 },
  endpoints: [
    {
      id: "ep-1",
      title: "Get Forecast",
      url: "/v1/forecast",
      method: "GET",
      group: "Forecast",
      params: [{ name: "city", type: "string", required: true }],
    },
    {
      id: "ep-2",
      title: "Create Alert",
      url: "/v1/alerts",
      method: "POST",
      group: "Alerts",
      params: [],
    },
  ],
  reviews: [],
};

function renderPage(apiId = "weather-pro") {
  return render(
    <MemoryRouter initialEntries={[`/apis/${apiId}`]}>
      <ToastProvider>
        <Routes>
          <Route path="/apis/:id" element={<ApiDetailPage />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("ApiDetailPage - Export all endpoints", () => {
  const createObjectURL = vi.fn(() => "blob:mock-postman-url");
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(catalogApi.fetchCatalog).mockResolvedValue([]);
    globalThis.URL.createObjectURL = createObjectURL;
    globalThis.URL.revokeObjectURL = revokeObjectURL;
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("downloads a Postman collection blob and shows a success toast when clicked", async () => {
    vi.mocked(catalogApi.fetchApiDetail).mockResolvedValue({
      status: "ready",
      api: MOCK_API,
    } as any);

    renderPage();

    const docTab = await screen.findByRole("tab", { name: /documentation/i });
    fireEvent.click(docTab);

    const exportBtn = await screen.findByRole("button", {
      name: /export all endpoints as postman collection/i,
    });
    expect(exportBtn).not.toBeDisabled();

    fireEvent.click(exportBtn);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-postman-url");

    await waitFor(() => {
      expect(
        screen.getByText(/exported 2 endpoints to weather-pro\.postman_collection\.json/i),
      ).toBeInTheDocument();
    });
  });

  it("disables the Export all endpoints button when the API has no endpoints", async () => {
    vi.mocked(catalogApi.fetchApiDetail).mockResolvedValue({
      status: "ready",
      api: {
        ...MOCK_API,
        id: "empty-api",
        endpoints: [],
      },
    } as any);

    renderPage("empty-api");

    const docTab = await screen.findByRole("tab", { name: /documentation/i });
    fireEvent.click(docTab);

    const exportBtn = await screen.findByRole("button", {
      name: /export all endpoints as postman collection/i,
    });
    expect(exportBtn).toBeDisabled();
    fireEvent.click(exportBtn);
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});
