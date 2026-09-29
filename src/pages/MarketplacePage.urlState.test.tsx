// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import MarketplacePage from "./MarketplacePage";
import { CollectionsProvider } from "../state/collectionsStore";
import { AccountProvider } from "../hooks/useAccountContext";
import { switchAccount } from "../state/accountStore";

function matchMediaStub(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

/** A tiny control that drives real router navigation (the same gesture the
 *  browser back/forward buttons produce) without the data-router fetch that
 *  `createMemoryRouter` triggers under jsdom. */
function NavButtons() {
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => navigate(-1)}>
        back
      </button>
      <button type="button" onClick={() => navigate(1)}>
        forward
      </button>
    </>
  );
}

function renderWithRouter(
  initialEntries: string[],
  initialIndex = 0,
  withAccount = true,
) {
  const inner = (
    <Routes>
      <Route
        path="/marketplace"
        element={
          <>
            <MarketplacePage />
            <NavButtons />
          </>
        }
      />
    </Routes>
  );
  const tree = withAccount ? (
    <AccountProvider>
      <CollectionsProvider>{inner}</CollectionsProvider>
    </AccountProvider>
  ) : (
    <CollectionsProvider>{inner}</CollectionsProvider>
  );
  return render(
    <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
      {tree}
    </MemoryRouter>,
  );
}

function settleTimers() {
  act(() => {
    vi.advanceTimersByTime(2000);
  });
}

describe("MarketplacePage – URL authority & no stale state (#989)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    matchMediaStub(false);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("refresh/deep-link restores the exact filters from the URL (authoritative)", () => {
    renderWithRouter([
      "/marketplace?statuses=down&q=weather&categories=AI/ML",
    ]);
    settleTimers();

    expect(
      (screen.getByLabelText(/down/i) as HTMLInputElement).checked,
    ).toBe(true);
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe(
      "weather",
    );
    expect(
      (screen.getByLabelText(/AI\/ML/i) as HTMLInputElement).checked,
    ).toBe(true);
  });

  it("browser BACK removes a filter so the UI cannot show stale local state", () => {
    renderWithRouter(["/marketplace", "/marketplace?statuses=down"], 1);
    settleTimers();

    // Filter is active on the forward entry.
    expect(
      (screen.getByLabelText(/down/i) as HTMLInputElement).checked,
    ).toBe(true);

    // Navigate back — the URL loses the param.
    fireEvent.click(screen.getByRole("button", { name: "back" }));
    settleTimers();

    // UI must follow the URL, not a cached local mirror.
    expect(
      (screen.getByLabelText(/down/i) as HTMLInputElement).checked,
    ).toBe(false);
  });

  it("browser FORWARD re-applies the filter from the URL", () => {
    renderWithRouter(["/marketplace", "/marketplace?statuses=down"], 1);
    settleTimers();

    fireEvent.click(screen.getByRole("button", { name: "back" }));
    settleTimers();
    expect(
      (screen.getByLabelText(/down/i) as HTMLInputElement).checked,
    ).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "forward" }));
    settleTimers();
    expect(
      (screen.getByLabelText(/down/i) as HTMLInputElement).checked,
    ).toBe(true);
  });

  it("concurrent rapid filter toggles: the newest state wins (no overwrite)", () => {
    renderWithRouter(["/marketplace"]);
    settleTimers();

    const operational = screen.getByLabelText(/operational/i);
    const degraded = screen.getByLabelText(/degraded/i);

    // Rapidly toggle operational on, then off, then degraded on — all in the
    // same tick. Only the latest intent (degraded) must survive.
    fireEvent.click(operational);
    fireEvent.click(operational);
    fireEvent.click(degraded);
    settleTimers();

    expect((operational as HTMLInputElement).checked).toBe(false);
    expect((degraded as HTMLInputElement).checked).toBe(true);
  });

  it("search input stays in sync after navigating back to a query-less URL", () => {
    renderWithRouter(["/marketplace", "/marketplace?q=weather"], 1);
    settleTimers();

    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe(
      "weather",
    );

    fireEvent.click(screen.getByRole("button", { name: "back" }));
    settleTimers();

    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("");
  });

  it("account switch resets filters so a previous account's state can't leak", () => {
    // Reduced motion => initial loading resolves without a real timer.
    matchMediaStub(true);
    renderWithRouter(["/marketplace?statuses=down&favorites=1"]);
    // AccountProvider seeds accounts + becomes ready within the initial render.
    settleTimers();

    expect(
      (screen.getByLabelText(/down/i) as HTMLInputElement).checked,
    ).toBe(true);

    act(() => {
      switchAccount("account-2");
    });
    settleTimers();

    expect(
      (screen.getByLabelText(/down/i) as HTMLInputElement).checked,
    ).toBe(false);
    expect(
      (
        screen.getByRole("checkbox", {
          name: /favorites only/i,
        }) as HTMLInputElement
      ).checked,
    ).toBe(false);
  });
});
