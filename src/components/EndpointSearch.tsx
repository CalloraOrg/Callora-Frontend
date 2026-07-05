import { Search, X } from "lucide-react";

type EndpointSearchProps = {
  value: string;
  onChange: (value: string) => void;
  resultCount: number;
  totalCount: number;
  resultsId: string;
};

export default function EndpointSearch({
  value,
  onChange,
  resultCount,
  totalCount,
  resultsId,
}: EndpointSearchProps) {
  const hasQuery = value.trim().length > 0;
  const resultLabel = hasQuery
    ? `Showing ${resultCount} of ${totalCount} endpoints`
    : `${totalCount} endpoints available`;

  return (
    <div className="endpoint-search" role="search" aria-label="Endpoint search">
      <label className="endpoint-search__label" htmlFor="endpoint-search-input">
        Search endpoints
      </label>
      <div className="endpoint-search__control">
        <Search className="endpoint-search__icon" size={18} aria-hidden="true" />
        <input
          id="endpoint-search-input"
          className="endpoint-search__input"
          type="search"
          role="combobox"
          aria-controls={resultsId}
          aria-expanded="false"
          aria-autocomplete="list"
          autoComplete="off"
          placeholder="Filter by endpoint, path, method, or parameter"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        {hasQuery && (
          <button
            type="button"
            className="endpoint-search__clear"
            onClick={() => onChange("")}
            aria-label="Clear endpoint search"
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="endpoint-search__status" role="status" aria-live="polite">
        {resultLabel}
      </p>
    </div>
  );
}
