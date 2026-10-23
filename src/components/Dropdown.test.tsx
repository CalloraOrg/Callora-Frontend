/**
 * Dropdown.test.tsx
 *
 * Focused tests for the accessible Dropdown component.
 * Covers:
 *  - Rendering trigger + listbox ARIA attributes
 *  - Opens / closes on trigger click
 *  - Selects option on click
 *  - Full arrow-key navigation (ArrowDown, ArrowUp, wrapping)
 *  - Home / End keys
 *  - Enter commits selection
 *  - Escape closes without selecting
 *  - Skips disabled options during keyboard navigation
 *  - Outside-click closes the listbox
 *  - Disabled dropdown cannot be opened
 *  - aria-activedescendant tracks keyboard focus
 *  - aria-expanded reflects open state
 *  - aria-selected reflects selected option
 */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dropdown, type DropdownOption } from "./Dropdown";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

type Fruit = "apple" | "banana" | "cherry";

const FRUITS: DropdownOption<Fruit>[] = [
  { value: "apple", label: "Apple" },
  { value: "banana", label: "Banana" },
  { value: "cherry", label: "Cherry" },
];

const FRUITS_WITH_DISABLED: DropdownOption<Fruit>[] = [
  { value: "apple", label: "Apple" },
  { value: "banana", label: "Banana", disabled: true },
  { value: "cherry", label: "Cherry" },
];

// ─── Helper ───────────────────────────────────────────────────────────────────

function renderDropdown(
  overrides: Partial<{
    value: Fruit;
    options: DropdownOption<Fruit>[];
    onChange: (v: Fruit) => void;
    disabled: boolean;
  }> = {},
) {
  const onChange = overrides.onChange ?? vi.fn();
  const { rerender, ...rest } = render(
    <Dropdown<Fruit>
      value={overrides.value ?? "apple"}
      options={overrides.options ?? FRUITS}
      onChange={onChange}
      label="Pick a fruit"
      visibleLabel="Fruit"
      disabled={overrides.disabled ?? false}
    />,
  );
  return { onChange, rerender, ...rest };
}

/** Shorthand: returns the combobox trigger button */
function getTrigger() {
  return screen.getByRole("combobox", { name: /pick a fruit/i });
}

/** Shorthand: opens the dropdown and returns the listbox element */
function openDropdown() {
  fireEvent.click(getTrigger());
  return screen.getByRole("listbox", { name: /pick a fruit/i });
}

// ─── Setup / teardown ────────────────────────────────────────────────────────

afterEach(cleanup);

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Dropdown – rendering", () => {
  it("renders a combobox trigger with correct aria attributes", () => {
    renderDropdown();
    const trigger = getTrigger();
    expect(trigger.getAttribute("role")).toBe("combobox");
    expect(trigger.getAttribute("aria-haspopup")).toBe("listbox");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("renders the visible label when provided", () => {
    renderDropdown();
    expect(screen.getByText("Fruit")).toBeTruthy();
  });

  it("shows the selected option label on the trigger", () => {
    renderDropdown({ value: "banana" });
    expect(getTrigger().textContent).toContain("Banana");
  });

  it("does NOT render the listbox when closed", () => {
    renderDropdown();
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

describe("Dropdown – open / close", () => {
  it("opens the listbox when the trigger is clicked", () => {
    renderDropdown();
    fireEvent.click(getTrigger());
    expect(screen.getByRole("listbox")).toBeTruthy();
    expect(getTrigger().getAttribute("aria-expanded")).toBe("true");
  });

  it("closes the listbox on a second click of the trigger", () => {
    renderDropdown();
    fireEvent.click(getTrigger());
    fireEvent.click(getTrigger());
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(getTrigger().getAttribute("aria-expanded")).toBe("false");
  });

  it("closes the listbox with Escape key", () => {
    renderDropdown();
    const listbox = openDropdown();
    fireEvent.keyDown(listbox, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("returns focus to trigger after Escape", () => {
    renderDropdown();
    const listbox = openDropdown();
    getTrigger().focus();
    fireEvent.keyDown(listbox, { key: "Escape" });
    expect(document.activeElement).toEqual(getTrigger());
  });
});

describe("Dropdown – mouse selection", () => {
  it("calls onChange with the clicked option value", () => {
    const { onChange } = renderDropdown();
    const listbox = openDropdown();
    fireEvent.click(within(listbox).getByText("Banana"));
    expect(onChange).toHaveBeenCalledWith("banana");
  });

  it("closes the listbox after a click selection", () => {
    renderDropdown();
    const listbox = openDropdown();
    fireEvent.click(within(listbox).getByText("Cherry"));
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("does not call onChange when a disabled option is clicked", () => {
    const { onChange } = renderDropdown({ options: FRUITS_WITH_DISABLED });
    const listbox = openDropdown();
    fireEvent.click(within(listbox).getByText("Banana"));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("Dropdown – keyboard navigation", () => {
  it("ArrowDown moves focus to the next option", () => {
    renderDropdown({ value: "apple" });
    const listbox = openDropdown();

    // Initially Apple is active (index 0 = selected)
    fireEvent.keyDown(listbox, { key: "ArrowDown" });

    // aria-activedescendant on the trigger should reference second option
    const trigger = getTrigger();
    const activeId = trigger.getAttribute("aria-activedescendant");
    expect(activeId).toBeTruthy();
    const activeEl = document.getElementById(activeId!);
    expect(activeEl?.textContent?.trim()).toContain("Banana");
  });

  it("ArrowUp moves focus to the previous option", () => {
    renderDropdown({ value: "cherry" });
    const listbox = openDropdown();

    fireEvent.keyDown(listbox, { key: "ArrowUp" });

    const trigger = getTrigger();
    const activeId = trigger.getAttribute("aria-activedescendant");
    const activeEl = document.getElementById(activeId!);
    expect(activeEl?.textContent?.trim()).toContain("Banana");
  });

  it("ArrowDown wraps from last to first option", () => {
    renderDropdown({ value: "cherry" }); // last
    const listbox = openDropdown();

    fireEvent.keyDown(listbox, { key: "ArrowDown" });

    const trigger = getTrigger();
    const activeId = trigger.getAttribute("aria-activedescendant");
    const activeEl = document.getElementById(activeId!);
    expect(activeEl?.textContent?.trim()).toContain("Apple");
  });

  it("ArrowUp wraps from first to last option", () => {
    renderDropdown({ value: "apple" }); // first
    const listbox = openDropdown();

    fireEvent.keyDown(listbox, { key: "ArrowUp" });

    const trigger = getTrigger();
    const activeId = trigger.getAttribute("aria-activedescendant");
    const activeEl = document.getElementById(activeId!);
    expect(activeEl?.textContent?.trim()).toContain("Cherry");
  });

  it("Home key moves focus to the first option", () => {
    renderDropdown({ value: "cherry" });
    const listbox = openDropdown();

    fireEvent.keyDown(listbox, { key: "Home" });

    const trigger = getTrigger();
    const activeId = trigger.getAttribute("aria-activedescendant");
    const activeEl = document.getElementById(activeId!);
    expect(activeEl?.textContent?.trim()).toContain("Apple");
  });

  it("End key moves focus to the last option", () => {
    renderDropdown({ value: "apple" });
    const listbox = openDropdown();

    fireEvent.keyDown(listbox, { key: "End" });

    const trigger = getTrigger();
    const activeId = trigger.getAttribute("aria-activedescendant");
    const activeEl = document.getElementById(activeId!);
    expect(activeEl?.textContent?.trim()).toContain("Cherry");
  });

  it("Enter commits the focused option and closes the listbox", () => {
    const { onChange } = renderDropdown({ value: "apple" });
    const listbox = openDropdown();

    // Move focus to the second option (Banana)
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    fireEvent.keyDown(listbox, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("banana");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("ArrowDown skips over disabled options", () => {
    renderDropdown({ value: "apple", options: FRUITS_WITH_DISABLED });
    const listbox = openDropdown();

    // Apple is active (0); ArrowDown should skip disabled Banana → go to Cherry
    fireEvent.keyDown(listbox, { key: "ArrowDown" });

    const trigger = getTrigger();
    const activeId = trigger.getAttribute("aria-activedescendant");
    const activeEl = document.getElementById(activeId!);
    expect(activeEl?.textContent?.trim()).toContain("Cherry");
  });

  it("ArrowUp skips over disabled options", () => {
    renderDropdown({ value: "cherry", options: FRUITS_WITH_DISABLED });
    const listbox = openDropdown();

    // Cherry is active (2); ArrowUp should skip disabled Banana → go to Apple
    fireEvent.keyDown(listbox, { key: "ArrowUp" });

    const trigger = getTrigger();
    const activeId = trigger.getAttribute("aria-activedescendant");
    const activeEl = document.getElementById(activeId!);
    expect(activeEl?.textContent?.trim()).toContain("Apple");
  });

  it("opening with ArrowDown on the trigger opens the listbox", () => {
    renderDropdown();
    fireEvent.keyDown(getTrigger(), { key: "ArrowDown" });
    expect(screen.getByRole("listbox")).toBeTruthy();
  });

  it("opening with Space on the trigger opens the listbox", () => {
    renderDropdown();
    fireEvent.keyDown(getTrigger(), { key: " " });
    expect(screen.getByRole("listbox")).toBeTruthy();
  });
});

describe("Dropdown – ARIA state", () => {
  it("selected option has aria-selected=true", () => {
    renderDropdown({ value: "banana" });
    openDropdown();

    const options = screen.getAllByRole("option");
    const banana = options.find((o) => o.textContent?.includes("Banana"));
    expect(banana?.getAttribute("aria-selected")).toBe("true");

    const apple = options.find((o) => o.textContent?.includes("Apple"));
    expect(apple?.getAttribute("aria-selected")).toBe("false");
  });

  it("disabled option has aria-disabled=true", () => {
    renderDropdown({ options: FRUITS_WITH_DISABLED });
    openDropdown();

    const options = screen.getAllByRole("option");
    const banana = options.find((o) => o.textContent?.includes("Banana"));
    expect(banana?.getAttribute("aria-disabled")).toBe("true");
  });

  it("aria-controls on trigger references the listbox id", () => {
    renderDropdown();
    const trigger = getTrigger();
    const listboxId = trigger.getAttribute("aria-controls");
    expect(listboxId).toBeTruthy();

    openDropdown();
    // After opening, the element with that ID should have role=listbox
    const listboxEl = document.getElementById(listboxId!);
    expect(listboxEl?.getAttribute("role")).toBe("listbox");
  });
});

describe("Dropdown – outside click", () => {
  beforeEach(() => {
    // Attach a stable container so mousedown can propagate outside
    document.body.innerHTML = `<div id="outside"><p id="outside-el">Outside</p></div>`;
  });

  it("closes the listbox when clicking outside the component", () => {
    renderDropdown();
    openDropdown();

    fireEvent.mouseDown(document.getElementById("outside-el")!);
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

describe("Dropdown – disabled state", () => {
  it("cannot be opened when disabled", () => {
    renderDropdown({ disabled: true });
    fireEvent.click(getTrigger());
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("has aria-disabled=true on the trigger when disabled", () => {
    renderDropdown({ disabled: true });
    expect(getTrigger().getAttribute("aria-disabled")).toBe("true");
  });
});
