import { useState, type ChangeEvent } from "react";

/**
 * Sort option values used by the marketplace sort dropdown.
 * These values are persisted in the URL query param ?sort=
 */
export type SortValue = "popularity" | "price-asc" | "latency-asc" | "newest";

export interface SortDropdownProps {
  /** Current selected sort value */
  value: SortValue;
  /** Called when the user selects a different sort option */
  onChange: (value: SortValue) => void;
}

/** Ordered set of sort options displayed in the dropdown */
const SORT_OPTIONS: { value: SortValue; label: string }[] = [
  { value: "popularity", label: "Popularity" },
  { value: "price-asc", label: "Price ascending" },
  { value: "latency-asc", label: "Latency ascending" },
  { value: "newest", label: "Newest" },
];

/**
 * SortDropdown — a native `<select>` wrapper that lets users re-rank
 * marketplace results without opening the filters sidebar.
 *
 * - Uses design tokens (--line, --surface-soft, --text, --focus-ring, --accent)
 * - Dropdown label is programmatically associated via htmlFor
 * - Minimum 44px hit area for touch accessibility (WCAG 2.5.5)
 */
export default function SortDropdown({
  value,
  onChange,
}: SortDropdownProps): JSX.Element {
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value as SortValue);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
      <label
        htmlFor="marketplace-sort"
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: "var(--muted)",
          whiteSpace: "nowrap",
        }}
      >
        Sort by
      </label>
      <select
        id="marketplace-sort"
        value={value}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        aria-label="Sort marketplace results"
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          background: "var(--surface-soft)",
          border: isFocused
            ? "2px solid var(--accent, #2563eb)"
            : "1px solid var(--line)",
          borderRadius: "var(--radius-md, 16px)",
          color: "var(--text)",
          fontSize: 13,
          fontWeight: 500,
          padding: "8px 32px 8px 12px",
          minHeight: 44,
          cursor: "pointer",
          outline: isFocused
            ? "2px solid var(--accent, #2563eb)"
            : "none",
          outlineOffset: "2px",
          boxShadow: isFocused ? "var(--focus-ring)" : "none",
          transition: "border-color 0.2s ease, box-shadow 0.2s ease",
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2393a0bf' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 10px center",
        }}
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
