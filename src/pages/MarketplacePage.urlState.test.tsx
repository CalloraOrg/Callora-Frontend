// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import MarketplacePage from "./MarketplacePage";
import { CollectionsProvider } from "../state/collectionsStore";
import { AccountProvider } from "../hooks/useAccountContext";
import { switchAccount } from "../state/accountStore";
import MOCK_APIS, { type APIItem } from "../data/mockApis";

/**
 * The page loads its catalogue over the network. This suite is about URL/filter
 * authority, not loading, so the fetcher is stubbed to resolve immediately —
 * otherwise the page sits in its loading state and the filter controls these
 * tests assert on never mount.
 */
const fetchCatalogMock = vi.hoisted(() => vi.fn());

vi.mock("../api/catalogApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/catalogApi")>();
  return { ...actual, fetchCatalog: fetchCatalogMock };
});

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

/**
 * Advances timers *and* flushes the promise microtask queue, so the stubbed
 * catalogue request has actually landed before assertions run.
 */
async function settleTimers() {
  await act(async () => {
    vi.advanceTimersByTime(2000);
  });
}

describe("MarketplacePage – URL authority & no stale state (#989)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    matchMediaStub(false);
    fetchCatalogMock.mockReset();
    fetchCatalogMock.mockResolvedValue(MOCK_APIS as APIItem[]);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("refresh/deep-link restores the exact filters from the URL (authoritative)", async () => {
    renderWithRouter([
      "/marketplace?statuses=down&q=weather&categories=AI/ML",
    ]);
    await settleTimers();

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

  it("browser BACK removes a filter so the UI cannot show stale local state", async () => {
    renderWithRouter(["/marketplace", "/marketplace?statuses=down"], 1);
    await settleTimers();

    // Filter is active on the forward entry.
    expect(
      (screen.getByLabelText(/down/i) as HTMLInputElement).checked,
    ).toBe(true);

    // Navigate back — the URL loses the param.
    fireEvent.click(screen.getByRole("button", { name: "back" }));
    await settleTimers();

    // UI must follow the URL, not a cached local mirror.
    expect(
      (screen.getByLabelText(/down/i) as HTMLInputElement).checked,
    ).toBe(false);
  });

  it("browser FORWARD re-applies the filter from the URL", async () => {
    renderWithRouter(["/marketplace", "/marketplace?statuses=down"], 1);
    await settleTimers();

    fireEvent.click(screen.getByRole("button", { name: "back" }));
    await settleTimers();
    expect(
      (screen.getByLabelText(/down/i) as HTMLInputElement).checked,
    ).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "forward" }));
    await settleTimers();
    expect(
      (screen.getByLabelText(/down/i) as HTMLInputElement).checked,
    ).toBe(true);
  });

  it("concurrent rapid filter toggles: the newest state wins (no overwrite)", async () => {
    renderWithRouter(["/marketplace"]);
    await settleTimers();

    const operational = screen.getByLabelText(/operational/i);
    const degraded = screen.getByLabelText(/degraded/i);

    // Rapidly toggle operational on, then off, then degraded on — all in the
    // same tick. Only the latest intent (degraded) must survive.
    fireEvent.click(operational);
    fireEvent.click(operational);
    fireEvent.click(degraded);
    await settleTimers();

    expect((operational as HTMLInputElement).checked).toBe(false);
    expect((degraded as HTMLInputElement).checked).toBe(true);
  });

  it("search input stays in sync after navigating back to a query-less URL", async () => {
    renderWithRouter(["/marketplace", "/marketplace?q=weather"], 1);
    await settleTimers();

    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe(
      "weather",
    );

    fireEvent.click(screen.getByRole("button", { name: "back" }));
    await settleTimers();

    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("");
  });

  it("account switch resets filters so a previous account's state can't leak", async () => {
    // Reduced motion => initial loading resolves without a real timer.
    matchMediaStub(true);
    renderWithRouter(["/marketplace?statuses=down&favorites=1"]);
    // AccountProvider seeds accounts + becomes ready within the initial render.
    await settleTimers();

    expect(
      (screen.getByLabelText(/down/i) as HTMLInputElement).checked,
    ).toBe(true);

    act(() => {
      switchAccount("account-2");
    });
    await settleTimers();

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
