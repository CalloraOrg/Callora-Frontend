import Dropdown from "./Dropdown";

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
 * SortDropdown — accessible combobox/listbox that lets users re-rank
 * marketplace results without opening the filters sidebar.
 *
 * Built on top of the shared {@link Dropdown} primitive which provides:
 *  - ARIA combobox / listbox roles (WAI-ARIA 1.2)
 *  - Arrow-key, Home/End, Enter, Escape navigation
 *  - Minimum 44 px hit area (WCAG 2.5.5)
 *  - Design-token styling (--line, --surface-soft, --text, --accent)
 */
export default function SortDropdown({ value, onChange }: SortDropdownProps) {
  return (
    <Dropdown<SortValue>
      id="marketplace-sort"
      value={value}
      options={SORT_OPTIONS}
      onChange={onChange}
      label="Sort marketplace results"
      visibleLabel="Sort by"
    />
  );
}
