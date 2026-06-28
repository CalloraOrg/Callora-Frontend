import React, { useState, useRef, KeyboardEvent } from "react";

export type HealthStatus = "operational" | "degraded" | "down";

interface HealthTimelineProps {
  data?: HealthStatus[];
}

const statusColors = {
  operational: "#10b981", // Green
  degraded: "#f59e0b", // Yellow
  down: "#ef4444", // Red
};

// Patterns for color-blind accessibility
const statusPatterns = {
  operational: "none",
  degraded: "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.15) 4px, rgba(0,0,0,0.15) 8px)",
  down: "repeating-linear-gradient(45deg, rgba(0,0,0,0.3), rgba(0,0,0,0.3) 4px, transparent 4px, transparent 8px), repeating-linear-gradient(-45deg, rgba(0,0,0,0.3), rgba(0,0,0,0.3) 4px, transparent 4px, transparent 8px)",
};

const statusLabels = {
  operational: "Operational",
  degraded: "Degraded",
  down: "Down",
};

export default function HealthTimeline({ data = [] }: HealthTimelineProps) {
  // Ensure we have exactly 24 items, default to operational if not provided
  const timelineData = Array(24).fill("operational").map((def, i) => data[i] || def);
  
  const [activeTooltip, setActiveTooltip] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    if (e.key === "ArrowRight") {
      nextIndex = Math.min(23, index + 1);
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
      setActiveTooltip(null); // Hide tooltip when moving focus
    }
  };

  const getHourLabel = (index: number) => {
    // Current time minus (23 - index) hours
    const date = new Date();
    date.setHours(date.getHours() - (23 - index));
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ marginTop: 24 }}>
      <div 
        style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}
      >
        <span style={{ fontSize: 12, color: "var(--muted)" }}>24 hours ago</span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>Now</span>
      </div>
      <div 
        ref={containerRef}
        style={{ 
          display: "flex", 
          height: 32, 
          gap: 2, 
          width: "100%", 
          position: "relative" 
        }}
        role="group"
        aria-label="24-hour health timeline"
      >
        {timelineData.map((status, index) => {
          const hourLabel = getHourLabel(index);
          const statusLabel = statusLabels[status];
          const isTooltipVisible = activeTooltip === index;

          return (
            <div 
              key={index} 
              style={{ flex: 1, position: "relative" }}
              onMouseEnter={() => setActiveTooltip(index)}
              onMouseLeave={() => setActiveTooltip(null)}
              onBlur={() => setActiveTooltip(null)}
            >
              <button
                type="button"
                aria-label={`${hourLabel}: ${statusLabel}`}
                style={{
                  width: "100%",
                  height: "100%",
                  backgroundColor: statusColors[status],
                  backgroundImage: statusPatterns[status],
                  border: "none",
                  borderRadius: 2,
                  cursor: "pointer",
                  padding: 0,
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
                    border: "1px solid var(--border-subtle, #374151)"
                  }}
                  role="tooltip"
                  aria-live="polite"
                >
                  <strong style={{ display: "block", marginBottom: 4 }}>{hourLabel}</strong>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span 
                      style={{ 
                        width: 10, 
                        height: 10, 
                        borderRadius: "50%", 
                        backgroundColor: statusColors[status],
                        backgroundImage: statusPatterns[status],
                        display: "inline-block" 
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
                      borderColor: "var(--border-subtle, #374151) transparent transparent transparent"
                    }} 
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
