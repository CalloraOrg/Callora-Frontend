import React, { CSSProperties } from "react";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: CSSProperties;
  className?: string;
}

export default function Skeleton({
  width,
  height,
  borderRadius,
  style,
  className = "",
}: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      aria-hidden="true"
      role="presentation"
      style={{
        width,
        height,
        borderRadius,
        ...style,
      }}
    />
  );
}


const TABLE_CELL_VARIANTS = [
  "timestamp",
  "endpoint",
  "status",
  "response-time",
  "cost",
  "action",
] as const;

// Mirrors the six cells and responsive span wrappers in CallHistoryRow.
export function SkeletonRow({ rows = 3 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <div className="table-row" aria-hidden="true" key={i}>
          {TABLE_CELL_VARIANTS.map((variant) => (
            <span className="skeleton-cell-slot" key={variant}>
              <Skeleton
                className={`skeleton-cell skeleton-cell--${variant}`}
              />
            </span>
          ))}
        </div>
      ))}
    </>
  );
}
