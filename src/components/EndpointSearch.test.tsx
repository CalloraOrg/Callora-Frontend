// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EndpointSearch from "./EndpointSearch";

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_ENDPOINTS = [
  {
    id: "forecast",
    title: "Get Forecast",
    url: "/v1/forecast",
    method: "GET",
    group: "Forecast",
    apiName: "WeatherSim API",
  },
  {
    id: "history",
    title: "Historical Weather",
    url: "/v1/history",
    method: "GET",
    group: "Forecast",
    apiName: "WeatherSim API",
  },
  {
    id: "alerts-create",
    title: "Create Weather Alert",
    url: "/v1/alerts",
    method: "POST",
    group: "Alerts",
    apiName: "WeatherSim API",
  },
  {
    id: "payment-create",
    title: "Create Payment",
    url: "/v1/payments",
    method: "POST",
    group: "Payments",
    apiName: "QuickPay",
  },
  {
    id: "payment-delete",
    title: "Cancel Payment",
    url: "/v1/payments/{id}",
    method: "DELETE",
    group: "Payments",
    apiName: "QuickPay",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderSearch(props?: Partial<React.ComponentProps<typeof EndpointSearch>>) {
  return render(
    <EndpointSearch endpoints={MOCK_ENDPOINTS} {...props} />
  );
}

/** Get the search input element (inner <input> inside the combobox). */
function getSearchInput() {
  return screen.getByPlaceholderText(/Search endpoints/i) as HTMLInputElement;
}

/** Get the search input with a custom placeholder. */
function getSearchInputByPlaceholder(placeholder: string) {
  return screen.getByPlaceholderText(placeholder) as HTMLInputElement;
}

/** Type text into the search input. */
function typeQuery(text: string) {
  const input = getSearchInput();
  fireEvent.change(input, { target: { value: text } });
  return input;
}

/** Get the combobox outer div. */
function getCombobox() {
  return screen.getByRole("combobox");
}

// ── Tests ─────────────────────────────────────────────────────────────────────

afterEach(() => {
  cleanup();
});

describe("EndpointSearch", () => {
  // ── Rendering ──────────────────────────────────────────────────────────────

  describe("rendering", () => {
    it("renders a combobox with the search input", () => {
      renderSearch();
      const combobox = getCombobox();
      expect(combobox).toBeTruthy();
      expect(combobox.getAttribute("aria-haspopup")).toBe("listbox");
    });

    it("renders the placeholder text", () => {
      renderSearch();
      const input = getSearchInput();
      expect(input.getAttribute("placeholder")).toBe("Search endpoints...");
    });

    it("accepts a custom placeholder via props", () => {
      renderSearch({ placeholder: "Find an API..." });
      const input = getSearchInputByPlaceholder("Find an API...");
      expect(input.getAttribute("placeholder")).toBe("Find an API...");
    });

    it("renders the search icon", () => {
      const { container } = renderSearch();
      const svg = container.querySelector("svg");
      expect(svg).toBeTruthy();
    });
  });

  // ── Search & filtering ─────────────────────────────────────────────────────

  describe("search and filtering", () => {
    it("shows the listbox when the query has enough characters", () => {
      renderSearch();
      typeQuery("fore");
      const listbox = screen.getByRole("listbox", { name: /Filtered endpoints/i });
      expect(listbox).toBeTruthy();
    });

    it("does NOT show the listbox when query is empty", () => {
      renderSearch();
      typeQuery("");
      expect(screen.queryByRole("listbox")).toBeNull();
    });

    it("does NOT show the listbox when query is below minQueryLength", () => {
      renderSearch({ minQueryLength: 3 });
      typeQuery("fo");
      expect(screen.queryByRole("listbox")).toBeNull();
    });

    it("shows the listbox when query meets minQueryLength", () => {
      renderSearch({ minQueryLength: 2 });
      typeQuery("fo");
      const listbox = screen.getByRole("listbox", { name: /Filtered endpoints/i });
      expect(listbox).toBeTruthy();
    });

    it("filters endpoints by title match", () => {
      renderSearch();
      typeQuery("Forecast");
      const options = screen.getAllByRole("option");
      expect(options.length).toBe(2);
      expect(options[0].textContent).toContain("Get Forecast");
    });

    it("filters endpoints by URL match", () => {
      renderSearch();
      typeQuery("/v1/payments");
      const options = screen.getAllByRole("option");
      expect(options.length).toBe(2);
      // First result alphabetically is Cancel Payment
      expect(options[0].textContent).toContain("Cancel Payment");
      expect(options[1].textContent).toContain("Create Payment");
    });

    it("filters endpoints by group name", () => {
      renderSearch();
      typeQuery("Alerts");
      const options = screen.getAllByRole("option");
      expect(options.length).toBe(1);
      expect(options[0].textContent).toContain("Create Weather Alert");
    });

    it("filters endpoints by API name", () => {
      renderSearch();
      typeQuery("QuickPay");
      const options = screen.getAllByRole("option");
      expect(options.length).toBe(2);
      expect(options[0].textContent).toContain("Cancel Payment");
    });

    it("shows 'No endpoints found' when nothing matches", () => {
      renderSearch();
      typeQuery("zzzzz");
      // Use getAllByText and check the listbox has the text
      const listbox = screen.getByRole("listbox", { name: /Filtered endpoints/i });
      expect(listbox.textContent).toContain("No endpoints found");
    });

    it("respects maxResults prop", () => {
      renderSearch({ maxResults: 1 });
      typeQuery("GET");
      const options = screen.getAllByRole("option");
      expect(options.length).toBeLessThanOrEqual(1);
    });
  });

  // ── Selection & interaction ─────────────────────────────────────────────────

  describe("selection and interaction", () => {
    it("calls onSelect with the endpoint when an option is clicked", () => {
      const onSelect = vi.fn();
      renderSearch({ onSelect });
      typeQuery("Forecast");
      const option = screen.getByText("Get Forecast");
      fireEvent.click(option);
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ id: "forecast", title: "Get Forecast" })
      );
    });

    it("clears the query and closes the listbox after selection", async () => {
      const onSelect = vi.fn();
      renderSearch({ onSelect });
      typeQuery("Forecast");
      const option = screen.getByText("Get Forecast");
      fireEvent.click(option);
      const input = getSearchInput();
      expect(input.value).toBe("");
      // The listbox may re-open briefly due to focus/blur race; use waitFor
      const { waitFor } = await import("@testing-library/react");
      await waitFor(() => {
        expect(screen.queryByRole("listbox")).toBeNull();
      });
    });

    it("sets aria-expanded correctly", () => {
      renderSearch();
      const combobox = getCombobox();
      expect(combobox.getAttribute("aria-expanded")).toBe("false");
      typeQuery("fore");
      expect(combobox.getAttribute("aria-expanded")).toBe("true");
      const input = getSearchInput();
      fireEvent.change(input, { target: { value: "" } });
      expect(combobox.getAttribute("aria-expanded")).toBe("false");
    });

    it("sets aria-activedescendant on keyboard navigation", () => {
      renderSearch();
      typeQuery("fore");
      const input = getSearchInput();
      fireEvent.keyDown(input, { key: "ArrowDown" });
      const combobox = getCombobox();
      const descId = combobox.getAttribute("aria-activedescendant");
      expect(descId).toBeTruthy();
      expect(descId).toContain("option-0");
    });

    it("selects the active option on Enter", () => {
      const onSelect = vi.fn();
      renderSearch({ onSelect });
      typeQuery("fore");
      const input = getSearchInput();
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "Enter" });
      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it("closes the listbox on Escape", () => {
      renderSearch();
      typeQuery("fore");
      expect(screen.getByRole("listbox")).toBeTruthy();
      const input = getSearchInput();
      fireEvent.keyDown(input, { key: "Escape" });
      expect(screen.queryByRole("listbox")).toBeNull();
    });

    it("shows method badge text for each option", () => {
      renderSearch();
      typeQuery("fore");
      const options = screen.getAllByRole("option");
      // The method badge is a nested span with monospace text
      // Check that each option contains at least one uppercase method
      const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"];
      options.forEach((option) => {
        const hasMethod = methods.some((m) => option.textContent?.includes(m));
        expect(hasMethod).toBe(true);
      });
    });
  });

  // ── Keyboard navigation ────────────────────────────────────────────────────

  describe("keyboard navigation", () => {
    it("ArrowDown cycles through options", () => {
      renderSearch();
      typeQuery("fore");
      const input = getSearchInput();
      fireEvent.keyDown(input, { key: "ArrowDown" });
      const combobox = getCombobox();
      expect(combobox.getAttribute("aria-activedescendant")).toContain("option-0");
      fireEvent.keyDown(input, { key: "ArrowDown" });
      expect(combobox.getAttribute("aria-activedescendant")).toContain("option-1");
    });

    it("ArrowUp moves backwards through options", () => {
      renderSearch();
      typeQuery("fore");
      const input = getSearchInput();
      fireEvent.keyDown(input, { key: "ArrowUp" });
      const combobox = getCombobox();
      const lastIndex = combobox.getAttribute("aria-activedescendant");
      expect(lastIndex).toBeTruthy();
      fireEvent.keyDown(input, { key: "ArrowUp" });
      const prevIndex = combobox.getAttribute("aria-activedescendant");
      expect(prevIndex).not.toBe(lastIndex);
    });

    it("Home and End navigate to first and last options (with Ctrl/Meta)", () => {
      renderSearch();
      typeQuery("fore");
      const input = getSearchInput();
      fireEvent.keyDown(input, { key: "Home", ctrlKey: true });
      const combobox = getCombobox();
      expect(combobox.getAttribute("aria-activedescendant")).toContain("option-0");
      fireEvent.keyDown(input, { key: "End", ctrlKey: true });
      const options = screen.getAllByRole("option");
      expect(combobox.getAttribute("aria-activedescendant")).toContain(
        `option-${options.length - 1}`
      );
    });
  });

  // ── Accessibility ──────────────────────────────────────────────────────────

  describe("accessibility", () => {
    it("combobox has aria-haspopup set to listbox", () => {
      renderSearch();
      const combobox = getCombobox();
      expect(combobox.getAttribute("aria-haspopup")).toBe("listbox");
    });

    it("combobox has aria-controls pointing to the listbox", () => {
      renderSearch();
      typeQuery("fore");
      const combobox = getCombobox();
      const listbox = screen.getByRole("listbox", { name: /Filtered endpoints/i });
      expect(combobox.getAttribute("aria-controls")).toBe(listbox.id);
    });

    it("listbox renders options with role='option' and aria-selected", () => {
      renderSearch();
      typeQuery("fore");
      const options = screen.getAllByRole("option");
      options.forEach((option) => {
        expect(option.getAttribute("role")).toBe("option");
        expect(option.hasAttribute("aria-selected")).toBe(true);
      });
    });

    it("provides a clear button with accessible label", () => {
      renderSearch();
      typeQuery("test");
      const clearBtn = screen.getByRole("button", { name: /Clear search/i });
      expect(clearBtn).toBeTruthy();
    });

    it("clear button resets the input", async () => {
      renderSearch();
      typeQuery("forecast");
      const clearBtn = screen.getByRole("button", { name: /Clear search/i });
      fireEvent.click(clearBtn);
      const input = getSearchInput();
      expect(input.value).toBe("");
      const { waitFor } = await import("@testing-library/react");
      await waitFor(() => {
        expect(screen.queryByRole("listbox")).toBeNull();
      });
    });

    it("input has aria-autocomplete set to list", () => {
      renderSearch();
      const input = getSearchInput();
      expect(input.getAttribute("aria-autocomplete")).toBe("list");
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles empty endpoints array gracefully", () => {
      render(<EndpointSearch endpoints={[]} />);
      typeQuery("test");
      const listbox = screen.getByRole("listbox", { name: /Filtered endpoints/i });
      expect(listbox.textContent).toContain("No endpoints found");
    });

    it("does not crash when onSelect is undefined", () => {
      renderSearch();
      typeQuery("forecast");
      const option = screen.getByText("Get Forecast");
      expect(() => fireEvent.click(option)).not.toThrow();
    });

    it("handles very long query strings", () => {
      renderSearch();
      typeQuery("a".repeat(100));
      const listbox = screen.queryByRole("listbox", { name: /Filtered endpoints/i });
      expect(listbox).toBeTruthy();
    });
  });
});