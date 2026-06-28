import { useRef, type KeyboardEvent, type ChangeEvent } from "react";

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onSearch?: () => void;
}

export default function SearchBar({
  value,
  onChange,
  placeholder = "Search APIs, providers, tags...",
  onSearch,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Escape clears the input
    if (e.key === "Escape") {
      e.preventDefault();
      onChange("");
      inputRef.current?.blur();
    }
    // Enter triggers search callback (for form submission)
    if (e.key === "Enter") {
      e.preventDefault();
      onSearch?.();
    }
  };

  const handleClear = () => {
    onChange("");
    inputRef.current?.focus();
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flex: 1,
          background: "rgba(255,255,255,0.02)",
          padding: "8px 12px",
          borderRadius: 8,
          // Resting border only. The keyboard-focus ring is supplied globally
          // by `@layer focus` (input:focus-visible) — no inline outline hacks,
          // so mouse clicks stay ring-less.
          border: "2px solid transparent",
        }}
        role="search"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          style={{ color: "var(--text-secondary, #9ca3af)", flexShrink: 0 }}
        >
          <path
            d="M21 21l-4.35-4.35"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx="11"
            cy="11"
            r="6"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <input
          ref={inputRef}
          type="search"
          aria-label="Search APIs"
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text)",
            width: "100%",
            fontSize: 14,
          }}
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 4,
              color: "var(--text-secondary, #9ca3af)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--text)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-secondary, #9ca3af)";
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}