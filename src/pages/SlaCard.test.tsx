// @vitest-environment jsdom

/**
 * SlaCard.test.tsx
 *
 * Focused tests for the SlaCard component (GrantFox FWC26, Issue #545).
 *
 * Test surface:
 *  1. Static rendering — card heading, all SLA fields are present.
 *  2. Copy buttons — each field has a copy button with the correct aria-label.
 *  3. Copy interaction — clicking a button calls clipboard.writeText with the
 *     right value and transitions to the "Copied!" state.
 *  4. Success feedback resets — after 2 seconds the button label reverts.
 *  5. Accessibility — aria-live region announces successful copy.
 *  6. Rapid re-copy — timer restarts on consecutive clicks.
 *  7. Independence — each button tracks its own copied state.
 *
 * Note on fake timers + async clipboard:
 *   We use `act(async () => { ... })` to flush the Promise microtask from
 *   `navigator.clipboard.writeText` before asserting state. Then we use
 *   `act(() => vi.advanceTimersByTime(...))` for timer-driven resets.
 *   `waitFor` is intentionally avoided because it uses `setTimeout` internally
 *   and would deadlock with `vi.useFakeTimers()`.
 */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import SlaCard from "./SlaCard";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Render SlaCard inside a MemoryRouter (Breadcrumb uses <Link> which needs a router). */
function renderSlaCard() {
  return render(
    <MemoryRouter>
      <SlaCard />
    </MemoryRouter>,
  );
}

/**
 * Click a copy button and flush the clipboard Promise microtask.
 * Returns after setState has been applied so assertions can run immediately.
 */
async function clickCopy(btn: HTMLElement) {
  await act(async () => {
    fireEvent.click(btn);
    // Let the clipboard.writeText promise resolve
    await Promise.resolve();
  });
}

// ─── Setup / teardown ────────────────────────────────────────────────────────

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

describe("SlaCard — static rendering", () => {
  it("renders the card heading", () => {
    renderSlaCard();
    expect(
      screen.getByRole("heading", { name: /sla details/i }),
    ).toBeTruthy();
  });

  it("renders all 8 SLA field labels", () => {
    renderSlaCard();
    const expectedLabels = [
      "Uptime SLA",
      "P99 Response Time",
      "Incident Response",
      "Maintenance Window",
      "Support Tier",
      "Credit Threshold",
      "API Version",
      "Contract ID",
    ];
    for (const label of expectedLabels) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("renders all 8 SLA field values with the correct text content", () => {
    renderSlaCard();
    const fields: [string, string][] = [
      ["uptime", "99.95%"],
      ["response-time", "≤ 250 ms"],
      ["incident-response", "< 15 minutes"],
      ["maintenance-window", "Sundays 02:00–04:00 UTC"],
      ["support-tier", "Priority (24/7)"],
      ["credit-threshold", "< 99.5% triggers SLA credit"],
      ["api-version", "v2.4.1"],
      ["contract-id", "FWC26-SLA-0042"],
    ];
    for (const [id, value] of fields) {
      expect(screen.getByTestId(`sla-value-${id}`).textContent).toBe(value);
    }
  });

  it("renders exactly 8 copy buttons (one per SLA field)", () => {
    renderSlaCard();
    const copyButtons = screen.getAllByRole("button", { name: /^Copy /i });
    expect(copyButtons).toHaveLength(8);
  });

  it("renders the GrantFox FWC26 subtitle", () => {
    renderSlaCard();
    expect(screen.getByText(/GrantFox Wave Compute API/)).toBeTruthy();
  });

  it("renders the card as a landmark section with the correct label", () => {
    renderSlaCard();
    expect(
      screen.getByRole("region", { name: /sla details/i }),
    ).toBeTruthy();
  });
});

// ─── Copy button aria-labels ─────────────────────────────────────────────────

describe("SlaCard — copy button aria-labels", () => {
  it("includes the field label and value in each button's aria-label", () => {
    renderSlaCard();
    expect(
      screen.getByRole("button", { name: /Copy Uptime SLA: 99\.95%/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Copy Contract ID: FWC26-SLA-0042/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Copy API Version: v2\.4\.1/i }),
    ).toBeTruthy();
  });
});

// ─── Copy interaction ────────────────────────────────────────────────────────

describe("SlaCard — copy interaction", () => {
  it("calls clipboard.writeText with the correct value on click", async () => {
    const writeText = navigator.clipboard.writeText as ReturnType<typeof vi.fn>;
    renderSlaCard();

    const btn = screen.getByTestId("sla-copy-btn-contract-id");
    await clickCopy(btn);

    expect(writeText).toHaveBeenCalledWith("FWC26-SLA-0042");
  });

  it("shows 'Copied!' label after a successful copy", async () => {
    renderSlaCard();

    const btn = screen.getByTestId("sla-copy-btn-uptime");
    await clickCopy(btn);

    expect(btn.textContent).toContain("Copied!");
  });

  it("changes aria-label to '<Field> copied' after a successful copy", async () => {
    renderSlaCard();

    const btn = screen.getByTestId("sla-copy-btn-api-version");
    await clickCopy(btn);

    expect(btn.getAttribute("aria-label")).toBe("API Version copied");
  });

  it("resets button label back to 'Copy' after 2 seconds", async () => {
    renderSlaCard();

    const btn = screen.getByTestId("sla-copy-btn-uptime");
    await clickCopy(btn);

    expect(btn.textContent).toContain("Copied!");

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(btn.textContent).toContain("Copy");
    expect(btn.textContent).not.toContain("Copied!");
  });

  it("restores default aria-label after the feedback window expires", async () => {
    renderSlaCard();

    const btn = screen.getByTestId("sla-copy-btn-support-tier");
    await clickCopy(btn);

    expect(btn.getAttribute("aria-label")).toBe("Support Tier copied");

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(btn.getAttribute("aria-label")).toContain("Copy Support Tier");
  });

  it("renders the success CheckIcon while copied is true", async () => {
    renderSlaCard();

    const btn = screen.getByTestId("sla-copy-btn-response-time");
    // Before click — should show the copy icon, button label is "Copy"
    expect(btn.textContent).toContain("Copy");

    await clickCopy(btn);

    // After click — SVG should still be there (now it's the check icon)
    const svg = btn.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(btn.textContent).toContain("Copied!");
  });

  it("each copy button copies its own field's value", async () => {
    const writeText = navigator.clipboard.writeText as ReturnType<typeof vi.fn>;
    renderSlaCard();

    // Copy P99 response time
    await clickCopy(screen.getByTestId("sla-copy-btn-response-time"));
    expect(writeText).toHaveBeenLastCalledWith("≤ 250 ms");

    // Copy contract ID
    await clickCopy(screen.getByTestId("sla-copy-btn-contract-id"));
    expect(writeText).toHaveBeenLastCalledWith("FWC26-SLA-0042");

    expect(writeText).toHaveBeenCalledTimes(2);
  });
});

// ─── Accessibility (aria-live) ───────────────────────────────────────────────

describe("SlaCard — accessibility (aria-live)", () => {
  it("live region is empty before any copy action", () => {
    renderSlaCard();
    const live = screen.getByTestId("sla-live-uptime");
    expect(live.textContent).toBe("");
  });

  it("live region announces copy for the correct field", async () => {
    renderSlaCard();

    const btn = screen.getByTestId("sla-copy-btn-contract-id");
    await clickCopy(btn);

    const live = screen.getByTestId("sla-live-contract-id");
    expect(live.textContent).toBe("Contract ID copied to clipboard");
  });

  it("other fields' live regions remain empty when one field is copied", async () => {
    renderSlaCard();

    await clickCopy(screen.getByTestId("sla-copy-btn-uptime"));

    // Only the uptime live region should be populated
    const contractLive = screen.getByTestId("sla-live-contract-id");
    expect(contractLive.textContent).toBe("");
  });

  it("live region resets to empty after 2 seconds", async () => {
    renderSlaCard();

    const btn = screen.getByTestId("sla-copy-btn-uptime");
    await clickCopy(btn);

    expect(screen.getByTestId("sla-live-uptime").textContent).toBe(
      "Uptime SLA copied to clipboard",
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByTestId("sla-live-uptime").textContent).toBe("");
  });

  it("each live region has aria-live='polite' and aria-atomic='true'", () => {
    renderSlaCard();
    const live = screen.getByTestId("sla-live-uptime");
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(live.getAttribute("aria-atomic")).toBe("true");
  });
});

// ─── Rapid re-copy ───────────────────────────────────────────────────────────

describe("SlaCard — rapid re-copy", () => {
  it("keeps copied state alive when button is clicked again before timer expires", async () => {
    renderSlaCard();

    const btn = screen.getByTestId("sla-copy-btn-uptime");

    // First click
    await clickCopy(btn);
    expect(btn.textContent).toContain("Copied!");

    // Advance 1 second (still within the 2s window)
    act(() => { vi.advanceTimersByTime(1000); });

    // Second click — timer resets
    await clickCopy(btn);
    expect(btn.textContent).toContain("Copied!");

    // 1s after second click — still within the new 2s window
    act(() => { vi.advanceTimersByTime(1000); });
    expect(btn.textContent).toContain("Copied!");

    // Full 2s from second click have now elapsed — should reset
    act(() => { vi.advanceTimersByTime(1000); });
    expect(btn.textContent).toContain("Copy");
  });
});

// ─── Independent copy state per button ───────────────────────────────────────

describe("SlaCard — multiple independent copy buttons", () => {
  it("only the clicked button shows 'Copied!' — others remain at default", async () => {
    renderSlaCard();

    const firstBtn = screen.getByTestId("sla-copy-btn-uptime");
    const secondBtn = screen.getByTestId("sla-copy-btn-contract-id");

    await clickCopy(firstBtn);

    expect(firstBtn.textContent).toContain("Copied!");
    // Second button must not be in the "copied" state
    expect(secondBtn.textContent).toContain("Copy");
    expect(secondBtn.textContent).not.toContain("Copied!");
  });

  it("two buttons can be in 'copied' state independently at the same time", async () => {
    renderSlaCard();

    const firstBtn = screen.getByTestId("sla-copy-btn-uptime");
    const secondBtn = screen.getByTestId("sla-copy-btn-contract-id");

    await clickCopy(firstBtn);
    await clickCopy(secondBtn);

    expect(firstBtn.textContent).toContain("Copied!");
    expect(secondBtn.textContent).toContain("Copied!");
  });
});
