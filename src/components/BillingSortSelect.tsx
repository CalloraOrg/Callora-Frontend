import type { SortColumn, SortDirection } from '../pages/BillingHistory';

interface SortOption {
  column: SortColumn;
  direction: SortDirection;
  label: string;
}

const SORT_OPTIONS: readonly SortOption[] = [
  { column: 'date', direction: 'desc', label: 'Date: newest first' },
  { column: 'date', direction: 'asc', label: 'Date: oldest first' },
  { column: 'amount', direction: 'desc', label: 'Amount: high to low' },
  { column: 'amount', direction: 'asc', label: 'Amount: low to high' },
];

const toValue = (column: SortColumn, direction: SortDirection) => `${column}:${direction}`;

export interface BillingSortSelectProps {
  column: SortColumn | null;
  direction: SortDirection;
  onChange: (column: SortColumn, direction: SortDirection) => void;
}

/** One select that replaces the sortable table headers on small screens. */
export function BillingSortSelect({ column, direction, onChange }: BillingSortSelectProps) {
  return (
    <label className="bh-field">
      <span className="bh-field__label">Sort by</span>
      <select
        className="bh-field__control"
        aria-label="Sort transactions"
        value={column ? toValue(column, direction) : ''}
        onChange={(e) => {
          const option = SORT_OPTIONS.find((o) => toValue(o.column, o.direction) === e.target.value);
          if (option) onChange(option.column, option.direction);
        }}
      >
        {column === null && (
          <option value="" disabled>
            Default order
          </option>
        )}
        {SORT_OPTIONS.map((o) => (
          <option key={toValue(o.column, o.direction)} value={toValue(o.column, o.direction)}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default BillingSortSelect;
