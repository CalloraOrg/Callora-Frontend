// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

// ──────────────────────────────────────────────────────────────────────────────
// Contrast validation (issue #1065)
// ──────────────────────────────────────────────────────────────────────────────

describe("ThemePlayground contrast validation", () => {
  it("shows a numeric ratio and a passing verdict for both pairs by default", () => {
    renderPlayground();

    const textBadge = screen.getByTestId("contrast-text-on-surface");
    expect(textBadge.textContent).toMatch(/text on surface/i);
    expect(textBadge.textContent).toMatch(/\d+\.\d{2}:1/);
    expect(screen.getByTestId("contrast-text-on-surface-status").textContent).toBe(
      "Passes AA",
    );

    const accentBadge = screen.getByTestId("contrast-accent-on-surface");
    expect(accentBadge.textContent).toMatch(/accent on surface/i);
    expect(accentBadge.textContent).toMatch(/\d+\.\d{2}:1/);
    expect(screen.getByTestId("contrast-accent-on-surface-status").textContent).toBe(
      "Passes AA",
    );
  });

  it("labels a pair that drops below 4.5:1 as Fails AA", () => {
    renderPlayground();

    // Accent equal to the surface colour ⇒ ratio 1.00:1.
    fireEvent.change(screen.getByLabelText(/accent hex value/i), {
      target: { value: "#0f172a" },
    });

    const accentBadge = screen.getByTestId("contrast-accent-on-surface");
    expect(accentBadge.textContent).toMatch(/1\.00:1/);
    expect(screen.getByTestId("contrast-accent-on-surface-status").textContent).toBe(
      "Fails AA",
    );
    // The unaffected pair still passes.
    expect(screen.getByTestId("contrast-text-on-surface-status").textContent).toBe(
      "Passes AA",
    );
  });

  it("recomputes the text-on-surface ratio when the surface token changes", () => {
    renderPlayground();

    fireEvent.change(screen.getByLabelText(/surface hex value/i), {
      target: { value: "#ffffff" },
    });

    expect(screen.getByTestId("contrast-text-on-surface-status").textContent).toBe(
      "Fails AA",
    );
    expect(screen.getByTestId("contrast-text-on-surface").textContent).toMatch(
      /1\.00:1/,
    );
  });

  it("shows an inline invalid-colour error instead of NaN", () => {
    renderPlayground();

    fireEvent.change(screen.getByLabelText(/accent hex value/i), {
      target: { value: "#zzzzzz" },
    });

    const accentBadge = screen.getByTestId("contrast-accent-on-surface");
    expect(accentBadge.textContent).toMatch(/invalid colour/i);
    expect(accentBadge.textContent).not.toMatch(/NaN/);
    expect(screen.getByTestId("contrast-accent-on-surface-status").textContent).toBe(
      "Invalid colour",
    );
  });

  it("warns on export when any pair fails AA", async () => {
    renderPlayground();

    fireEvent.change(screen.getByLabelText(/accent hex value/i), {
      target: { value: "#0f172a" },
    });
    fireEvent.click(screen.getByRole("button", { name: /export css/i }));

    await waitFor(() => {
      expect(screen.getByTestId("contrast-export-warning").textContent).toMatch(
        /fails wcag aa/i,
      );
    });
    expect(screen.getByTestId("contrast-export-warning").textContent).toMatch(
      /accent on surface/i,
    );
  });

  it("does not warn on export while both pairs pass AA", async () => {
    renderPlayground();

    fireEvent.click(screen.getByRole("button", { name: /export css/i }));

    await waitFor(() => {
      expect(screen.queryByTestId("contrast-export-warning")).toBeNull();
    });
  });

  it("clears a previous export warning once a token is edited", async () => {
    renderPlayground();

    fireEvent.change(screen.getByLabelText(/accent hex value/i), {
      target: { value: "#0f172a" },
    });
    fireEvent.click(screen.getByRole("button", { name: /export css/i }));
    await waitFor(() => {
      expect(screen.getByTestId("contrast-export-warning")).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText(/accent hex value/i), {
      target: { value: "#1ed6a4" },
    });
    expect(screen.queryByTestId("contrast-export-warning")).toBeNull();
  });
});
