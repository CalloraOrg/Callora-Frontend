import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import NotFound, { resolveSearchMatches } from "./NotFound";

function renderNotFound() {
  return render(
    <MemoryRouter initialEntries={["/some/unknown/route"]}>
      <Routes>
        <Route path="/some/unknown/route" element={<NotFound onGoHome={() => {}} />} />
        <Route path="/api-usage" element={<div>API Usage Page</div>} />
        <Route path="/billing/history" element={<div>Billing History Page</div>} />
        <Route path="/dashboard" element={<div>Dashboard Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function search(value: string) {
  const input = screen.getByLabelText(/search for a page/i);
  fireEvent.change(input, { target: { value } });
  fireEvent.submit(input.closest("form") as HTMLFormElement);
}

describe("resolveSearchMatches", () => {
  it("matches 'usage' to the API Usage route", () => {
    const matches = resolveSearchMatches("usage");
    expect(matches.some((m) => m.path === "/api-usage")).toBe(true);
  });

  it("matches 'history' to the Billing History route", () => {
    const matches = resolveSearchMatches("history");
    expect(matches.some((m) => m.path === "/billing/history")).toBe(true);
  });

  it("matches previously-unrecognised terms like 'publish', 'webhooks' and 'theme'", () => {
    expect(resolveSearchMatches("publish").some((m) => m.path === "/publish")).toBe(true);
    expect(resolveSearchMatches("webhooks").some((m) => m.path === "/webhooks/deliveries")).toBe(true);
    expect(resolveSearchMatches("theme").some((m) => m.path === "/theme-playground")).toBe(true);
  });

  it("returns no matches for empty or unknown queries", () => {
    expect(resolveSearchMatches("")).toEqual([]);
    expect(resolveSearchMatches("zzz-not-a-real-route-zzz")).toEqual([]);
  });

  it("returns multiple ranked matches for an ambiguous query", () => {
    const matches = resolveSearchMatches("api");
    expect(matches.length).toBeGreaterThan(1);
  });
});

describe("NotFound search UI", () => {
  it("navigates directly when searching 'usage'", () => {
    renderNotFound();
    search("usage");
    expect(screen.getByText("API Usage Page")).toBeInTheDocument();
  });

  it("navigates directly when searching 'history'", () => {
    renderNotFound();
    search("history");
    expect(screen.getByText("Billing History Page")).toBeInTheDocument();
  });

  it("renders a list of links when a query matches multiple routes", () => {
    renderNotFound();
    search("api");

    const results = screen.getByRole("navigation", { name: /search suggestions/i });
    const links = results.querySelectorAll("a");
    expect(links.length).toBeGreaterThan(1);
  });

  it("shows the helper message for unknown terms", () => {
    renderNotFound();
    search("zzz-not-a-real-route-zzz");

    expect(
      screen.getByText(/no direct match yet\. try dashboard, marketplace, or documentation\./i)
    ).toBeInTheDocument();
  });
});
