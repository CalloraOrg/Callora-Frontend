import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom";
import { BrowserRouter } from "react-router-dom";

const originalFetch = global.fetch;

function renderMarketplace(MarketplacePage: React.ComponentType<any>) {
  return render(<MarketplacePage />, { wrapper: BrowserRouter });
}

async function loadMarketplacePage() {
  vi.resetModules();
  const mod = await import("./MarketplacePage");
  return mod.default;
}

describe("MarketplacePage", () => {
  describe("Demo mode (no VITE_API_BASE_URL)", () => {
    let MarketplacePage: React.ComponentType<any>;

    beforeEach(async () => {
      global.fetch = vi.fn();
      vi.stubEnv("VITE_API_BASE_URL", "");
      MarketplacePage = await loadMarketplacePage();
    });

    afterEach(() => {
      global.fetch = originalFetch;
      vi.unstubAllEnvs();
    });

    it("renders without fetching", () => {
      renderMarketplace(MarketplacePage);
      expect(global.fetch).not.toHaveBeenCalled();
      expect(screen.getByText("API Marketplace")).toBeInTheDocument();
    });

    it("filters client-side by search", async () => {
      renderMarketplace(MarketplacePage);
      await waitFor(() => {
        expect(screen.getByText((content) => content.includes("Showing") && content.includes("APIs"))).toBeInTheDocument();
      }, { timeout: 2000 });
      await act(async () => {});

      const searchInput = screen.getByRole("search").querySelector("input") as HTMLInputElement;
      await userEvent.type(searchInput, "Weather");

      await waitFor(() => {
        expect(screen.getByText("WeatherSim API")).toBeInTheDocument();
        expect(screen.queryByText("QuickPay")).not.toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it("filters client-side by category", async () => {
      renderMarketplace(MarketplacePage);
      await waitFor(() => {
        expect(screen.getByText((content) => content.includes("Showing") && content.includes("APIs"))).toBeInTheDocument();
      }, { timeout: 2000 });
      await act(async () => {});

      const checkbox = screen.getByLabelText("Data & Analytics");
      await userEvent.click(checkbox);

      expect(screen.getByText("WeatherSim API")).toBeInTheDocument();
      expect(screen.queryByText("QuickPay")).not.toBeInTheDocument();
    });

    it("filters client-side by multiple categories", async () => {
      renderMarketplace(MarketplacePage);
      await waitFor(() => {
        expect(screen.getByText((content) => content.includes("Showing") && content.includes("APIs"))).toBeInTheDocument();
      }, { timeout: 2000 });
      await act(async () => {});

      const checkbox1 = screen.getByLabelText("Data & Analytics");
      const checkbox2 = screen.getByLabelText("Payment Processing");
      await userEvent.click(checkbox1);
      await userEvent.click(checkbox2);

      expect(screen.getByText("WeatherSim API")).toBeInTheDocument();
      expect(screen.getByText("QuickPay")).toBeInTheDocument();
    });

    it("filters client-side by price range", async () => {
      renderMarketplace(MarketplacePage);
      await waitFor(() => {
        expect(screen.getByText((content) => content.includes("Showing") && content.includes("APIs"))).toBeInTheDocument();
      }, { timeout: 2000 });
      await act(async () => {});

      const minInput = screen.getByPlaceholderText("min");
      const maxInput = screen.getByPlaceholderText("max");
      await userEvent.type(minInput, "0.005");
      await userEvent.type(maxInput, "0.015");

      expect(screen.getByText("WeatherSim API")).toBeInTheDocument();
      expect(screen.queryByText("QuickPay")).not.toBeInTheDocument();
    });

    it("sorts by price ascending", async () => {
      renderMarketplace(MarketplacePage);
      await waitFor(() => {
        expect(screen.getByText((content) => content.includes("Showing") && content.includes("APIs"))).toBeInTheDocument();
      }, { timeout: 2000 });
      await act(async () => {});

      const selects = screen.getAllByRole("combobox");
      const sortSelect = selects[selects.length - 1];
      await userEvent.selectOptions(sortSelect, "priceAsc");

      const cards = screen.getAllByRole("button", { name: /View details for/ });
      // Verify sorting by checking that prices are in ascending order
      const prices = cards.map((card) => {
        const text = card.textContent || "";
        const match = text.match(/\$([\d.]+)\s*\/?\s*call/);
        return match ? parseFloat(match[1]) : Infinity;
      });
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
      }
    });

    it("shows empty state when no results", async () => {
      renderMarketplace(MarketplacePage);
      await waitFor(() => {
        expect(screen.getByText((content) => content.includes("Showing") && content.includes("APIs"))).toBeInTheDocument();
      }, { timeout: 2000 });
      await act(async () => {});

      const searchInput = screen.getByRole("search").querySelector("input") as HTMLInputElement;
      await userEvent.type(searchInput, "nonexistent");

      await waitFor(() => {
        expect(screen.getByText(/No results found/)).toBeInTheDocument();
      }, { timeout: 2000 });
      expect(screen.getByRole("button", { name: /Clear all filters/i })).toBeInTheDocument();
    });

    it("clear filters resets all filters", async () => {
      renderMarketplace(MarketplacePage);
      await waitFor(() => {
        expect(screen.getByText((content) => content.includes("Showing") && content.includes("APIs"))).toBeInTheDocument();
      }, { timeout: 2000 });
      await act(async () => {});

      const searchInput = screen.getByRole("search").querySelector("input") as HTMLInputElement;
      await userEvent.type(searchInput, "Weather");

      await waitFor(() => {
        expect(screen.getByText("WeatherSim API")).toBeInTheDocument();
      }, { timeout: 2000 });

      await userEvent.click(screen.getByRole("button", { name: /Clear filters/i }));

      expect(searchInput.value).toBe("");
      expect(screen.getByText("WeatherSim API")).toBeInTheDocument();
      expect(screen.getByText("QuickPay")).toBeInTheDocument();
    });
  });

  describe("Backend mode (VITE_API_BASE_URL set)", () => {
    const mockResponse = {
      items: [
        { id: "1", name: "Backend API 1", provider: { name: "Provider" }, description: "Desc", pricePerRequest: 0.01, category: "Finance" },
        { id: "2", name: "Backend API 2", provider: { name: "Provider" }, description: "Desc", pricePerRequest: 0.02, category: "Data & Analytics" },
      ],
      total: 2,
      page: 1,
      pageSize: 12,
    };

    let MarketplacePage: React.ComponentType<any>;

    beforeEach(async () => {
      global.fetch = vi.fn();
      vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
      MarketplacePage = await loadMarketplacePage();
    });

    afterEach(() => {
      global.fetch = originalFetch;
      vi.unstubAllEnvs();
    });

    it("fetches catalog on mount", async () => {
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      renderMarketplace(MarketplacePage);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "https://api.example.com/api/apis",
          expect.any(Object)
        );
      });

      await waitFor(() => expect(screen.getByText("Backend API 1")).toBeInTheDocument());
    });

    it("sends search param after debounce", async () => {
      (global.fetch as vi.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      renderMarketplace(MarketplacePage);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });
      (global.fetch as vi.Mock).mockClear();

      const searchInput = screen.getByRole("search").querySelector("input") as HTMLInputElement;
      await userEvent.type(searchInput, "geo");

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "https://api.example.com/api/apis?search=geo",
          expect.any(Object)
        );
      }, { timeout: 1000 });
    });

    it("sends category param when single category selected", async () => {
      (global.fetch as vi.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      renderMarketplace(MarketplacePage);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });
      (global.fetch as vi.Mock).mockClear();

      const checkbox = screen.getByLabelText("Finance");
      await userEvent.click(checkbox);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "https://api.example.com/api/apis?category=Finance",
          expect.any(Object)
        );
      });
    });

    it("does not send category param when multiple categories selected", async () => {
      (global.fetch as vi.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      renderMarketplace(MarketplacePage);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });
      (global.fetch as vi.Mock).mockClear();

      const checkbox1 = screen.getByLabelText("Finance");
      const checkbox2 = screen.getByLabelText("Data & Analytics");
      await userEvent.click(checkbox1);
      await userEvent.click(checkbox2);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "https://api.example.com/api/apis",
          expect.any(Object)
        );
      });
    });

    it("aborts previous request on rapid changes", async () => {
      let resolveFirst: (value: Response) => void;
      const firstPromise = new Promise<Response>((resolve) => {
        resolveFirst = resolve;
      });

      (global.fetch as vi.Mock)
        .mockReturnValueOnce(firstPromise)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        });

      renderMarketplace(MarketplacePage);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      const searchInput = screen.getByRole("search").querySelector("input") as HTMLInputElement;
      await userEvent.type(searchInput, "a");
      await waitFor(() => {}, { timeout: 350 });
      await userEvent.type(searchInput, "ab");
      await waitFor(() => {}, { timeout: 350 });
      await userEvent.type(searchInput, "abc");
      await waitFor(() => {}, { timeout: 350 });

      expect(global.fetch).toHaveBeenCalledTimes(3);

      resolveFirst!({
        ok: true,
        json: () => Promise.resolve({ ...mockResponse, items: [] }),
      });

      await act(async () => {
        await Promise.resolve();
      });
    });

    it("shows error state on fetch failure", async () => {
      (global.fetch as vi.Mock).mockRejectedValueOnce(new Error("Network error"));

      renderMarketplace(MarketplacePage);

      await waitFor(() => {
        expect(screen.getByText(/Failed to fetch/i)).toBeInTheDocument();
      });
      expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
    });

    it("uses cached response on repeat request", async () => {
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      renderMarketplace(MarketplacePage);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      const searchInput = screen.getByRole("search").querySelector("input") as HTMLInputElement;
      await userEvent.type(searchInput, "test");
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      }, { timeout: 1000 });

      (global.fetch as vi.Mock).mockClear();

      searchInput.value = "";
      await userEvent.type(searchInput, "test");
      await waitFor(() => {}, { timeout: 350 });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("omits whitespace-only search param", async () => {
      (global.fetch as vi.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      renderMarketplace(MarketplacePage);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });
      (global.fetch as vi.Mock).mockClear();

      const searchInput = screen.getByRole("search").querySelector("input") as HTMLInputElement;
      await userEvent.type(searchInput, "   ");
      await waitFor(() => {}, { timeout: 350 });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "https://api.example.com/api/apis",
          expect.any(Object)
        );
      });
    });
  });
});