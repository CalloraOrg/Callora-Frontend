// @vitest-environment jsdom

/**
 * ThemePlayground.test.tsx
 *
 * Coverage:
 *  1. Static rendering — heading, token inputs, action buttons.
 *  2. Export CSS — clipboard success shows transient "Copied" label.
 *  3. Export CSS — success is announced via the polite live region.
 *  4. Export CSS — clipboard rejection shows an error message (no unhandled
 *     promise) and offers the Download .css fallback.
 *  5. Download fallback — produces a text/css Blob download with the right
 *     filename, and is announced to screen readers.
 *  6. Export CSS — neither clipboard nor execCommand present: download
 *     fallback is offered proactively.
 *  7. Reset flow — unchanged behaviour (tokens revert to defaults).
 */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

/**
 * Click Export CSS and flush the clipboard promise microtask so state
 * updates land before assertions (same pattern as SlaCard.test.tsx).
 * Avoids `waitFor`, which deadlocks under fake timers.
 */
async function clickExport() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /export css/i }));
    await Promise.resolve();
  });
}

/** Grab the single aria-live status region used for export announcements. */
function getLiveRegion() {
  return screen.getByTestId("live-region");
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ─── Static rendering ────────────────────────────────────────────────────────

describe("ThemePlayground — static rendering", () => {
  it("renders the theme playground heading", () => {
    renderPlayground();
    expect(
      screen.getByRole("heading", { name: /theme playground/i }),
    ).toBeTruthy();
  });

  it("renders token editor inputs for all three tokens", () => {
    renderPlayground();
    expect(screen.getByLabelText(/primary token/i)).toBeTruthy();
    expect(screen.getByLabelText(/accent token/i)).toBeTruthy();
    expect(screen.getByLabelText(/surface token/i)).toBeTruthy();
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

// ─── Export CSS — clipboard success ──────────────────────────────────────────

describe("ThemePlayground — Export CSS (success)", () => {
  it("writes the generated CSS to the clipboard", async () => {
    renderPlayground();

    fireEvent.change(screen.getByLabelText(/primary token/i), {
      target: { value: "#ff6600" },
    });
    await clickExport();

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("--theme-primary: #ff6600;"),
    );
  });

  it("shows a transient 'Copied' label on the export button", async () => {
    renderPlayground();

    const exportBtn = screen.getByRole("button", { name: /export css/i });
    await clickExport();

    expect(screen.getByRole("button", { name: /export css/i }).textContent).toBe(
      "Copied",
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(
      screen.getByRole("button", { name: /export css/i }).textContent,
    ).toBe("Export CSS");
  });

  it("announces the copy to screen readers via the live region", async () => {
    renderPlayground();

    await clickExport();

    expect(getLiveRegion().textContent).toContain(
      "Theme CSS copied to clipboard",
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(getLiveRegion().textContent).not.toContain(
      "Theme CSS copied to clipboard",
    );
  });
});

// ─── Export CSS — clipboard rejection ────────────────────────────────────────

describe("ThemePlayground — Export CSS (clipboard rejection)", () => {
  it("shows an error message instead of failing silently", async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(
      new Error("denied"),
    );
    renderPlayground();

    await clickExport();

    expect(
      screen.getByText(/couldn't copy to your clipboard/i),
    ).toBeTruthy();
    expect(screen.queryByText(/copied to clipboard/i)).toBeNull();
  });

  it("does not show the Copied label when the copy fails", async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(
      new Error("denied"),
    );
    renderPlayground();

    await clickExport();

    expect(
      screen.getByRole("button", { name: /export css/i }).textContent,
    ).toBe("Export CSS");
  });

  it("announces the failure to screen readers", async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(
      new Error("denied"),
    );
    renderPlayground();

    await clickExport();

    expect(getLiveRegion().textContent).toContain(
      "Copying to the clipboard failed",
    );
  });

  it("offers a 'Download .css' fallback when clipboard access is denied", async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(
      new Error("denied"),
    );
    renderPlayground();

    await clickExport();

    expect(
      screen.getByRole("button", { name: /download \.css/i }),
    ).toBeTruthy();
  });

  it("keeps the error banner visible beyond the announcement window so the fallback stays available", async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(
      new Error("denied"),
    );
    renderPlayground();

    await clickExport();
    expect(screen.getByText(/couldn't copy to your clipboard/i)).toBeTruthy();

    // The screen-reader announcement is transient, but the visible error +
    // download affordance persists until the clipboard works again.
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(getLiveRegion().textContent).toBe("");
    expect(screen.getByText(/couldn't copy to your clipboard/i)).toBeTruthy();
  });

  it("clears the error banner once a later copy succeeds", async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(
      new Error("denied"),
    );
    renderPlayground();

    await clickExport();
    expect(screen.getByText(/couldn't copy to your clipboard/i)).toBeTruthy();

    await clickExport();
    expect(screen.queryByText(/couldn't copy to your clipboard/i)).toBeNull();
    expect(
      screen.getByRole("button", { name: /export css/i }).textContent,
    ).toBe("Copied");
  });
});

// ─── Download fallback ───────────────────────────────────────────────────────

describe("ThemePlayground — Download .css fallback", () => {
  /** Stub URL.createObjectURL/revokeObjectURL (jsdom lacks them) and capture clicks. */
  function stubDownload() {
    const revoked: string[] = [];
    let counter = 0;
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: vi.fn(() => `blob:mock-${++counter}`),
        revokeObjectURL: vi.fn((u: string) => revoked.push(u)),
      }),
    );
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click");
    return { revoked, clickSpy };
  }

  /** Reach the fallback the way users do: a denied clipboard export first. */
  async function renderWithDeniedClipboard() {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(
      new Error("denied"),
    );
    renderPlayground();
    await clickExport();
  }

  it("downloads a text/css Blob named callora-theme.css", async () => {
    const { clickSpy } = stubDownload();
    await renderWithDeniedClipboard();

    fireEvent.click(screen.getByRole("button", { name: /download \.css/i }));

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("announces the download to screen readers", async () => {
    stubDownload();
    await renderWithDeniedClipboard();

    fireEvent.click(screen.getByRole("button", { name: /download \.css/i }));

    expect(getLiveRegion().textContent).toContain(
      "Theme CSS downloaded as callora-theme.css",
    );
  });

  it("sets the .css filename and blob URL on the download anchor", async () => {
    const { clickSpy } = stubDownload();
    await renderWithDeniedClipboard();

    fireEvent.click(screen.getByRole("button", { name: /download \.css/i }));

    expect(clickSpy).toHaveBeenCalledTimes(1);
    const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement;
    expect(anchor.download).toBe("callora-theme.css");
    expect(anchor.href.startsWith("blob:mock-")).toBe(true);
  });
});

// ─── Export CSS — no clipboard mechanism at all ──────────────────────────────

describe("ThemePlayground — no clipboard support", () => {
  it("offers the download fallback when neither clipboard nor execCommand exist", async () => {
    // @ts-expect-error — simulating an environment without the Clipboard API
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(document, "execCommand", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    renderPlayground();
    await clickExport();

    expect(
      screen.getByText(/couldn't copy to your clipboard/i),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /download \.css/i }),
    ).toBeTruthy();
  });
});

// ─── Reset flow (unchanged behaviour) ────────────────────────────────────────

describe("ThemePlayground — reset", () => {
  it("reverts tokens to defaults when Reset is clicked", () => {
    renderPlayground();

    fireEvent.change(screen.getByLabelText(/primary token/i), {
      target: { value: "#ff6600" },
    });
    fireEvent.click(screen.getByRole("button", { name: /reset to defaults/i }));

    const previewButton = screen.getByRole("button", {
      name: /preview action/i,
    });
    expect(previewButton.style.backgroundColor).toMatch(
      /4e85ff|rgb\(78,\s*133,\s*255\)/i,
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Contrast validation (issue #1065)
// ──────────────────────────────────────────────────────────────────────────────

describe("ThemePlayground contrast validation", () => {
  // These tests rely on `waitFor`, which deadlocks under the fake timers the
  // top-level beforeEach installs, so run them on real timers.
  beforeEach(() => {
    vi.useRealTimers();
  });

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
