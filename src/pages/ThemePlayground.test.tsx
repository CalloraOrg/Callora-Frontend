// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../ThemeContext";
import ThemePlayground from "./ThemePlayground";

function renderPlayground() {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <ThemePlayground />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe("ThemePlayground", () => {
  it("renders the theme playground heading", () => {
    renderPlayground();
    expect(
      screen.getByRole("heading", { name: /theme playground/i }),
    ).toBeTruthy();
  });

  it("updates the primary token when the color input changes", () => {
    renderPlayground();

    const primaryInput = screen.getByLabelText(/primary token/i);
    fireEvent.change(primaryInput, { target: { value: "#ff6600" } });

    const previewButton = screen.getByRole("button", {
      name: /preview action/i,
    });
    // jsdom normalises hex to rgb(); accept either form
    expect(previewButton.style.backgroundColor).toMatch(/ff6600|rgb\(255,\s*102,\s*0\)/i);
  });

  it("resets tokens to defaults when Reset button is clicked", () => {
    renderPlayground();

    const primaryInput = screen.getByLabelText(/primary token/i);
    fireEvent.change(primaryInput, { target: { value: "#ff6600" } });

    fireEvent.click(screen.getByRole("button", { name: /reset to defaults/i }));

    const previewButton = screen.getByRole("button", {
      name: /preview action/i,
    });
    // Default primary is #4e85ff — jsdom may normalise to rgb
    expect(previewButton.style.backgroundColor).toMatch(/4e85ff|rgb\(78,\s*133,\s*255\)/i);
  });

  it("renders token editor inputs for all three tokens", () => {
    renderPlayground();
    expect(screen.getByLabelText(/primary token/i)).toBeTruthy();
    expect(screen.getByLabelText(/accent token/i)).toBeTruthy();
    expect(screen.getByLabelText(/surface token/i)).toBeTruthy();
  });

  it("renders the Export CSS and Reset to defaults action buttons", () => {
    renderPlayground();
    expect(
      screen.getByRole("button", { name: /export css/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /reset to defaults/i }),
    ).toBeTruthy();
  });
});
