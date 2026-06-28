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
      style={{
        width,
        height,
        borderRadius,
        ...style,
      }}
    />
  );
}

// Row variant for table loading
export function SkeletonRow({ rows = 5 }: { rows?: number }) {
  const rowSkeleton = (
    <div className="table-row">
      <Skeleton width="60%" height="16px" className="skeleton-cell" />
      <Skeleton width="85%" height="16px" className="skeleton-cell" />
      <Skeleton width="50%" height="16px" className="skeleton-cell" />
      <Skeleton width="45%" height="16px" className="skeleton-cell" />
      <Skeleton width="35%" height="16px" className="skeleton-cell" />
      <Skeleton width="50%" height="16px" className="skeleton-cell" />
    </div>
  );
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <React.Fragment key={i}>{rowSkeleton}</React.Fragment>
      ))}
    </>
  );
}

