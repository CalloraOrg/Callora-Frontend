/**
 * ApiCard.tsx
 *
 * Marketplace API card.
 * Includes a bookmark/save button that opens a small popover
 * allowing users to add/remove the endpoint from collections.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ContextMenu } from './ContextMenu';
import Skeleton from "./Skeleton";
import TagChip from "./TagChip";
import { formatPrice } from "../utils/format";
import { useCollections } from "../state/collectionsStore";
import type { APIItem } from "../data/mockApis";
import RatingHistogram from "./RatingHistogram";
import { useCompareStore, compareStore } from "../state/compareStore";
import Sparkline from "./Sparkline";

// ─── Skeleton ────────────────────────────────────────────────────────────────

export function ApiCardSkeleton() {
  return (
    <article
      className="preview-card api-marketplace-card"
      style={{
        padding: 12,
        display: "flex",
        flexDirection: "column",
        minHeight: 220,
        gap: 8,
        border: "1px solid rgba(255,255,255,0.03)",
        pointerEvents: "none",
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Skeleton width={56} height={56} borderRadius={10} />

        <div
          style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
            <Skeleton width="60%" height={18} />
            <Skeleton width="20%" height={12} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Skeleton width="90%" height={14} />
            <Skeleton width="70%" height={14} />
          </div>
        </div>

        <div
          style={{
            textAlign: "right",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 6,
          }}
        >
          <Skeleton width={50} height={12} />
          <Skeleton width={40} height={16} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
        <Skeleton width={45} height={24} borderRadius={8} />
        <Skeleton width={55} height={24} borderRadius={8} />
        <Skeleton width={40} height={24} borderRadius={8} />
      </div>

      <div
        style={{
          marginTop: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div className="api-card__stats" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="api-card__stat">
              <Skeleton width="55%" height={10} />
              <Skeleton width="75%" height={16} />
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Skeleton width={100} height={36} borderRadius={14} />
          <Skeleton width={60} height={14} />
        </div>
      </div>
    </article>
  );
}

// ─── Save-to-collection popover ───────────────────────────────────────────────

// ─── Bookmark button ─────────────────────────────────────────────────────────

interface BookmarkButtonProps {
  endpointId: string;
}

function BookmarkButton({ endpointId }: BookmarkButtonProps) {
  const {
    collections,
    isEndpointSaved,
    addEndpointToCollection,
    removeEndpointFromCollection,
    collectionIdsForEndpoint,
    createCollection,
  } = useCollections();

  const [popoverOpen, setPopoverOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const isSaved = isEndpointSaved(endpointId);
  const savedIn = collectionIdsForEndpoint(endpointId);

  // Close popover on outside click or Escape
  useEffect(() => {
    if (!popoverOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPopoverOpen(false);
        btnRef.current?.focus();
      }
    };
    const handleClick = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setPopoverOpen(false);
      }
    };
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [popoverOpen]);

  const toggleSave = () => setPopoverOpen((s) => !s);

  const handleToggleCollection = (colId: string) => {
    if (savedIn.has(colId)) {
      removeEndpointFromCollection(colId, endpointId);
    } else {
      addEndpointToCollection(colId, endpointId);
    }
  };

  const [newName, setNewName] = useState("");
  const [showNew, setShowNew] = useState(false);
  const newInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showNew) newInputRef.current?.focus();
  }, [showNew]);

  const handleCreateAndAdd = useCallback(() => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    createCollection(trimmed);
    setNewName("");
    setShowNew(false);
  }, [newName, createCollection]);

  const handleNewKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); handleCreateAndAdd(); }
    if (e.key === "Escape") { setShowNew(false); setNewName(""); }
  };

  return (
    <>
      {/* SVG bookmark button — absolutely positioned in card top-right */}
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); toggleSave(); }}
        style={{
          position: "absolute",
          top: "8px",
          right: "8px",
          background: isSaved ? "var(--accent, rgba(78,133,255,0.9))" : "rgba(0,0,0,0.5)",
          border: "none",
          borderRadius: "50%",
          width: "32px",
          height: "32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 10,
          transition: "background 160ms ease, transform 160ms ease",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.transform = "scale(1.1)")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.transform = "scale(1)")}
        aria-label={isSaved ? "Remove from collection" : "Save to collection"}
        aria-pressed={isSaved}
        aria-haspopup="dialog"
        aria-expanded={popoverOpen}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill={isSaved ? "white" : "none"}
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      </button>

      {/* Save-to-collection popover */}
      {popoverOpen && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Save to collection"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: "48px",
            right: "8px",
            zIndex: 100,
            width: 230,
            background: "var(--surface-strong, rgba(17,24,46,0.98))",
            border: "1px solid var(--line-strong, rgba(169,184,255,0.28))",
            borderRadius: 12,
            boxShadow: "var(--shadow, 0 24px 80px rgba(3,8,22,0.45))",
            padding: "10px 10px 8px",
            backdropFilter: "blur(20px)",
          }}
        >
          <p style={{ margin: "0 0 8px", fontSize: "0.8rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Save to collection
          </p>

          {collections.length === 0 && !showNew && (
            <p style={{ color: "var(--muted)", fontSize: "0.82rem", margin: "0 0 8px" }}>
              No collections yet.
            </p>
          )}

          {collections.map((col) => (
            <label
              key={col.id}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 4px", borderRadius: 6, cursor: "pointer", fontSize: "0.88rem", color: "var(--text)" }}
            >
              <input
                type="checkbox"
                checked={savedIn.has(col.id)}
                onChange={() => handleToggleCollection(col.id)}
                aria-label={`${savedIn.has(col.id) ? "Remove from" : "Add to"} collection "${col.name}"`}
                style={{ accentColor: "var(--accent)", width: 15, height: 15 }}
              />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                {col.name}
              </span>
              <span style={{ color: "var(--muted)", fontSize: 11 }}>
                {col.endpointIds.length}
              </span>
            </label>
          ))}

          {showNew ? (
            <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
              <input
                ref={newInputRef}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={handleNewKeyDown}
                placeholder="Collection name"
                aria-label="New collection name"
                style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid var(--accent)", borderRadius: 6, color: "var(--text)", padding: "4px 8px", fontSize: "0.82rem" }}
              />
              <button
                onClick={handleCreateAndAdd}
                disabled={!newName.trim()}
                aria-label="Create collection"
                style={{ background: "var(--accent)", border: "none", borderRadius: 6, color: "#fff", cursor: "pointer", padding: "4px 8px", fontSize: "0.82rem", fontWeight: 700 }}
              >
                ✓
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowNew(true)}
              style={{ display: "flex", alignItems: "center", gap: 4, width: "100%", marginTop: 8, background: "none", border: "1px dashed var(--line-strong, rgba(169,184,255,0.28))", borderRadius: 8, color: "var(--accent)", cursor: "pointer", padding: "5px 8px", fontSize: "0.82rem", fontWeight: 600 }}
            >
              <span aria-hidden="true">＋</span> New collection
            </button>
          )}
        </div>
      )}
    </>
  );
}

// ─── ApiCard ─────────────────────────────────────────────────────────────────

const EM_DASH = "—";

function renderStatValue(value: string | undefined) {
  if (!value) {
    return (
      <span className="api-card__stat-value api-card__stat-value--empty">
        {EM_DASH}
      </span>
    );
  }
  return <span className="api-card__stat-value">{value}</span>;
}
export default function ApiCard({
  api,
  density = "comfortable",
  onViewDetails,
  onTagClick,
  activeTag,
}: {
  api: APIItem;
  density?: "comfortable" | "compact";
  onViewDetails?: (api: APIItem) => void;
  onTagClick?: (tag: string) => void;
  activeTag?: string | null;
}) {
  const pricePerCall = api.pricePerCall ?? api.pricePerRequest;
  const avgLatencyMs = api.avgLatencyMs;
  const uptimePercent = api.uptimePercent;
  const isCompact = density === "compact";

  const comparedApis = useCompareStore();
  const isCompared = comparedApis.some(item => item.id === api.id);
  const canCompare = isCompared || comparedApis.length < 3;

  const handleCompareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCompared) {
      compareStore.removeApi(api.id);
    } else if (canCompare) {
      compareStore.addApi(api);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onViewDetails?.(api);
    }
  };

  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const handleOpenMenu = (
    e: React.MouseEvent | React.TouchEvent,
    clientX: number,
    clientY: number,
  ) => {
    e.preventDefault();
    setMenuPos({ x: clientX, y: clientY });
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    // Prevent menu from opening on interactive elements
    if ((e.target as HTMLElement).closest('button, a')) return;
    handleOpenMenu(e, e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button, a')) return;
    const touch = e.touches[0];
    longPressTimer.current = setTimeout(() => {
      handleOpenMenu(e, touch.clientX, touch.clientY);
    }, 600); // 600ms long press threshold
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const contextActions = [
    { label: 'View Details', action: () => onViewDetails?.(api) },
    {
      label: 'Copy Endpoint URL',
      action: () => navigator.clipboard.writeText(api.endpoint),
    },
    { label: 'Add to Comparison', action: () => compareStore.addApi(api), isCritical: false },
  ];

  return (
    <article
      className={`preview-card api-marketplace-card${isCompact ? " api-card--compact" : ""}`}
      role="button"
      tabIndex={0}
      aria-label={`View details for ${api.name}`}
      onClick={() => onViewDetails?.(api)}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        padding: isCompact ? 10 : 12,
        display: "flex",
        flexDirection: "column",
        minHeight: isCompact ? 188 : 220,
        gap: isCompact ? 6 : 8,
      }}
    >
      {menuPos && (
        <ContextMenu
          x={menuPos.x}
          y={menuPos.y}
          onClose={() => setMenuPos(null)}
          actions={contextActions}
        />
      )}
      {/* Absolutely-positioned bookmark button in the top-right corner */}
      <BookmarkButton endpointId={api.id} />
      
      {/* Compare button - absolutely positioned, top-left */}
      <button
        onClick={handleCompareClick}
        disabled={!canCompare}
        className="api-card__compare-btn"
        style={{
          position: "absolute",
          top: "8px",
          left: "8px",
          zIndex: 10,
          background: isCompared ? "var(--accent)" : "rgba(0,0,0,0.5)",
          color: "white",
          border: "none",
          borderRadius: "8px",
          padding: "4px 8px",
          fontSize: "0.75rem",
          fontWeight: 600,
          cursor: canCompare ? "pointer" : "not-allowed",
          opacity: isCompared ? 1 : 0, // rely on css for hover visibility
          transition: "opacity 0.2s, background 0.2s"
        }}
        aria-label={isCompared ? `Remove ${api.name} from comparison` : `Add ${api.name} to comparison`}
      >
        {isCompared ? "Compared" : "Compare"}
      </button>

      <div
        className="api-marketplace-card-header"
        style={{ display: "flex", gap: 12, alignItems: "center" }}
      >
        <div
          className="api-marketplace-card-icon"
          style={{
            width: 56,
            height: 56,
            borderRadius: 10,
            background: "rgba(255,255,255,0.04)",
            display: "grid",
            placeItems: "center",
            fontWeight: 700,
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          {api.name[0]}
        </div>

        <div
          className="api-marketplace-card-body"
          style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}
        >
          <div
            className="api-marketplace-card-title-row"
            style={{ display: "flex", gap: 8, alignItems: "baseline" }}
          >
            <strong>{api.name}</strong>
            <div style={{ color: "var(--muted)", fontSize: 12 }}>
              {api.provider?.name}
            </div>
          </div>

          {!isCompact && (
            <div
              className="api-marketplace-card-description"
              style={{
                color: "var(--muted)",
                marginTop: 6,
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {api.description}
            </div>
          )}
        </div>

        {/* Price — bookmark moved out of here, paddingRight leaves room for it */}
        <div
          className="api-marketplace-card-price"
          style={{ textAlign: "right", paddingRight: 36, flexShrink: 0 }}
        >
          <div style={{ color: "var(--muted)", fontSize: 12 }}>
            {`$${formatPrice(pricePerCall)}`} / call
          </div>
          {api.rating !== undefined && (
            <div style={{ color: "var(--muted)", marginTop: 6 }}>
              <RatingHistogram rating={api.rating} distribution={api.ratingDistribution}>
                ⭐ {api.rating}
              </RatingHistogram>
            </div>
          )}
        </div>
      </div>

      <div
        className="api-marketplace-card-tags"
        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
      >
        {((api.tags as string[]) || []).slice(0, 4).map((t: string) => (
          <span
            key={t}
            style={{
              fontSize: 12,
              color: "var(--muted)",
              background: "rgba(255,255,255,0.02)",
              padding: "4px 8px",
              borderRadius: 8,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <TagIcon size={16} />
            {t}
          </span>
        ))}
      </div>

      <div
  style={{
    marginTop: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  }}
>
  <span
    style={{
      fontSize: 12,
      color: "var(--muted)",
      fontWeight: 600,
    }}
  >
    Last 24h
  </span>

  <Sparkline
  values={[
    18,
    22,
    20,
    24,
    26,
    25,
    30,
    32,
    31,
    34,
    36,
    35,
  ]}
  width={90}
  height={28}
/>
</div>

      <div
        className="api-marketplace-card-footer"
        style={{
          marginTop: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {/* Always render three cells so marketplace rows keep consistent heights while missing values stay scannable. */}
        <div className="api-card__stats" aria-label="API stats">
          <div className="api-card__stat">
            <span className="api-card__stat-label">Price / call</span>
            {renderStatValue(
              pricePerCall !== undefined
                ? `$${formatPrice(pricePerCall)}`
                : undefined,
            )}
          </div>

          <div className="api-card__stat">
            <span className="api-card__stat-label" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <ClockIcon size={16} /> Latency
            </span>
            {renderStatValue(
              avgLatencyMs !== undefined ? `${avgLatencyMs} ms` : undefined,
            )}
          </div>

          <div className="api-card__stat">
            <span className="api-card__stat-label" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <BoltIcon size={16} /> Uptime
            </span>
            {renderStatValue(
              uptimePercent !== undefined
                ? `${uptimePercent.toFixed(2)}%`
                : undefined,
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span
            className="ghost-button"
            aria-hidden="true"
            style={{ display: "inline-flex", alignItems: "center" }}
          >
            View Details
          </span>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>
            {api.rating ? (
              <RatingHistogram rating={api.rating} distribution={api.ratingDistribution}>
                {api.rating} ★
              </RatingHistogram>
            ) : (
              "No reviews"
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
