type BreadcrumbProps = {
  items: Array<{
    label: string;
    href: string;
    isCurrent?: boolean;
  }>;
};

export default function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav
      aria-label="breadcrumb"
      style={{
        marginBottom: 16,
        fontSize: "0.875rem",
        paddingLeft: 32
      }}
    >
      <ol
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          listStyle: "none",
          margin: 0,
          padding: 0,
        }}
      >
        {items.map((item, index) => (
          <li
            key={index}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {item.isCurrent ? (
              <span
                style={{
                  color: "var(--text)",
                  fontWeight: 500,
                }}
                aria-current="page"
              >
                {item.label}
              </span>
            ) : (
              <>
                <a
                  href={item.href}
                  style={{
                    color: "var(--accent)",
                    textDecoration: "none",
                    padding: "4px 0",
                    outline: "none",
                    borderRadius: "2px",
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      window.location.href = item.href;
                    }
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.outline = "2px solid var(--accent)";
                    e.currentTarget.style.outlineOffset = "2px";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.outline = "none";
                  }}
                >
                  {item.label}
                </a>
                {index < items.length - 1 && (
                  <span
                    aria-hidden="true"
                    style={{
                      color: "var(--muted)",
                      margin: "0 4px",
                    }}
                  >
                    →
                  </span>
                )}
              </>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
