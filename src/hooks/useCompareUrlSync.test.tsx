// @vitest-environment jsdom

import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ToastProvider } from "../components/Toast";
import { compareStore } from "../state/compareStore";
import { catalogApi } from "../api/catalogApi";
import type { APIItem } from "../data/mockApis";
import { useCompareUrlSync } from "./useCompareUrlSync";

vi.mock("../api/catalogApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/catalogApi")>();
  return {
    ...actual,
    catalogApi: {
      ...actual.catalogApi,
      fetchApiDetail: vi.fn(),
    },
  };
});

function makeApi(id: string, name: string): APIItem {
  return {
    id,
    name,
    description: `${name} description`,
    category: "Data",
    pricePerRequest: 0.005,
    endpoints: [],
  } as unknown as APIItem;
}

function Harness() {
  useCompareUrlSync();
  const location = useLocation();
  return <div data-testid="search">{location.search}</div>;
}

function renderWithRoute(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ToastProvider>
        <Harness />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("useCompareUrlSync", () => {
  const fetchApiDetailMock = vi.mocked(catalogApi.fetchApiDetail);

  beforeEach(() => {
    compareStore.clear();
    localStorage.clear();
    fetchApiDetailMock.mockReset();
  });

  afterEach(() => {
    compareStore.clear();
    localStorage.clear();
    cleanup();
  });

  it("hydrates valid APIs, opens the drawer when >= 2 are resolved, and strips ?ids=", async () => {
    const api1 = makeApi("api-1", "Weather API");
    const api2 = makeApi("api-2", "Payment API");

    fetchApiDetailMock.mockImplementation(async (id) => {
      if (id === "api-1") return { status: "ready", api: api1 };
      if (id === "api-2") return { status: "ready", api: api2 };
      return { status: "not-found", kind: "not-found" };
    });

    renderWithRoute("/marketplace?ids=api-1,api-2&q=test");

    await waitFor(() => {
      expect(compareStore.getSnapshot().apis.map((a) => a.id)).toEqual([
        "api-1",
        "api-2",
      ]);
    });

    expect(compareStore.getSnapshot().isOpen).toBe(true);
    expect(screen.getByTestId("search").textContent).toBe("?q=test");
  });

  it("ignores unknown ids, shows a toast with skipped count, and does not open drawer with < 2 valid APIs", async () => {
    const api1 = makeApi("api-1", "Weather API");

    fetchApiDetailMock.mockImplementation(async (id) => {
      if (id === "api-1") return { status: "ready", api: api1 };
      return { status: "not-found", kind: "not-found" };
    });

    renderWithRoute("/marketplace?ids=api-1,unknown-id");

    await waitFor(() => {
      expect(compareStore.getSnapshot().apis.map((a) => a.id)).toEqual(["api-1"]);
    });

    expect(compareStore.getSnapshot().isOpen).toBe(false);
    expect(
      await screen.findByText(
        "1 API from the shared comparison link could not be found and was skipped.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId("search").textContent).toBe("");
  });

  it("does not overwrite an existing selection and notifies via toast", async () => {
    const existing = makeApi("existing-1", "Existing API");
    compareStore.addApi(existing);

    renderWithRoute("/marketplace?ids=api-1,api-2");

    expect(
      await screen.findByText(
        "Comparison already has APIs selected. Clear it first to load a shared link.",
      ),
    ).toBeInTheDocument();

    expect(compareStore.getSnapshot().apis.map((a) => a.id)).toEqual([
      "existing-1",
    ]);
    expect(fetchApiDetailMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("search").textContent).toBe("");
  });

  it("caps at 3 APIs and never exceeds the store limit", async () => {
    fetchApiDetailMock.mockImplementation(async (id) => ({
      status: "ready",
      api: makeApi(id, `API ${id}`),
    }));

    renderWithRoute("/marketplace?ids=a,b,c,d,a");

    await waitFor(() => {
      expect(compareStore.getSnapshot().apis.map((a) => a.id)).toEqual([
        "a",
        "b",
        "c",
      ]);
    });

    expect(compareStore.getSnapshot().isOpen).toBe(true);
    expect(fetchApiDetailMock).toHaveBeenCalledTimes(3);
  });
});
