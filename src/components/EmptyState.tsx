export default function EmptyState({
  title = "No APIs found",
  message = "Try adjusting your filters",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div style={{ textAlign: "center", padding: 32 }}>
      <div style={{ width: 160, margin: "0 auto 12px" }}>
        <svg viewBox="0 0 64 64" width="100%" height="100%" fill="none">
          <rect
            x="6"
            y="14"
            width="52"
            height="36"
            rx="4"
            stroke="currentColor"
            strokeOpacity={0.08}
          />
          <circle
            cx="32"
            cy="32"
            r="8"
            stroke="currentColor"
            strokeOpacity={0.06}
          />
        </svg>
      </div>
      <h3 style={{ margin: 0 }}>{title}</h3>
      <div style={{ color: "var(--muted)", marginTop: 8 }}>{message}</div>
    </div>
  );
}
