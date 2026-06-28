import { Fragment, CSSProperties } from "react";

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

// Row variant for table loading
export function SkeletonRow({ rows = 5 }: { rows?: number }) {
  const rowSkeleton = (
    <div className="table-row">
      <Skeleton width="120px" height="16px" className="skeleton-cell" />
      <Skeleton width="200px" height="16px" className="skeleton-cell" />
      <Skeleton width="80px" height="16px" className="skeleton-cell" />
      <Skeleton width="80px" height="16px" className="skeleton-cell" />
      <Skeleton width="60px" height="16px" className="skeleton-cell" />
      <Skeleton width="40px" height="16px" className="skeleton-cell" />
    </div>
  );
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <Fragment key={i}>{rowSkeleton}</Fragment>
      ))}
    </>
  );
}
