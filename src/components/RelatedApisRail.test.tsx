import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import RelatedApisRail, { getRelatedApis } from "./RelatedApisRail";
import type { APIItem } from "../data/mockApis";

function makeApi(overrides: Partial<APIItem> = {}): APIItem {
  const id = overrides.id ?? "api-1";
  return {
    id,
    name: `API ${id}`,
    provider: { name: "Provider" },
    description: "Test API",
    pricePerRequest: 0.01,
    ...overrides,
  };
}

const current = makeApi({
  id: "current",
  name: "Current API",
  category: "AI",
  tags: ["nlp", "vision"],
  rating: 3,
});

describe("getRelatedApis", () => {
  it("scores a shared category +2", () => {
    const sameCategory = makeApi({ id: "cat", category: "AI", rating: 1 });
    const result = getRelatedApis(current, [sameCategory], 5);

    expect(result.map((api) => api.id)).toEqual(["cat"]);
  });

  it("scores +1 per shared tag", () => {
    const oneTag = makeApi({ id: "one", tags: ["nlp"] });
    const twoTags = makeApi({ id: "two", tags: ["nlp", "vision"] });

    const result = getRelatedApis(current, [oneTag, twoTags], 5);

    expect(result.map((api) => api.id)).toEqual(["two", "one"]);
  });

  it("adds category and tag scores together", () => {
    const categoryOnly = makeApi({ id: "category", category: "AI" });
    const tagsOnly = makeApi({ id: "tags", tags: ["nlp", "vision"] });
    const both = makeApi({ id: "both", category: "AI", tags: ["nlp"] });

    const result = getRelatedApis(
      current,
      [categoryOnly, tagsOnly, both],
      5,
    );

    expect(result.map((api) => api.id)).toEqual(["both", "category", "tags"]);
  });

  it("compares categories and tags case-insensitively", () => {
    const candidate = makeApi({
      id: "case",
      category: "ai",
      tags: ["NLP", "VISION"],
    });

    expect(getRelatedApis(current, [candidate], 5).map((api) => api.id)).toEqual([
      "case",
    ]);
  });

  it("counts duplicate tags that differ only by casing", () => {
    const candidate = makeApi({ id: "dupes", tags: ["nlp", "NLP"] });
    const single = makeApi({ id: "single", tags: ["nlp"] });

    expect(
      getRelatedApis(current, [candidate, single], 5).map((api) => api.id),
    ).toEqual(["dupes", "single"]);
  });

  it("drops APIs with a score of zero", () => {
    const unrelated = makeApi({
      id: "unrelated",
      category: "Finance",
      tags: ["payments"],
    });

    expect(getRelatedApis(current, [unrelated], 5)).toEqual([]);
  });

  it("excludes the current API even when it is identical", () => {
    const clone = { ...current, id: "current" };
    const related = makeApi({ id: "related", category: "AI" });

    expect(
      getRelatedApis(current, [clone, related], 5).map((api) => api.id),
    ).toEqual(["related"]);
  });

  it("excludes the current API when it appears twice in the list", () => {
    const related = makeApi({ id: "related", category: "AI" });

    expect(
      getRelatedApis(current, [current, current, related], 5).map(
        (api) => api.id,
      ),
    ).toEqual(["related"]);
  });

  it("breaks score ties by rating descending", () => {
    const low = makeApi({ id: "low", category: "AI", rating: 2 });
    const high = makeApi({ id: "high", category: "AI", rating: 4.8 });
    const middle = makeApi({ id: "middle", category: "AI", rating: 3.5 });

    expect(
      getRelatedApis(current, [low, high, middle], 5).map((api) => api.id),
    ).toEqual(["high", "middle", "low"]);
  });

  it("treats a missing rating as zero when breaking ties", () => {
    const unrated = makeApi({ id: "unrated", category: "AI" });
    const rated = makeApi({ id: "rated", category: "AI", rating: 0.1 });

    expect(
      getRelatedApis(current, [unrated, rated], 5).map((api) => api.id),
    ).toEqual(["rated", "unrated"]);
  });

  it("handles candidates without tags, category or rating", () => {
    const bare = makeApi({ id: "bare" });

    expect(getRelatedApis(current, [bare], 5)).toEqual([]);
  });

  it("handles a current API without tags or category", () => {
    const bareCurrent = makeApi({ id: "bare-current" });
    const candidate = makeApi({ id: "candidate", category: "AI" });

    expect(getRelatedApis(bareCurrent, [candidate], 5)).toEqual([]);
  });

  it("honours the limit", () => {
    const candidates = Array.from({ length: 4 }, (_, index) =>
      makeApi({ id: `api-${index}`, category: "AI", rating: index }),
    );

    expect(getRelatedApis(current, candidates, 2).map((api) => api.id)).toEqual([
      "api-3",
      "api-2",
    ]);
  });

  it("returns nothing for a limit of zero or below", () => {
    const candidate = makeApi({ id: "candidate", category: "AI" });

    expect(getRelatedApis(current, [candidate], 0)).toEqual([]);
    expect(getRelatedApis(current, [candidate], -3)).toEqual([]);
  });

  it("returns every candidate when the limit exceeds the pool", () => {
    const candidates = [
      makeApi({ id: "a", category: "AI" }),
      makeApi({ id: "b", category: "AI" }),
    ];

    expect(getRelatedApis(current, candidates, 50)).toHaveLength(2);
  });
});

function renderRail(props: Parameters<typeof RelatedApisRail>[0]) {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<RelatedApisRail {...props} />} />
        <Route path="/details/:id" element={<p>Detail page</p>} />
        <Route path="/marketplace" element={<p>Marketplace page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const cardNames = () =>
  screen
    .queryAllByRole("button", { name: /^View details for/ })
    .map((button) => button.getAttribute("aria-label"));

describe("RelatedApisRail", () => {
  const strongMatch = makeApi({
    id: "strong",
    name: "Strong Match",
    category: "AI",
    tags: ["nlp", "vision"],
    rating: 4.6,
    pricePerRequest: 0.05,
    provider: { name: "Strong Co" },
  });
  const weakMatch = makeApi({
    id: "weak",
    name: "Weak Match",
    category: "AI",
    rating: 4.1,
    pricePerRequest: 0.01,
    provider: { name: "Weak Co" },
  });

  it("renders a labelled section of related cards in score order", () => {
    renderRail({ currentApi: current, allApis: [weakMatch, strongMatch] });

    expect(
      screen.getByRole("region", { name: "Related APIs" }),
    ).toBeInTheDocument();
    expect(cardNames()).toEqual([
      "View details for Strong Match by Strong Co",
      "View details for Weak Match by Weak Co",
    ]);
  });

  it("does not render the current API", () => {
    renderRail({ currentApi: current, allApis: [current, strongMatch] });

    expect(cardNames()).toEqual(["View details for Strong Match by Strong Co"]);
  });

  it("shows the rating and formatted price for each card", () => {
    renderRail({ currentApi: current, allApis: [strongMatch, weakMatch] });

    expect(screen.getByLabelText("4.6 out of 5 stars")).toBeInTheDocument();
    expect(screen.getByLabelText("4.1 out of 5 stars")).toBeInTheDocument();
    expect(screen.getByText("$0.050")).toBeInTheDocument();
    expect(screen.getByText("$0.010")).toBeInTheDocument();
  });

  it("omits the rating label when an API has no rating", () => {
    const unrated = makeApi({
      id: "unrated",
      name: "Unrated",
      category: "AI",
    });

    renderRail({ currentApi: current, allApis: [unrated] });

    expect(
      screen.queryByLabelText(/out of 5 stars/),
    ).not.toBeInTheDocument();
  });

  it("caps the rail at the default limit of five", () => {
    const many = Array.from({ length: 7 }, (_, index) =>
      makeApi({
        id: `api-${index}`,
        name: `Candidate ${index}`,
        category: "AI",
        rating: index,
      }),
    );

    renderRail({ currentApi: current, allApis: many });

    expect(cardNames()).toHaveLength(5);
  });

  it("calls onSelect with the clicked API and does not navigate", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    renderRail({
      currentApi: current,
      allApis: [strongMatch, weakMatch],
      onSelect,
    });

    await user.click(
      screen.getByRole("button", {
        name: "View details for Weak Match by Weak Co",
      }),
    );

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(weakMatch);
    expect(screen.queryByText("Detail page")).not.toBeInTheDocument();
  });

  it("navigates to the detail route when onSelect is not provided", async () => {
    const user = userEvent.setup();
    renderRail({ currentApi: current, allApis: [strongMatch] });

    await user.click(
      screen.getByRole("button", {
        name: "View details for Strong Match by Strong Co",
      }),
    );

    expect(screen.getByText("Detail page")).toBeInTheDocument();
  });

  it("links to the marketplace from the footer", async () => {
    const user = userEvent.setup();
    renderRail({ currentApi: current, allApis: [strongMatch] });

    await user.click(
      screen.getByRole("button", {
        name: "Browse all APIs in the marketplace",
      }),
    );

    expect(screen.getByText("Marketplace page")).toBeInTheDocument();
  });

  it("renders nothing when no APIs are related", () => {
    const unrelated = makeApi({
      id: "unrelated",
      category: "Finance",
      tags: ["payments"],
    });
    const { container } = renderRail({
      currentApi: current,
      allApis: [unrelated],
    });

    expect(container).toBeEmptyDOMElement();
  });

  it("renders each card as a real button", () => {
    renderRail({ currentApi: current, allApis: [strongMatch] });

    const button = screen.getByRole("button", {
      name: "View details for Strong Match by Strong Co",
    });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
    expect(within(button).getByText("Strong Match")).toBeInTheDocument();
  });
});
