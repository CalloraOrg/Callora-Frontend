import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import MyApis from "./MyApis";

// ---------------------------------------------------------------------------
// Hoisted fixtures (must be defined before any vi.mock factory that uses them)
// ---------------------------------------------------------------------------

const { MOCK_API_1, MOCK_API_2 } = vi.hoisted(() => {
  const MOCK_API_1 = {
    id: "weather-001",
    name: "WeatherSim API",
    provider: { name: "Acme Labs" },
    status: "operational" as const,
    description: "Weather forecast API",
    pricePerRequest: 0.01,
    pricePerCall: 0.01,
  };

  const MOCK_API_2 = {
    id: "geo-002",
    name: "GeoLocate API",
    provider: { name: "Acme Labs" },
    status: "degraded" as const,
    description: "Geocoding API",
    pricePerRequest: 0.005,
    pricePerCall: 0.005,
  };

  return { MOCK_API_1, MOCK_API_2 };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../hooks/useDocumentTitle", () => ({
  default: vi.fn(),
}));

// Replace MOCK_APIS with the two controlled fixtures so fetch results are
// deterministic.  Individual tests further override via vi.spyOn when needed.
vi.mock("../data/mockApis", async () => {
  const actual = await vi.importActual<typeof import("../data/mockApis")>(
    "../data/mockApis"
  );
  return {
    ...actual,
    MOCK_APIS: [MOCK_API_1, MOCK_API_2],
  };
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function renderMyApis() {
  return render(
    <MemoryRouter>
      <MyApis />
    </MemoryRouter>
  );
}

// Generous timeout to cover the 300 ms stub delay + React scheduling.
const WAIT_OPTS = { timeout: 2000 };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MyApis page", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1. Loading skeleton ───────────────────────────────────────────────────

  it("renders skeleton rows while the request is in flight", () => {
    renderMyApis();

    // Before the 300 ms stub resolves the skeleton must be present.
    expect(screen.getByTestId("my-apis-skeleton")).toBeTruthy();
    expect(screen.queryByTestId("my-apis-list")).toBeNull();
    expect(screen.queryByText("No APIs published yet")).toBeNull();
  });

  // ── 2. Populated list ─────────────────────────────────────────────────────

  it("renders one row per API with name, status badge, and price after load", async () => {
    renderMyApis();

    await waitFor(
      () => expect(screen.getByTestId("my-apis-list")).toBeTruthy(),
      WAIT_OPTS
    );

    // Both API names are visible.
    expect(screen.getByText("WeatherSim API")).toBeTruthy();
    expect(screen.getByText("GeoLocate API")).toBeTruthy();

    // Status badges (aria-label on the StatusBadge span).
    expect(screen.getByLabelText("Operational")).toBeTruthy();
    expect(screen.getByLabelText("Degraded")).toBeTruthy();

    // Prices — formatPrice(0.01) → "0.010", formatPrice(0.005) → "0.005"
    expect(screen.getByText("$0.010")).toBeTruthy();
    expect(screen.getByText("$0.005")).toBeTruthy();
  });

  // ── 3. Detail links ───────────────────────────────────────────────────────

  it("each row links to /details/:id", async () => {
    renderMyApis();

    await waitFor(
      () => expect(screen.getByTestId("my-apis-list")).toBeTruthy(),
      WAIT_OPTS
    );

    const row1 = screen.getByTestId("api-row-weather-001") as HTMLAnchorElement;
    const row2 = screen.getByTestId("api-row-geo-002") as HTMLAnchorElement;

    expect(row1.getAttribute("href")).toBe("/details/weather-001");
    expect(row2.getAttribute("href")).toBe("/details/geo-002");
  });

  // ── 4. Empty state (zero results) ─────────────────────────────────────────

  it("renders the empty state when the provider has no published APIs", async () => {
    const mockApis = await import("../data/mockApis");
    // Provider name doesn't match PROVIDER_ID → filter returns [].
    vi.spyOn(mockApis, "MOCK_APIS", "get").mockReturnValue([
      { ...MOCK_API_1, provider: { name: "Someone Else" } },
    ] as typeof mockApis.MOCK_APIS);

    renderMyApis();

    await waitFor(
      () => expect(screen.getByText("No APIs published yet")).toBeTruthy(),
      WAIT_OPTS
    );

    expect(
      screen.getByText(/You haven't listed any APIs on the marketplace/i)
    ).toBeTruthy();
    expect(screen.queryByTestId("my-apis-list")).toBeNull();
    expect(screen.queryByTestId("my-apis-skeleton")).toBeNull();
  });

  // ── 5. Empty state CTA ────────────────────────────────────────────────────

  it("navigates to /publish when 'Publish your first API' is clicked", async () => {
    const mockApis = await import("../data/mockApis");
    vi.spyOn(mockApis, "MOCK_APIS", "get").mockReturnValue(
      [] as unknown as typeof mockApis.MOCK_APIS
    );

    renderMyApis();

    const cta = await waitFor(
      () => screen.getByRole("button", { name: /Publish your first API/i }),
      WAIT_OPTS
    );

    fireEvent.click(cta);
    expect(mockNavigate).toHaveBeenCalledWith("/publish");
  });

  // ── 6. Error state ────────────────────────────────────────────────────────

  it("renders an error empty-state when the fetch rejects", async () => {
    const mockApis = await import("../data/mockApis");
    // Throwing inside the getter causes the timer callback to reject.
    vi.spyOn(mockApis, "MOCK_APIS", "get").mockImplementation(() => {
      throw new Error("Network failure");
    });

    renderMyApis();

    await waitFor(
      () => expect(screen.getByText("Failed to load your APIs")).toBeTruthy(),
      WAIT_OPTS
    );

    expect(
      screen.getByText(/couldn't retrieve your published APIs/i)
    ).toBeTruthy();
    expect(screen.queryByTestId("my-apis-list")).toBeNull();
    expect(screen.queryByTestId("my-apis-skeleton")).toBeNull();
  });

  // ── 7. Error → retry → success ────────────────────────────────────────────

  it("shows the list after clicking Retry following an error", async () => {
    const mockApis = await import("../data/mockApis");
    let callCount = 0;

    vi.spyOn(mockApis, "MOCK_APIS", "get").mockImplementation(() => {
      callCount++;
      if (callCount === 1) throw new Error("Network failure");
      return [MOCK_API_1] as unknown as typeof mockApis.MOCK_APIS;
    });

    renderMyApis();

    // Wait for the error state.
    await waitFor(
      () => expect(screen.getByText("Failed to load your APIs")).toBeTruthy(),
      WAIT_OPTS
    );

    const retryBtn = screen.getByRole("button", { name: /retry/i });
    fireEvent.click(retryBtn);

    // After retry the list should appear.
    await waitFor(
      () => expect(screen.getByTestId("my-apis-list")).toBeTruthy(),
      WAIT_OPTS
    );

    expect(screen.getByText("WeatherSim API")).toBeTruthy();
  });

  // ── 8. Publish-status pills ───────────────────────────────────────────────

  it("renders Live / Pending / Rejected pills across three rows", async () => {
    const mockApis = await import("../data/mockApis");
    vi.spyOn(mockApis, "MOCK_APIS", "get").mockReturnValue([
      MOCK_API_1,
      MOCK_API_2,
      { ...MOCK_API_1, id: "extra-003", name: "Extra API" },
    ] as unknown as typeof mockApis.MOCK_APIS);

    renderMyApis();

    await waitFor(
      () => expect(screen.getByTestId("my-apis-list")).toBeTruthy(),
      WAIT_OPTS
    );

    // publish statuses cycle: live → pending → rejected
    expect(screen.getByText("Live")).toBeTruthy();
    expect(screen.getByText("Pending")).toBeTruthy();
    expect(screen.getByText("Rejected")).toBeTruthy();
  });
});
