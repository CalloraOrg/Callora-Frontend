/**
 * Dropdown.tsx
 *
 * A fully-accessible, keyboard-navigable dropdown that applies the
 * ARIA combobox / listbox design pattern (WAI-ARIA 1.2).
 *
 * Keyboard behaviour
 * ──────────────────
 *   Space / Enter / ArrowDown / ArrowUp (on trigger) → opens the listbox
 *   ArrowDown   → moves focus to the next option (wraps at bottom)
 *   ArrowUp     → moves focus to the previous option (wraps at top)
 *   Home        → moves focus to the first option
 *   End         → moves focus to the last option
 *   Enter       → selects the focused option and closes
 *   Escape      → closes without selecting, returns focus to trigger
 *   Tab         → closes the listbox (natural focus move)
 *
 * ARIA mapping
 * ────────────
 *   trigger   role="combobox"  aria-haspopup="listbox"  aria-expanded
 *             aria-controls={listId}  aria-activedescendant={focused option id}
 *   listbox   role="listbox"   aria-label
 *   options   role="option"    aria-selected  id
 */

import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DropdownOption<T extends string = string> {
  /** Machine-readable value passed to onChange */
  value: T;
  /** Human-readable label displayed in the list */
  label: string;
  /** Optionally disable this specific option */
  disabled?: boolean;
}

export interface DropdownProps<T extends string = string> {
  /** Currently selected value */
  value: T;
  /** Available options */
  options: DropdownOption<T>[];
  /** Called when the user commits a selection */
  onChange: (value: T) => void;
  /** Accessible label for the listbox, read by screen readers */
  label: string;
  /** Visible label rendered before the trigger button. Pass null to omit. */
  visibleLabel?: string | null;
  /** HTML id for the trigger element — forwarded to outer <label> htmlFor */
  id?: string;
  /** Additional class name applied to the root wrapper */
  className?: string;
  /** Disable the entire dropdown */
  disabled?: boolean;
  /** Placeholder text shown on the trigger when no option matches value */
  placeholder?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Accessible dropdown implementing the ARIA combobox/listbox pattern.
 * Supports full keyboard navigation with arrow keys, Home/End, Enter, and Escape.
 */
export function Dropdown<T extends string = string>({
  value,
  options,
  onChange,
  label,
  visibleLabel,
  id: externalId,
  className,
  disabled = false,
  placeholder,
}: DropdownProps<T>): React.JSX.Element {
  const autoId = useId();
  const triggerId = externalId ?? `dropdown-trigger-${autoId}`;
  const listId = `dropdown-list-${autoId}`;
  /** Returns a stable, unique id for an option at a given index. */
  const getOptionId = (idx: number) => `dropdown-option-${autoId}-${idx}`;

  const [open, setOpen] = useState(false);
  // activeIndex is the keyboard-focused option (not yet committed)
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Derive currently selected index for initialising activeIndex on open
  const selectedIndex = options.findIndex((o) => o.value === value);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const closeList = useCallback((returnFocus = true) => {
    setOpen(false);
    setActiveIndex(-1);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const commitOption = useCallback(
    (idx: number) => {
      const opt = options[idx];
      if (!opt || opt.disabled) return;
      onChange(opt.value as T);
      closeList();
    },
    [options, onChange, closeList],
  );

  // ── Open / close side-effects ──────────────────────────────────────────────

  // When the list opens, set the active index to the currently selected option
  useEffect(() => {
    if (!open) return;
    const initialActive = selectedIndex >= 0 ? selectedIndex : 0;
    setActiveIndex(initialActive);
  }, [open, selectedIndex]);

  // When opened, put keyboard focus on the listbox element so key events fire
  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  // Scroll the active option into view inside the listbox
  useEffect(() => {
    if (!open || activeIndex < 0 || !listRef.current) return;
    const optEl = listRef.current.querySelector<HTMLElement>(
      `[data-opt-idx="${activeIndex}"]`,
    );
    // scrollIntoView may be absent in some test environments (jsdom)
    if (optEl && typeof optEl.scrollIntoView === "function") {
      optEl.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        closeList(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open, closeList]);

  // ── Keyboard handlers ──────────────────────────────────────────────────────

  /** Handler attached to the trigger button */
  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    switch (e.key) {
      case " ":
      case "Enter":
      case "ArrowDown":
      case "ArrowUp":
        e.preventDefault();
        setOpen(true);
        break;
      default:
        break;
    }
  };

  /** Handler attached to the listbox <ul> */
  const handleListKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    const enabledIndices = options
      .map((o, i) => ({ o, i }))
      .filter(({ o }) => !o.disabled)
      .map(({ i }) => i);

    if (enabledIndices.length === 0) return;

    const currentEnabledPos = enabledIndices.indexOf(activeIndex);

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        const next =
          currentEnabledPos < enabledIndices.length - 1
            ? enabledIndices[currentEnabledPos + 1]
            : enabledIndices[0]; // wrap to first
        setActiveIndex(next);
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prev =
          currentEnabledPos > 0
            ? enabledIndices[currentEnabledPos - 1]
            : enabledIndices[enabledIndices.length - 1]; // wrap to last
        setActiveIndex(prev);
        break;
      }
      case "Home":
        e.preventDefault();
        setActiveIndex(enabledIndices[0]);
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(enabledIndices[enabledIndices.length - 1]);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        commitOption(activeIndex);
        break;
      case "Escape":
        e.preventDefault();
        closeList();
        break;
      case "Tab":
        closeList(false);
        break;
      default:
        break;
    }
  };

  // ── Derived display ────────────────────────────────────────────────────────

  const selectedOption = options.find((o) => o.value === value);
  const displayLabel = selectedOption?.label ?? placeholder ?? "Select…";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className={`dropdown-root${className ? ` ${className}` : ""}`}
      style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 8 }}
    >
      {/* Visible label */}
      {visibleLabel != null && (
        <label
          htmlFor={triggerId}
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "var(--muted)",
            whiteSpace: "nowrap",
            userSelect: "none",
          }}
        >
          {visibleLabel}
        </label>
      )}

      {/* Trigger button — role="combobox" */}
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={
          open && activeIndex >= 0 ? getOptionId(activeIndex) : undefined
        }
        aria-label={label}
        aria-disabled={disabled}
        disabled={disabled}
        onClick={() => !disabled && setOpen((s) => !s)}
        onKeyDown={handleTriggerKeyDown}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          appearance: "none",
          background: "var(--surface-soft)",
          border: open
            ? "2px solid var(--accent, #2563eb)"
            : "1px solid var(--line)",
          borderRadius: "var(--radius-md, 16px)",
          color: "var(--text)",
          cursor: disabled ? "not-allowed" : "pointer",
          fontSize: 13,
          fontWeight: 500,
          minHeight: 44,
          opacity: disabled ? 0.5 : 1,
          outline: open ? "2px solid var(--accent, #2563eb)" : "none",
          outlineOffset: "2px",
          padding: "8px 32px 8px 12px",
          transition: "border-color 0.2s ease, box-shadow 0.2s ease",
          userSelect: "none",
          whiteSpace: "nowrap",
          // Chevron via background SVG (matches SortDropdown aesthetic)
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2393a0bf' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 10px center",
        }}
      >
        {displayLabel}
      </button>

      {/* Listbox */}
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={label}
          tabIndex={0}
          onKeyDown={handleListKeyDown}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 200,
            minWidth: "100%",
            maxHeight: 280,
            overflowY: "auto",
            margin: 0,
            padding: "4px 0",
            listStyle: "none",
            background: "var(--surface-strong, rgba(17,24,46,0.98))",
            border: "1px solid var(--line-strong, rgba(169,184,255,0.28))",
            borderRadius: 12,
            boxShadow: "var(--shadow, 0 8px 32px rgba(0,0,0,0.4))",
            backdropFilter: "blur(20px)",
            outline: "none",
          }}
        >
          {options.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isActive = idx === activeIndex;

            return (
              <li
                key={opt.value}
                id={getOptionId(idx)}
                data-opt-idx={idx}
                role="option"
                aria-selected={isSelected}
                aria-disabled={opt.disabled}
                onMouseEnter={() => !opt.disabled && setActiveIndex(idx)}
                onClick={() => commitOption(idx)}
                style={{
                  padding: "9px 14px",
                  fontSize: 13,
                  fontWeight: isSelected ? 600 : 400,
                  color: opt.disabled
                    ? "var(--muted)"
                    : isSelected
                    ? "var(--accent, #4e85ff)"
                    : "var(--text)",
                  background: isActive
                    ? "rgba(78,133,255,0.12)"
                    : "transparent",
                  cursor: opt.disabled ? "default" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  transition: "background 100ms ease",
                  userSelect: "none",
                }}
              >
                {/* Selected checkmark (decorative) */}
                <span
                  aria-hidden="true"
                  style={{
                    width: 14,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    color: "var(--accent, #4e85ff)",
                    flexShrink: 0,
                  }}
                >
                  {isSelected ? "✓" : ""}
                </span>
                {opt.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default Dropdown;
