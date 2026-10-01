// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TokenEditor from "./TokenEditor";

afterEach(() => {
  cleanup();
});

function renderEditor(value = "#4e85ff") {
  const onChange = vi.fn();
  render(
    <TokenEditor
      label="Primary token"
      tokenKey="primary"
      value={value}
      onChange={onChange}
    />,
  );
  return {
    onChange,
    textInput: screen.getByRole("textbox") as HTMLInputElement,
    swatch: screen.getByLabelText(/primary token/i) as HTMLInputElement,
  };
}

describe("TokenEditor hex normalisation", () => {
  const cases: Array<{ name: string; input: string; expected: string }> = [
    { name: "adds a missing '#'", input: "4e85ff", expected: "#4e85ff" },
    { name: "trims surrounding whitespace", input: "  #abc ", expected: "#abc" },
    { name: "trims whitespace before adding '#'", input: "  abc  ", expected: "#abc" },
    { name: "passes non-hex strings through unchanged", input: "red", expected: "red" },
    { name: "passes too-short hex through unchanged", input: "#12", expected: "#12" },
    { name: "passes too-long hex through unchanged", input: "#123456789", expected: "#123456789" },
    { name: "passes non-hex characters through unchanged", input: "#gggggg", expected: "#gggggg" },
    { name: "keeps an already-normalised value", input: "#4E85FF", expected: "#4E85FF" },
    { name: "accepts 8-digit hex with alpha", input: "4e85ffcc", expected: "#4e85ffcc" },
    { name: "accepts 4-digit hex with alpha", input: "#abcd", expected: "#abcd" },
  ];

  it.each(cases)("$name ($input)", ({ input, expected }) => {
    const { onChange, textInput } = renderEditor();

    fireEvent.change(textInput, { target: { value: input } });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(expected);
  });

  it("emits the raw value when the input is cleared", () => {
    const { onChange, textInput } = renderEditor();

    fireEvent.change(textInput, { target: { value: "" } });

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("emits the raw value when the input is only whitespace", () => {
    const { onChange, textInput } = renderEditor();

    fireEvent.change(textInput, { target: { value: "   " } });

    expect(onChange).toHaveBeenCalledWith("   ");
  });
});

describe("TokenEditor colour swatch", () => {
  it("uses the current value when it is a hex colour", () => {
    const { swatch } = renderEditor("#ff6600");

    expect(swatch).toHaveAttribute("type", "color");
    expect(swatch.value).toBe("#ff6600");
  });

  it("falls back to #4e85ff for non-hex values", () => {
    const { swatch } = renderEditor("red");

    expect(swatch.value).toBe("#4e85ff");
  });

  it("falls back to #4e85ff for empty values", () => {
    const { swatch } = renderEditor("");

    expect(swatch.value).toBe("#4e85ff");
  });

  it("forwards swatch changes through onChange", () => {
    const { onChange, swatch } = renderEditor("#4e85ff");

    fireEvent.change(swatch, { target: { value: "#00ff00" } });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("#00ff00");
  });
});

describe("TokenEditor rendering", () => {
  it("renders the label, hint and accessible names", () => {
    const { textInput, swatch } = renderEditor();

    expect(screen.getByText("Primary token")).toBeTruthy();
    expect(
      screen.getByText(/enter a hex color such as #4e85ff/i),
    ).toBeTruthy();
    expect(swatch).toHaveAccessibleName("Primary token token");
    expect(textInput).toHaveAttribute("aria-describedby", "primary-hint");
    expect(textInput.value).toBe("#4e85ff");
  });
});
