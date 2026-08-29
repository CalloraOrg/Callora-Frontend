import "../styles/contrast.css";

type StatusIndicatorProps = {
  label: string;
  active?: boolean;
};

export default function StatusIndicator({
  label,
  active = false,
}: StatusIndicatorProps): JSX.Element {
  return (
    <div
      className={`status-indicator${active ? " active" : ""}`}
      role="status"
      aria-label={label}
    >
      <span className="status-dot" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
