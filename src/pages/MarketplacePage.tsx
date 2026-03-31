import { useMemo, useState } from "react";
import ApiCard from "../components/ApiCard";
import SearchBar from "../components/SearchBar";
import FiltersSidebar from "../components/FiltersSidebar";
import EmptyState from "../components/EmptyState";
import MOCK_APIS, { type APIItem } from "../data/mockApis";

export default function MarketplacePage(): JSX.Element {
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [minPrice, setMinPrice] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [popularity, setPopularity] = useState<string>("any");
  const [sort, setSort] = useState<string>("relevance");
  const [shown, setShown] = useState<number>(12);
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  const toggleCategory = (c: string) => {
    const copy = new Set(selectedCategories);
    if (copy.has(c)) copy.delete(c);
    else copy.add(c);
    setSelectedCategories(copy);
  };

  const clearFilters = () => {
    setSelectedCategories(new Set());
    setMinPrice(null);
    setMaxPrice(null);
    setPopularity("any");
    setSort("relevance");
  };

  const filtered = useMemo(() => {
    let items = MOCK_APIS.slice();

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((a) => {
        return (
          a.name.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.provider?.name?.toLowerCase().includes(q) ||
          (a.tags || []).some((t) => t.toLowerCase().includes(q))
        );
      });
    }

    if (selectedCategories.size > 0) {
      items = items.filter((a) => selectedCategories.has(a.category ?? ""));
    }

    if (minPrice !== null)
      items = items.filter((a) => a.pricePerRequest >= minPrice);
    if (maxPrice !== null)
      items = items.filter((a) => a.pricePerRequest <= maxPrice);

    // popularity-based ordering
    if (popularity === "mostUsed") {
      items = items.sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0));
    } else if (popularity === "newest") {
      items = items.sort(
        (a, b) =>
          Date.parse(b.createdAt ?? "1970-01-01") -
          Date.parse(a.createdAt ?? "1970-01-01"),
      );
    }

    // explicit sort options
    if (sort === "priceAsc")
      items = items.sort((a, b) => a.pricePerRequest - b.pricePerRequest);
    if (sort === "priceDesc")
      items = items.sort((a, b) => b.pricePerRequest - a.pricePerRequest);
    if (sort === "popularity")
      items = items.sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0));
    if (sort === "newest")
      items = items.sort(
        (a, b) =>
          Date.parse(b.createdAt ?? "1970-01-01") -
          Date.parse(a.createdAt ?? "1970-01-01"),
      );

    return items;
  }, [search, selectedCategories, minPrice, maxPrice, popularity, sort]);

  const displayedItems = filtered.slice(0, shown);

  const handleViewDetails = (api: APIItem | any) => {
    history.pushState({}, "", `/api/${api.id}`);
    // inform our small client router that the URL changed
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return (
    <div style={{ padding: 20 }}>
      {/* Top row: title + search only */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <h1 style={{ margin: 0, flex: "0 0 auto" }}>API Marketplace</h1>
        <div style={{ flex: 1 }}>
          <SearchBar value={search} onChange={setSearch} />
        </div>
      </div>

      {/* Bottom: filters left, content right */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "320px minmax(0, 1fr)",
          gap: 24,
        }}
      >
        <aside style={{ paddingLeft: 8 }}>
          <FiltersSidebar
            selectedCategories={selectedCategories}
            toggleCategory={toggleCategory}
            minPrice={minPrice}
            maxPrice={maxPrice}
            setMinPrice={setMinPrice}
            setMaxPrice={setMaxPrice}
            popularity={popularity}
            setPopularity={setPopularity}
            clearFilters={clearFilters}
          />
        </aside>

        <main>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <div style={{ color: "var(--muted)" }}>
              {filtered.length === 0 ? (
                <>Showing 0 of 0 APIs</>
              ) : (
                <>
                  Showing 1-{Math.min(shown, filtered.length)} of{" "}
                  {filtered.length} APIs
                </>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="relevance">Relevance</option>
                <option value="priceAsc">Price: low → high</option>
                <option value="priceDesc">Price: high → low</option>
                <option value="popularity">Popularity</option>
                <option value="newest">Newest</option>
              </select>
              <button
                className="ghost-button"
                onClick={() => setShowFiltersMobile((s) => !s)}
              >
                Filters
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              }}
            >
              {displayedItems.map((a) => (
                <ApiCard key={a.id} api={a} onViewDetails={handleViewDetails} />
              ))}
            </div>
          )}

          {filtered.length > shown && (
            <div style={{ marginTop: 16, textAlign: "center" }}>
              <button
                className="primary-button"
                onClick={() => setShown((s) => s + 12)}
              >
                Load more
              </button>
            </div>
          )}
        </main>
      </div>

      {showFiltersMobile && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "grid",
            placeItems: "center",
            zIndex: 60,
          }}
          onClick={() => setShowFiltersMobile(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "90%",
              maxWidth: 480,
              background: "var(--bg)",
              padding: 16,
              borderRadius: 8,
            }}
          >
            <h3 style={{ marginTop: 0 }}>Filters</h3>
            <FiltersSidebar
              selectedCategories={selectedCategories}
              toggleCategory={toggleCategory}
              minPrice={minPrice}
              maxPrice={maxPrice}
              setMinPrice={setMinPrice}
              setMaxPrice={setMaxPrice}
              popularity={popularity}
              setPopularity={setPopularity}
              clearFilters={clearFilters}
            />
            <div style={{ textAlign: "right", marginTop: 8 }}>
              <button
                className="primary-button"
                onClick={() => setShowFiltersMobile(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
