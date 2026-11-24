import { useState, useRef, KeyboardEvent } from "react";
import { useAccountContext } from "../hooks/useAccountContext";
import { resolveTimeZone } from "../utils/format";

export type HealthStatus = "operational" | "degraded" | "down";

export interface HealthTimelineProps {
  data?: HealthStatus[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const statusColors: Record<HealthStatus, string> = {
  operational: "#10b981", // Green
  degraded: "#f59e0b", // Yellow
  down: "#ef4444", // Red
};

// Patterns for color-blind accessibility
const statusPatterns: Record<HealthStatus, string> = {
  operational: "none",
  degraded:
    "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.15) 4px, rgba(0,0,0,0.15) 8px)",
  down: "repeating-linear-gradient(45deg, rgba(0,0,0,0.3), rgba(0,0,0,0.3) 4px, transparent 4px, transparent 8px), repeating-linear-gradient(-45deg, rgba(0,0,0,0.3), rgba(0,0,0,0.3) 4px, transparent 4px, transparent 8px)",
};

const statusLabels: Record<HealthStatus, string> = {
  operational: "Operational",
  degraded: "Degraded",
  down: "Down (outage)",
};

function buildSummary(data: HealthStatus[]): string {
  const periodLabel = data.length === 1 ? "1h" : `${data.length}h`;
  let degradedCount = 0;
  let downCount = 0;

  for (const status of data) {
    if (status === "degraded") degradedCount += 1;
    else if (status === "down") downCount += 1;
  }

  if (degradedCount === 0 && downCount === 0) {
    return `All systems operational in the last ${periodLabel}`;
  }

  const parts: string[] = [];
  if (degradedCount > 0) {
    parts.push(
      `${degradedCount} degraded ${degradedCount === 1 ? "period" : "periods"}`,
    );
  }
  if (downCount > 0) {
    parts.push(`${downCount} ${downCount === 1 ? "outage" : "outages"}`);
  }

  return `${parts.join(", ")} in the last ${periodLabel}`;
}

export default function HealthTimeline({
  data = [],
  loading = false,
  error = null,
  onRetry,
}: HealthTimelineProps) {
  const { timezone } = useAccountContext();
  const dateZone = resolveTimeZone(timezone);
  const zoneAbbreviation = new Intl.DateTimeFormat(undefined, {
    timeZone: dateZone,
    timeZoneName: "short",
  })
    .formatToParts(new Date())
    .find((part) => part.type === "timeZoneName")?.value;

  const timelineData: HealthStatus[] = Array<HealthStatus>(24).fill("operational").map((def, i) => data[i] ?? def);
  const [activeTooltip, setActiveTooltip] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  if (loading) {
    return (
      <div
        style={{ minHeight: 84, display: "flex", flexDirection: "column", justifyContent: "space-between" }}
        role="status"
        aria-busy="true"
        aria-label="Loading health timeline"
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span
            className="skeleton"
            style={{ width: 72, height: 14, borderRadius: 4, display: "inline-block" }}
          />
          <span
            className="skeleton"
            style={{ width: 64, height: 14, borderRadius: 4, display: "inline-block" }}
          />
        </div>
        <div
          style={{
            display: "flex",
            height: 32,
            gap: 2,
            width: "100%",
          }}
          aria-hidden="true"
        >
          {Array.from({ length: 24 }, (_, idx) => (
            <div
              key={idx}
              className="skeleton"
              style={{
                flex: "1 1 0",
                minWidth: 0,
                height: "100%",
                borderRadius: 2,
                backgroundColor: "var(--line, rgba(255,255,255,0.08))",
              }}
            />
          ))}
        </div>
        <div style={{ marginTop: 8 }}>
          <span
            className="skeleton"
            style={{ width: "65%", height: 14, borderRadius: 4, display: "inline-block" }}
          />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        style={{
          minHeight: 84,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 8,
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid var(--border-subtle, rgba(239, 68, 68, 0.35))",
          backgroundColor: "rgba(239, 68, 68, 0.06)",
        }}
      >
        <p style={{ margin: 0, fontSize: 13, color: "var(--text)" }}>{error}</p>
        {onRetry && (
          <div>
            <button
              type="button"
              className="ghost-button"
              onClick={onRetry}
              style={{ fontSize: 12, padding: "4px 10px" }}
            >
              Retry
            </button>
          </div>
        )}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        style={{
          minHeight: 84,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px dashed var(--line, rgba(255,255,255,0.12))",
        }}
      >
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
          No health data yet
        </p>
      </div>
    );
  }

  const timelineData = data;
  const lastIndex = timelineData.length - 1;
  const startLabel =
    timelineData.length === 1
      ? "1 hour ago"
      : `${timelineData.length} hours ago`;
  const summaryText = buildSummary(timelineData);

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    if (e.key === "ArrowRight") {
      nextIndex = Math.min(lastIndex, index + 1);
    } else if (e.key === "ArrowLeft") {
      nextIndex = Math.max(0, index - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setActiveTooltip(activeTooltip === index ? null : index);
      return;
    }

    if (nextIndex !== index) {
      e.preventDefault();
      const buttons = containerRef.current?.querySelectorAll("button");
      buttons?.[nextIndex]?.focus();
      setActiveTooltip(null);
    }
  };

  const getHourLabel = (index: number) => {
    const date = new Date(Date.now() - (lastIndex - index) * 60 * 60 * 1000);
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: dateZone,
    }).format(date);
  };

  return (
    <div style={{ minHeight: 84 }}>
      <div
        style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}
      >
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{startLabel}</span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          Now ({zoneAbbreviation ?? dateZone})
        </span>
      </div>
      <div
        ref={containerRef}
        style={{
          display: "flex",
          height: 32,
          gap: timelineData.length > 48 ? 1 : 2,
          width: "100%",
          position: "relative",
        }}
        role="group"
        aria-label={`${timelineData.length}-hour health timeline`}
      >
        {timelineData.map((status, index) => {
          const hourLabel = getHourLabel(index);
          const statusLabel = statusLabels[status];
          const isTooltipVisible = activeTooltip === index;

          return (
            <div
              key={index}
              style={{ flex: "1 1 0", minWidth: 0, position: "relative" }}
              onMouseEnter={() => setActiveTooltip(index)}
              onMouseLeave={() => setActiveTooltip(null)}
              onBlur={() => setActiveTooltip(null)}
            >
              <button
                type="button"
                aria-label={`${hourLabel}: ${statusLabel}`}
                data-status={status}
                style={{
                  width: "100%",
                  height: "100%",
                  backgroundColor: statusColors[status],
                  backgroundImage: statusPatterns[status],
                  border: "none",
                  borderRadius: 2,
                  cursor: "pointer",
                  padding: 0,
                  display: "block",
                }}
                onKeyDown={(e) => handleKeyDown(e, index)}
              />
              {isTooltipVisible && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "100%",
                    left: "50%",
                    transform: "translateX(-50%)",
                    marginBottom: 8,
                    backgroundColor: "var(--bg-elevated, #1f2937)",
                    color: "var(--text-main, #f9fafb)",
                    padding: "6px 10px",
                    borderRadius: 6,
                    fontSize: 12,
                    whiteSpace: "nowrap",
                    zIndex: 10,
                    pointerEvents: "none",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    border: "1px solid var(--border-subtle, #374151)",
                  }}
                  role="tooltip"
                  aria-live="polite"
                >
                  <strong style={{ display: "block", marginBottom: 4 }}>
                    {hourLabel}
                  </strong>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        backgroundColor: statusColors[status],
                        backgroundImage: statusPatterns[status],
                        display: "inline-block",
                      }}
                    />
                    <span>{statusLabel}</span>
                  </div>
                  {/* Tooltip arrow */}
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: "50%",
                      transform: "translateX(-50%)",
                      borderWidth: "5px",
                      borderStyle: "solid",
                      borderColor:
                        "var(--border-subtle, #374151) transparent transparent transparent",
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p
        style={{
          margin: "8px 0 0",
          fontSize: 12,
          color: "var(--muted)",
          lineHeight: 1.4,
        }}
      >
        {summaryText}
      </p>
    </div>
  );
}
