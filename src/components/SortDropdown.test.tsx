// @vitest-environment jsdom
/**
 * Tests for src/components/SortDropdown.tsx
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SortDropdown, {
  VALID_SORT_VALUES,
  type SortValue,
} from "./SortDropdown";

afterEach(cleanup);

// Arrow rendered by the component's option labels is U+2192.
const ARROW = "\u2192";

/** Expected labels for every option exposed by SortDropdown, in render order. */
const EXPECTED_OPTIONS: { value: SortValue; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "popularity", label: "Popularity" },
  { value: "price-asc", label: `Price: low ${ARROW} high` },
  { value: "price-desc", label: `Price: high ${ARROW} low` },
  { value: "latency-asc", label: "Latency ascending" },
  { value: "newest", label: "Newest" },
];

const ACCESSIBLE_NAME = "Sort marketplace results";

function renderSortDropdown(value: SortValue = "popularity", onChange = vi.fn()) {
  return render(<SortDropdown value={value} onChange={onChange} />);
}

function getCombobox() {
  return screen.getByRole("combobox", { name: ACCESSIBLE_NAME });
}

function openListbox() {
  fireEvent.click(getCombobox());
}

describe("SortDropdown - rendering", () => {
  it("renders a combobox with the accessible name 'Sort marketplace results'", () => {
    renderSortDropdown();
    expect(getCombobox()).toBeTruthy();
  });

  it("renders a visible 'Sort by' label wired to the trigger", () => {
    renderSortDropdown();
    expect(screen.getByText("Sort by")).toBeTruthy();
    expect(getCombobox().id).toBe("marketplace-sort");
  });

  it("trigger is closed (aria-expanded=false) before interaction", () => {
    renderSortDropdown();
    expect(getCombobox().getAttribute("aria-expanded")).toBe("false");
  });

  it("does not render a listbox until the trigger is activated", () => {
    renderSortDropdown();
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

describe("SortDropdown - options", () => {
  it("renders all six SORT_OPTIONS with their expected labels", () => {
    renderSortDropdown();
    openListbox();

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(EXPECTED_OPTIONS.length);

    for (const { label } of EXPECTED_OPTIONS) {
      expect(screen.getByRole("option", { name: label })).toBeTruthy();
    }
  });

  it("exposes an option for every value in the SortValue union", () => {
    renderSortDropdown();
    openListbox();

    const renderedLabels = screen
      .getAllByRole("option")
      .map((el) => (el.textContent ?? "").replace(/^\s*\u2713\s*/, "").trim());

    const expectedLabels = EXPECTED_OPTIONS.map((o) => o.label);
    expect(renderedLabels).toEqual(expectedLabels);

    const fixtureValues = new Set(EXPECTED_OPTIONS.map((o) => o.value));
    expect(fixtureValues).toEqual(VALID_SORT_VALUES);
  });

  it("each option carries role=option and aria-selected", () => {
    renderSortDropdown("price-asc");
    openListbox();

    for (const opt of screen.getAllByRole("option")) {
      expect(opt.getAttribute("aria-selected")).toMatch(/^(true|false)$/);
    }
  });
});

describe("SortDropdown - onChange", () => {
  it("calls onChange('latency-asc') when 'Latency ascending' is chosen", () => {
    const onChange = vi.fn();
    renderSortDropdown("popularity", onChange);
    openListbox();

    fireEvent.click(screen.getByRole("option", { name: "Latency ascending" }));

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith("latency-asc");
  });

  it.each(EXPECTED_OPTIONS.map((o) => [o.label, o.value] as const))(
    "calls onChange when '%s' -> %s is clicked",
    (label, value) => {
      const onChange = vi.fn();
      renderSortDropdown("popularity", onChange);
      openListbox();

      fireEvent.click(screen.getByRole("option", { name: label }));

      expect(onChange).toHaveBeenCalledWith(value);
    },
  );

  it("closes the listbox after a selection is committed", () => {
    const onChange = vi.fn();
    renderSortDropdown("popularity", onChange);
    openListbox();

    fireEvent.click(screen.getByRole("option", { name: "Newest" }));

    expect(onChange).toHaveBeenCalledWith("newest");
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

describe("SortDropdown - selected state", () => {
  it("marks the option matching the current value as aria-selected='true'", () => {
    renderSortDropdown("price-asc");
    openListbox();

    const selected = screen.getByRole("option", {
      name: `Price: low ${ARROW} high`,
    });
    expect(selected.getAttribute("aria-selected")).toBe("true");
  });

  it("marks every other option as aria-selected='false'", () => {
    renderSortDropdown("price-asc");
    openListbox();

    const others = screen
      .getAllByRole("option")
      .filter((el) => el.getAttribute("aria-selected") !== "true");

    expect(others).toHaveLength(EXPECTED_OPTIONS.length - 1);
  });

  it("shows the selected option's label on the trigger", () => {
    renderSortDropdown("latency-asc");
    expect(getCombobox().textContent).toContain("Latency ascending");
  });

  it("updates the trigger label when the value prop changes (controlled)", () => {
    const { rerender } = render(
      <SortDropdown value="popularity" onChange={vi.fn()} />,
    );
    expect(getCombobox().textContent).toContain("Popularity");

    rerender(<SortDropdown value="newest" onChange={vi.fn()} />);
    expect(getCombobox().textContent).toContain("Newest");
  });
});

describe("SortDropdown - edge cases", () => {
  it("does not crash when the value is not present in SORT_OPTIONS", () => {
    const invalidValue = "definitely-not-a-sort-value" as SortValue;
    expect(() => renderSortDropdown(invalidValue)).not.toThrow();
    expect(getCombobox()).toBeTruthy();
    expect(screen.queryByRole("option")).toBeNull();
  });

  it("does not call onChange when the listbox is opened and closed without a selection", () => {
    const onChange = vi.fn();
    renderSortDropdown("popularity", onChange);
    openListbox();

    fireEvent.mouseDown(document.body);

    expect(onChange).not.toHaveBeenCalled();
  });
});
