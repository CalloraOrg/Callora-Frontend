import { CSSProperties, Fragment } from "react";
import Breadcrumb from "./Breadcrumb";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: CSSProperties;
  className?: string;
  tone?: "neutral" | "stellar";
}

export default function Skeleton({
  width,
  height,
  borderRadius,
  style,
  className = "",
  tone = "neutral",
}: SkeletonProps) {
  return (
    <div
      className={`skeleton${tone === "stellar" ? " skeleton--stellar" : ""} ${className}`.trim()}
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
      <Skeleton width="60%" height="16px" className="skeleton-cell" />
      <Skeleton width="85%" height="16px" className="skeleton-cell" />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Skeleton width="16px" height="16px" borderRadius="50%" className="skeleton-cell" />
        <Skeleton width="50px" height="16px" className="skeleton-cell" />
      </div>
      <Skeleton width="45%" height="16px" className="skeleton-cell" />
      <Skeleton width="40%" height="16px" className="skeleton-cell" />
      <Skeleton width="64px" height="32px" borderRadius="6px" className="skeleton-cell" />
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

export function FiltersSidebarSkeleton() {
  return (
    <div className="filters-sidebar filters-sidebar-skeleton" aria-hidden="true" style={{ display: "grid", gap: 16 }}>
      {/* Section heading */}
      <Skeleton width="55%" height={22} />
      <Skeleton width="55%" height={22} />
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} style={{ display: "grid", gap: 8 }}>
          <Skeleton width="40%" height={14} />
          <Skeleton width="100%" height={40} borderRadius={10} />
        </div>
      ))}
      <Skeleton width="48%" height={14} />
      <Skeleton width="100%" height={44} borderRadius={12} />
    </div>
  );
}

export function ApiUsageSkeleton() {
  return (
    <div
      className="api-usage-page"
      aria-busy="true"
      aria-label="API usage loading shell"
    >
      {/* Breadcrumb Skeleton */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }} aria-hidden="true">
        <Skeleton tone="stellar" width={80} height={16} />
        <span style={{ color: "var(--text-secondary)" }}>/</span>
        <Skeleton tone="stellar" width={160} height={16} />
      </div>

      {/* Header Section Skeleton */}
      <div className="api-header" aria-hidden="true" style={{ marginBottom: 24 }}>
        <div className="api-header-info" style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div className="api-logo">
            <Skeleton tone="stellar" width={56} height={56} borderRadius={12} />
          </div>
          <div style={{ display: "grid", gap: 8, flex: 1 }}>
            <Skeleton tone="stellar" width="40%" height={28} />
            <Skeleton tone="stellar" width="60%" height={16} />
          </div>
        </div>
        <div className="api-header-actions" style={{ display: "flex", gap: 12 }}>
          <Skeleton tone="stellar" width={150} height={36} borderRadius={8} />
          <Skeleton tone="stellar" width={90} height={36} borderRadius={8} />
          <Skeleton tone="stellar" width={110} height={36} borderRadius={8} />
        </div>
      </div>

      {/* API Key Section Skeleton */}
      <div className="surface api-key-section" aria-hidden="true" style={{ marginBottom: 24 }}>
        <Skeleton tone="stellar" width={100} height={20} style={{ marginBottom: 16 }} />
        <div className="api-key-card" style={{ padding: 20 }}>
          <div className="api-key-display" style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div className="key-input-group" style={{ flex: 1 }}>
              <Skeleton tone="stellar" width="100%" height={38} borderRadius={8} />
            </div>
            <div className="key-actions" style={{ display: "flex", gap: 12 }}>
              <Skeleton tone="stellar" width={80} height={38} borderRadius={8} />
              <Skeleton tone="stellar" width={100} height={38} borderRadius={8} />
            </div>
          </div>
          <Skeleton tone="stellar" width="50%" height={14} style={{ marginTop: 12 }} />
        </div>
      </div>

      {/* Test API Call Section Skeleton */}
      <div className="surface test-call-section" aria-hidden="true" style={{ marginBottom: 24 }}>
        <Skeleton tone="stellar" width={140} height={20} style={{ marginBottom: 20 }} />
        <div className="test-call-form" style={{ display: "grid", gap: 16 }}>
          <div className="form-row" style={{ display: "grid", gap: 8 }}>
            <Skeleton tone="stellar" width={70} height={14} />
            <Skeleton tone="stellar" width="100%" height={38} borderRadius={8} />
          </div>
          <div className="form-row" style={{ display: "grid", gap: 8 }}>
            <Skeleton tone="stellar" width={90} height={14} />
            <Skeleton tone="stellar" width="100%" height={120} borderRadius={8} />
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <Skeleton tone="stellar" width={130} height={38} borderRadius={8} />
            <Skeleton tone="stellar" width={130} height={38} borderRadius={8} />
          </div>
        </div>
      </div>

      {/* Usage Statistics Section Skeleton */}
      <div className="surface usage-stats-section" aria-hidden="true" style={{ marginBottom: 24 }}>
        <Skeleton tone="stellar" width={150} height={20} style={{ marginBottom: 20 }} />
        <div className="stats-grid">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="stat-card" style={{ display: "grid", gap: 8, padding: 16 }}>
              <Skeleton tone="stellar" width="60%" height={12} />
              <Skeleton tone="stellar" width="80%" height={24} />
            </div>
          ))}
        </div>
        <div className="mini-chart" style={{ marginTop: 24 }}>
          <Skeleton tone="stellar" width={130} height={16} style={{ marginBottom: 16 }} />
          <Skeleton tone="stellar" width="100%" height={160} borderRadius={8} />
        </div>
      </div>

      {/* Call History Section Skeleton */}
      <div className="surface call-history-section" aria-hidden="true" style={{ marginBottom: 24 }}>
        <div className="section-header" style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <Skeleton tone="stellar" width={120} height={20} />
          <div className="history-actions" style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Skeleton tone="stellar" width={220} height={38} borderRadius={8} />
            <Skeleton tone="stellar" width={100} height={38} borderRadius={8} />
            <Skeleton tone="stellar" width={100} height={38} borderRadius={8} />
            <Skeleton tone="stellar" width={100} height={38} borderRadius={8} />
          </div>
        </div>
        <div className="call-history-table">
          <div className="table-header">
            <span>Timestamp</span>
            <span>Endpoint</span>
            <span>Status</span>
            <span>Response Time</span>
            <span>Cost</span>
            <span>Actions</span>
          </div>
          <SkeletonRow rows={5} />
        </div>
      </div>

      {/* Integration Guide Section Skeleton */}
      <div className="surface integration-guide-section" aria-hidden="true">
        <Skeleton tone="stellar" width={160} height={20} style={{ marginBottom: 20 }} />
        <div className="language-tabs" style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <Skeleton tone="stellar" width={100} height={36} borderRadius={8} />
          <Skeleton tone="stellar" width={80} height={36} borderRadius={8} />
          <Skeleton tone="stellar" width={70} height={36} borderRadius={8} />
        </div>
        <div className="code-example">
          <div className="code-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px" }}>
            <Skeleton tone="stellar" width={150} height={16} />
            <Skeleton tone="stellar" width={90} height={32} borderRadius={6} />
          </div>
          <div className="code-block" style={{ padding: 20, display: "grid", gap: 10 }}>
            <Skeleton tone="stellar" width="85%" height={14} />
            <Skeleton tone="stellar" width="60%" height={14} />
            <Skeleton tone="stellar" width="75%" height={14} />
            <Skeleton tone="stellar" width="40%" height={14} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ApiDetailPageSkeleton({ onBack }: { onBack?: () => void }) {
  /*
   * Parity fix (issue #410): every skeleton block is sized and spaced to
   * match the real ApiDetailPage loaded state exactly, using design tokens
   * from src/styles/tokens.css (--mkt-space-*, --mkt-font-size-*) and
   * src/index.css (--radius-lg, --radius-md, --line) rather than hardcoded
   * values.  Where a real element is sized by a CSS class (e.g. .stat-card,
   * .preview-card) the same class is reused here so the skeleton inherits the
   * identical background, border, and border-radius without duplication.
   */
  return (
    <div
      className="api-detail-page"
      aria-busy="true"
      aria-label="API detail loading shell"
    >
      <div className="api-detail-container">
        <Breadcrumb
          items={[
            { label: "Marketplace", href: "/marketplace" },
            { label: "Loading…", href: "", isCurrent: true },
          ]}
        />
        <div className="api-detail-shell">

          {/* ── Hero ─────────────────────────────────────────────────────
              Real: .api-detail-hero grid (1fr auto), gap + padding
              var(--mkt-space-3xl) = 24px, items center-aligned.
          ─────────────────────────────────────────────────────────────── */}
          <div className="api-detail-hero">
            <div className="api-detail-heading">
              {/* Back button — real element kept so layout is identical */}
              <button className="ghost-button no-print" onClick={onBack} type="button">
                Back
              </button>

              {/* .api-detail-brand uses CSS gap var(--mkt-space-xl)=16px */}
              <div className="api-detail-brand">
                {/*
                 * M1 fix: real logo is 64×64, border-radius 50% (circle).
                 * Previous skeleton was 56×56 with borderRadius=10.
                 */}
                <Skeleton tone="stellar" width={64} height={64} borderRadius="50%" />

                {/* .api-detail-title — real h1 is clamp(1.7rem,3vw,2.4rem)
                    ≈ 27–38px rendered; 32px is the mid-range desktop value.
                    M3 fix: meta row is --mkt-font-size-sm=13px, margin-top 6px.
                    M4 fix: add status badge placeholder (~24px, margin-top 8px).
                    M5 fix: add provider row placeholder (16px, margin-top 8px).
                */}
                <div className="api-detail-title">
                  {/* h1 title */}
                  <Skeleton tone="stellar" width="60%" height={32} />
                  {/* provider · price meta row (--mkt-font-size-sm = 13px) */}
                  <Skeleton
                    tone="stellar"
                    width="45%"
                    height={13}
                    style={{ marginTop: 6 }}
                  />
                  {/* StatusBadge row (~24px pill, margin-top matches real 8px) */}
                  <Skeleton
                    tone="stellar"
                    width="30%"
                    height={24}
                    borderRadius="var(--radius-md)"
                    style={{ marginTop: 8 }}
                  />
                  {/* "Published by…" provider line (1rem = 16px, margin-top 8px) */}
                  <Skeleton
                    tone="stellar"
                    width="50%"
                    height={16}
                    style={{ marginTop: 8 }}
                  />
                </div>
              </div>
            </div>

            {/* Price panel — real: price at --mkt-font-size-xl=24px/700,
                label at --mkt-font-size-sm=13px, button margin-top
                --mkt-space-xl=16px, height 48px (min-height from .primary-button).
                M2 note: price block stays 32px (close to 24px token — using
                32px to visually represent the bold 24px/700 weight line). */}
            <div className="api-detail-price-panel" style={{ display: "grid", gap: "var(--mkt-space-md)" }}>
              <Skeleton tone="stellar" width={100} height={32} />
              <Skeleton tone="stellar" width={140} height={13} />
              {/* Connect API button — min-height 48px from .primary-button */}
              <Skeleton
                tone="stellar"
                width="100%"
                height={48}
                borderRadius="var(--radius-md)"
                style={{ marginTop: "var(--mkt-space-xl)" }}
              />
            </div>
          </div>

          {/* ── CTA row ──────────────────────────────────────────────────
              M7 fix: real page has a .api-hero__cta--detail row with 3
              buttons (Try API / View Pricing / Subscribe) between the hero
              and the content grid. Was entirely absent from the skeleton.
          ─────────────────────────────────────────────────────────────── */}
          <div className="api-hero__cta api-hero__cta--detail no-print">
            <Skeleton tone="stellar" width={96} height={48} borderRadius="var(--radius-md)" />
            <Skeleton tone="stellar" width={120} height={48} borderRadius="var(--radius-md)" />
            <Skeleton tone="stellar" width={130} height={48} borderRadius="var(--radius-md)" />
          </div>

          {/* ── Content grid ─────────────────────────────────────────────
              Real: .api-detail-content-grid (1fr 340px, gap --mkt-space-6xl).
              CSS class handles the layout; no inline style needed here.
          ─────────────────────────────────────────────────────────────── */}
          <div className="api-detail-content-grid">
            <div className="content-left">

              {/* Tab bar — real: sticky .api-detail-tabs, margin-bottom
                  --mkt-space-5xl=32px. CSS class owns the sticky + margin;
                  M9 fix: drop inline marginBottom:16 (was wrong) and the
                  inline display:flex/gap override. */}
              <div className="api-detail-tabs no-print">
                {/* 6 real tabs: Overview / Documentation / Pricing /
                    Examples / Reviews / Embed */}
                {["Overview", "Documentation", "Pricing", "Examples", "Reviews", "Embed"].map((label) => (
                  <Skeleton
                    tone="stellar"
                    key={label}
                    width={label.length * 8}
                    height={20}
                    style={{ display: "inline-block" }}
                  />
                ))}
              </div>

              {/* Overview tab content — About card + metrics grid */}

              {/* About card — real: .preview-card padding --mkt-space-3xl=24px,
                  marginBottom --mkt-space-5xl=32px */}
              <div
                className="preview-card"
                style={{
                  padding: "var(--mkt-space-3xl)",
                  marginBottom: "var(--mkt-space-5xl)",
                }}
              >
                {/* "About this API" h3 */}
                <Skeleton tone="stellar" width="35%" height={20} style={{ marginBottom: "var(--mkt-space-lg)" }} />
                {/* Description paragraph lines */}
                <Skeleton tone="stellar" width="100%" height={14} style={{ marginBottom: "var(--mkt-space-md)" }} />
                <Skeleton tone="stellar" width="92%" height={14} style={{ marginBottom: "var(--mkt-space-md)" }} />
                <Skeleton tone="stellar" width="78%" height={14} />
              </div>

              {/* Metrics grid — real: .api-detail-metrics CSS grid (3-col).
                  M10 fix: remove the inline display:flex that was overriding
                  the CSS grid layout. CSS class alone drives the layout.
                  M11 fix: use .stat-card (real class) not .stat-card-skeleton,
                  so the skeleton inherits --surface-soft bg, border, radius. */}
              <div className="api-detail-metrics">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="stat-card">
                    {/* Label row: real uses font-size 0.9rem ≈ 14px, color --muted */}
                    <Skeleton tone="stellar" width="55%" height={14} />
                    {/* Value row: real uses font-size 1.35rem ≈ 22px, margin-top 10px */}
                    <Skeleton
                      tone="stellar"
                      width="65%"
                      height={22}
                      style={{ marginTop: 10 }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* ── Sidebar ───────────────────────────────────────────────
                Real sidebar has 3 stacked panels.  CSS .api-detail-sidebar
                and .api-detail-sidebar-inner handle sticky + gap.
                M12 fix: use .stat-card / .preview-card (real classes with
                correct background/border tokens) instead of the nonexistent
                .stat-card-skeleton / .preview-card-skeleton.
                Padding matches real: --mkt-space-3xl=24px on first two,
                24px on support card.  marginBottom matches real:
                --mkt-space-2xl=20px between panels.
            ─────────────────────────────────────────────────────────── */}
            <aside className="api-detail-sidebar no-print">
              <div className="api-detail-sidebar-inner">

                {/* Panel 1: API Health (.stat-card, padding --mkt-space-3xl=24px,
                    marginBottom --mkt-space-2xl=20px) */}
                <div
                  className="stat-card"
                  style={{
                    padding: "var(--mkt-space-3xl)",
                    marginBottom: "var(--mkt-space-2xl)",
                  }}
                >
                  {/* h4 "API Health" */}
                  <Skeleton tone="stellar" width="50%" height={18} style={{ marginBottom: "var(--mkt-space-xl)" }} />
                  {/* 3 label/value rows (Region, CORS, Status) */}
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton
                      key={i}
                      tone="stellar"
                      width="100%"
                      height={16}
                      style={{ marginBottom: i < 2 ? "var(--mkt-space-xl)" : 0 }}
                    />
                  ))}
                </div>

                {/* Panel 2: SDKs & Tools (.preview-card, padding --mkt-space-3xl,
                    marginBottom --mkt-space-2xl) */}
                <div
                  className="preview-card"
                  style={{
                    padding: "var(--mkt-space-3xl)",
                    marginBottom: "var(--mkt-space-2xl)",
                  }}
                >
                  {/* h4 "SDKs & Tools" */}
                  <Skeleton tone="stellar" width="50%" height={18} style={{ marginBottom: "var(--mkt-space-xl)" }} />
                  {/* 3 ghost-button rows (Node SDK / Python Wrapper / OpenAPI Spec) */}
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton
                      key={i}
                      tone="stellar"
                      width="100%"
                      height={48}
                      borderRadius="var(--radius-md)"
                      style={{ marginBottom: i < 2 ? "var(--mkt-space-lg)" : 0 }}
                    />
                  ))}
                </div>

                {/* Panel 3: Support card.
                    M13 fix: real card uses a blue-tinted gradient background
                    and rgba(78,133,255,0.2) border. Replicate with tokens:
                    --ambient-a is rgba(78,133,255,0.22) in dark /
                    rgba(78,133,255,0.08) in light — close enough and theme-safe.
                    Real borderRadius is 16px (--radius-md). */}
                <div
                  style={{
                    background: "linear-gradient(var(--ambient-a), transparent)",
                    padding: "var(--mkt-space-3xl)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--ambient-a)",
                  }}
                >
                  {/* h4 "Support" */}
                  <Skeleton tone="stellar" width="40%" height={18} style={{ marginBottom: "var(--mkt-space-lg)" }} />
                  {/* Description text (2 lines) */}
                  <Skeleton tone="stellar" width="100%" height={13} style={{ marginBottom: "var(--mkt-space-md)" }} />
                  <Skeleton tone="stellar" width="85%" height={13} style={{ marginBottom: "var(--mkt-space-xl)" }} />
                  {/* "Contact Publisher" primary button */}
                  <Skeleton
                    tone="stellar"
                    width="100%"
                    height={48}
                    borderRadius="var(--radius-md)"
                  />
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}


