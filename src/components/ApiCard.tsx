/**
 * ApiCard.tsx
 *
 * Marketplace API card.
 * Includes a bookmark/save button that opens a small popover
 * allowing users to add/remove the endpoint from collections.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ContextMenu } from './ContextMenu';
import Skeleton from "./Skeleton";
import TagChip from "./TagChip";
import EmptyState from "./EmptyState";
import { formatPrice } from "../utils/format";
import { useCollections } from "../state/collectionsStore";
import { useFavorites } from "../hooks/useFavorites";
import type { APIItem } from "../data/mockApis";
import RatingHistogram from "./RatingHistogram";
import { useCompareStore, compareStore } from "../state/compareStore";
import { usePinnedApis, pinnedApisStore } from "../state/pinnedApis";
import Sparkline from "./Sparkline";
import type { Shortcut } from "../hooks/useGlobalShortcuts";
import KbdHint from "./KbdHint";
import WhyApi from "./WhyApi";
import { colorFromId } from "../utils/colorFromId";
import { ClockIcon, BoltIcon } from "./icons";


// ─── Skeleton ────────────────────────────────────────────────────────────────

export function ApiCardSkeleton({ density = "comfortable" }: { density?: "comfortable" | "compact" } = {}) {
  const isCompact = density === "compact";

  return (
    <article
      className={`preview-card api-marketplace-card api-card-skeleton${isCompact ? " api-card--compact" : ""}`}
      aria-busy="true"
      aria-label="Loading API"
      style={{
        padding: isCompact ? "var(--mkt-card-compact-padding, 10px)" : "var(--mkt-card-padding, 12px)",
        display: "flex",
        flexDirection: "column",
        minHeight: isCompact ? "var(--mkt-card-compact-min-height, 188px)" : "var(--mkt-card-min-height, 220px)",
        gap: isCompact ? "var(--mkt-card-compact-gap, 6px)" : "var(--mkt-card-gap, 8px)",
        border: "1px solid var(--line, rgba(255,255,255,0.05))",
        pointerEvents: "none",
        position: "relative",
      }}
    >
      <span className="sr-only">Loading API</span>

      {/* Color stripe placeholder — matches the final card's identity stripe */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 4,
          height: "100%",
          borderRadius: "var(--radius-lg, 12px) 0 0 var(--radius-lg, 12px)",
          background: "color-mix(in srgb, var(--accent) 12%, transparent)",
        }}
      />

      {/* Bookmark button placeholder */}
      <div style={{ position: "absolute", top: 8, right: 8, zIndex: 1 }}>
        <Skeleton tone="stellar" width={32} height={32} borderRadius="50%" />
      </div>

      {/* Pin button placeholder */}
      <div style={{ position: "absolute", top: 48, right: 8, zIndex: 1 }}>
        <Skeleton tone="stellar" width={32} height={32} borderRadius="50%" />
      </div>

      {/* Favorite button placeholder */}
      <div style={{ position: "absolute", top: 8, left: 8, zIndex: 1 }}>
        <Skeleton tone="stellar" width={32} height={32} borderRadius="50%" />
      </div>

      {/* Compare button placeholder */}
      <div style={{ position: "absolute", top: 8, left: 48, zIndex: 1 }}>
        <Skeleton tone="stellar" width={60} height={28} borderRadius={8} />
      </div>

      <div className="api-marketplace-card-header" style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Skeleton tone="stellar" width={56} height={56} borderRadius={10} />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--mkt-space-md, 8px)" }}>
          <div style={{ display: "flex", gap: "var(--mkt-space-md, 8px)", alignItems: "baseline" }}>
            <Skeleton tone="stellar" width="60%" height={18} />
            <Skeleton tone="stellar" width="20%" height={12} />
          </div>

          {!isCompact && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <Skeleton tone="stellar" width="90%" height={14} />
              <Skeleton tone="stellar" width="70%" height={14} />
            </div>
          )}
        </div>

        <div
          style={{
            textAlign: "right",
            paddingRight: 36,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: "var(--mkt-space-sm, 4px)"
          }}
        >
          <Skeleton tone="stellar" width={50} height={12} />
          <Skeleton tone="stellar" width={40} height={16} />
        </div>
      </div>

      <div className="api-marketplace-card-tags" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
        <Skeleton tone="stellar" width={45} height={24} borderRadius={8} />
        <Skeleton tone="stellar" width={55} height={24} borderRadius={8} />
        <Skeleton tone="stellar" width={40} height={24} borderRadius={8} />
      </div>

      {/* WhyApi placeholder — matches the real card's rationale section in comfortable mode */}
      {!isCompact && (
        <div style={{ marginTop: 2, display: "flex", flexDirection: "column", gap: 4 }}>
          <Skeleton tone="stellar" width="35%" height={14} />
          <Skeleton tone="stellar" width="80%" height={14} />
        </div>
      )}

      {/* Sparkline section placeholder */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginTop: 2,
        }}
      >
        <Skeleton tone="stellar" width={52} height={12} />
        <Skeleton tone="stellar" width={90} height={28} />
      </div>

      <div
        className="api-marketplace-card-footer"
        style={{
          marginTop: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "var(--mkt-space-lg, 12px)",
        }}
      >
        <div className="api-card__stats" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="api-card__stat">
              <Skeleton tone="stellar" width="55%" height={10} />
              <Skeleton tone="stellar" width="75%" height={16} />
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <Skeleton tone="stellar" width={100} height={36} borderRadius={14} />
          <Skeleton tone="stellar" width={60} height={14} />
        </div>
      </div>
    </article>
  );
}

interface CardActionButtonProps {
  isActive: boolean;
  onClick: (e: React.MouseEvent) => void;
  activeLabel: string;
  inactiveLabel: string;
  prefersReducedMotion: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
  ariaHasPopup?: boolean | "dialog" | "menu" | "listbox" | "tree" | "grid";
  ariaExpanded?: boolean;
  buttonRef?: React.Ref<HTMLButtonElement>;
}

/**
 * Standardized button for Favorite, Bookmark, and Pin actions.
 * Provides a static visual fallback (color/outline shift) when reduced motion is enabled,
 * ensuring clear hover and focus states for accessibility without layout-altering transforms.
 */
function CardActionButton({
  isActive,
  onClick,
  activeLabel,
  inactiveLabel,
  prefersReducedMotion,
  children,
  style,
  ariaHasPopup,
  ariaExpanded,
  buttonRef
}: CardActionButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  const baseBg = isActive ? "var(--accent, rgba(78,133,255,0.9))" : "rgba(0,0,0,0.5)";
  const hoverBg = isActive ? "var(--accent-hover, rgba(78,133,255,1))" : "rgba(0,0,0,0.8)";

  const transform = prefersReducedMotion ? "none" : (isHovered ? "scale(1.1)" : "scale(1)");
  const background = isHovered ? hoverBg : baseBg;
  const outline = isHovered ? "2px solid rgba(255,255,255,0.6)" : "2px solid transparent";

  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      aria-label={isActive ? activeLabel : inactiveLabel}
      aria-pressed={isActive}
      aria-haspopup={ariaHasPopup}
      aria-expanded={ariaExpanded}
      style={{
        ...style,
        background,
        transform,
        outline,
        outlineOffset: "2px",
        border: "none",
        borderRadius: "50%",
        width: "32px",
        height: "32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: prefersReducedMotion
          ? "background 100ms ease, outline 100ms ease"
          : "background 160ms ease, transform 160ms ease, outline 160ms ease",
        flexShrink: 0,
        zIndex: 10,
      }}
    >
      {children}
    </button>
  );
}

interface FavoriteButtonProps {
  endpointId: string;
  isFavorite: boolean;
  onToggle: (id: string) => void;
  prefersReducedMotion?: boolean;
  onStatusChange?: (message: string) => void;
}

function FavoriteButton({ endpointId, isFavorite, onToggle, prefersReducedMotion = false, onStatusChange }: FavoriteButtonProps) {
  return (
    <CardActionButton
      isActive={isFavorite}
      onClick={(e) => {
        e.stopPropagation();
        onToggle(endpointId);
        onStatusChange?.(!isFavorite ? "Added to favorites" : "Removed from favorites");
      }}
      activeLabel="Remove from favorites"
      inactiveLabel="Add to favorites"
      prefersReducedMotion={prefersReducedMotion}
      style={{ position: "absolute", top: "8px", left: "8px" }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill={isFavorite ? "white" : "none"}
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    </CardActionButton>
  );
}

// ─── Bookmark button ─────────────────────────────────────────────────────────

interface BookmarkButtonProps {
  endpointId: string;
  prefersReducedMotion?: boolean;
  onStatusChange?: (message: string) => void;
}

function BookmarkButton({ endpointId, prefersReducedMotion = false, onStatusChange }: BookmarkButtonProps) {
  const {
    collections,
    isEndpointSaved,
    addEndpointToCollection,
    removeEndpointFromCollection,
    collectionIdsForEndpoint,
    createCollectionWithEndpoint,
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
      if (panelRef.current && !panelRef.current.contains(e.target as Node) && btnRef.current && !btnRef.current.contains(e.target as Node)) {
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
    const colName = collections.find(c => c.id === colId)?.name || "collection";
    if (savedIn.has(colId)) {
      removeEndpointFromCollection(colId, endpointId);
      onStatusChange?.("Removed from collection");
    } else {
      addEndpointToCollection(colId, endpointId);
      onStatusChange?.("Saved to collection");
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
    createCollectionWithEndpoint(trimmed, endpointId);
    onStatusChange?.(`Created collection "${trimmed}" and saved endpoint`);
    setNewName("");
    setShowNew(false);
  }, [newName, createCollectionWithEndpoint, endpointId, onStatusChange]);

  const handleNewKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreateAndAdd();
    }
    if (e.key === "Escape") {
      setShowNew(false);
      setNewName("");
    }
  };

  return (
    <>
      {/* SVG bookmark button — absolutely positioned in card top-right */}
      <CardActionButton
        buttonRef={btnRef}
        isActive={isSaved}
        onClick={(e) => {
          e.stopPropagation();
          toggleSave();
        }}
        activeLabel="Remove from collection"
        inactiveLabel="Save to collection"
        prefersReducedMotion={prefersReducedMotion}
        ariaHasPopup="dialog"
        ariaExpanded={popoverOpen}
        style={{ position: "absolute", top: "8px", right: "8px" }}
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
      </CardActionButton>

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
            width: "var(--mkt-card-popover-width)",
            background: "var(--surface-strong, rgba(17,24,46,0.98))",
            border: "1px solid var(--line-strong, rgba(169,184,255,0.28))",
            borderRadius: "var(--mkt-card-popover-radius)",
            boxShadow: "var(--shadow, 0 24px 80px rgba(3,8,22,0.45))",
            padding: "10px 10px 8px",
            backdropFilter: "blur(20px)",
          }}
        >
          <p style={{ margin: "0 0 var(--mkt-space-md)", fontSize: "var(--mkt-font-size-sm)", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Save to collection
          </p>

          {collections.length === 0 && !showNew && <p style={{ color: "var(--muted)", fontSize: "var(--mkt-font-size-popover)", margin: "0 0 var(--mkt-space-md)" }}>No collections yet.</p>}

          {collections.map((col) => (
            <label
              key={col.id}
              style={{ display: "flex", alignItems: "center", gap: "var(--mkt-space-md)", padding: "var(--mkt-space-xs) var(--mkt-space-sm)", borderRadius: "var(--mkt-radius-sm, 6px)", cursor: "pointer", fontSize: "var(--mkt-font-size-popover-label)", color: "var(--text)" }}
            >
              <input
                type="checkbox"
                checked={savedIn.has(col.id)}
                onChange={() => handleToggleCollection(col.id)}
                aria-label={`${savedIn.has(col.id) ? "Remove from" : "Add to"} collection "${col.name}"`}
                style={{ accentColor: "var(--accent)", width: 15, height: 15 }}
              />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{col.name}</span>
              <span style={{ color: "var(--muted)", fontSize: "var(--mkt-font-size-xs)" }}>{col.endpointIds.length}</span>
            </label>
          ))}

          {showNew ? (
            <div style={{ display: "flex", gap: "var(--mkt-space-sm)", marginTop: "var(--mkt-card-margin-top-sm)" }}>
              <input
                ref={newInputRef}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={handleNewKeyDown}
                placeholder="Collection name"
                aria-label="New collection name"
                 style={{
                   flex: 1,
                   background: "rgba(255,255,255,0.06)",
                   border: "1px solid var(--accent)",
                   borderRadius: "var(--mkt-radius-sm)",
                   color: "var(--text)",
                   padding: "var(--mkt-space-xs) var(--mkt-space-md)",
                   fontSize: "var(--mkt-font-size-popover)",
                 }}
              />
              <button
                onClick={handleCreateAndAdd}
                disabled={!newName.trim()}
                aria-label="Create collection"
                 style={{
                   background: "var(--accent)",
                   border: "none",
                   borderRadius: "var(--mkt-radius-sm)",
                   color: "#fff",
                   cursor: "pointer",
                   padding: "var(--mkt-space-xs) var(--mkt-space-md)",
                   fontSize: "var(--mkt-font-size-popover)",
                   fontWeight: 700,
                 }}
              >
                ✓
              </button>
            </div>
          ) : (
            <button
               onClick={() => setShowNew(true)}
               style={{
                 display: "flex",
                 alignItems: "center",
                 gap: "var(--mkt-space-sm)",
                 width: "100%",
                 marginTop: "var(--mkt-space-md)",
                 background: "none",
                 border: "1px dashed var(--line-strong, rgba(169,184,255,0.28))",
                 borderRadius: "var(--mkt-card-tag-radius)",
                 color: "var(--accent)",
                 cursor: "pointer",
                 padding: "var(--mkt-space-xs) var(--mkt-space-md)",
                 fontSize: "var(--mkt-font-size-popover)",
                 fontWeight: 600,
               }}
            >
              <span aria-hidden="true">＋</span> New collection
            </button>
          )}
        </div>
      )}
    </>
  );
}

// ─── Pin button ───────────────────────────────────────────────────────────────

/** Quick-menu button that pins/unpins an API to the dashboard. */
function PinButton({ apiId, prefersReducedMotion = false, onStatusChange }: { apiId: string; prefersReducedMotion?: boolean; onStatusChange?: (message: string) => void }) {
  const pinned = usePinnedApis();
  const isPinned = pinned.has(apiId);

  return (
    <CardActionButton
      isActive={isPinned}
      onClick={(e) => {
        e.stopPropagation();
        pinnedApisStore.toggle(apiId);
        onStatusChange?.(!isPinned ? `Pinned ${apiId} to dashboard` : `Unpinned ${apiId} from dashboard`);
      }}
      activeLabel={`Unpin ${apiId} from dashboard`}
      inactiveLabel={`Pin ${apiId} to dashboard`}
      prefersReducedMotion={prefersReducedMotion}
      style={{ position: "absolute", top: "48px", right: "8px" }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill={isPinned ? "white" : "none"}
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <line x1="12" y1="17" x2="12" y2="22" />
        <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
      </svg>
    </CardActionButton>
  );
}

// ─── ApiCard ─────────────────────────────────────────────────────────────────

const EM_DASH = "—";

const CARD_SHORTCUTS: readonly Shortcut[] = [
  { key: "Enter", description: "View details", category: "Marketplace" },
  { key: "C", description: "Add/remove comparison", category: "Marketplace" },
];

function renderStatValue(value: string | undefined) {
  if (!value) {
    return <span className="api-card__stat-value api-card__stat-value--empty">{EM_DASH}</span>;
  }
  return <span className="api-card__stat-value numeric-tabular">{value}</span>;
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (e: any) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

export default function ApiCard({
  api,
  loading = false,
  density = "comfortable",
  onViewDetails,
  onTagClick,
  activeTag,
  onBrowse,
}: {
  api?: APIItem;
  loading?: boolean;
  density?: "comfortable" | "compact";
  onViewDetails?: (api: APIItem) => void;
  onTagClick?: (tag: string) => void;
  activeTag?: string | null;
  onBrowse?: () => void;
}) {
  if (loading) {
    return <ApiCardSkeleton />;
  }

  if (!api) {
    return (
      <article
        className="preview-card api-marketplace-card"
        style={{
          padding: 0,
          display: "flex",
          minHeight: density === "compact" ? 180 : 220,
          border: "1px solid var(--line-strong, rgba(255,255,255,0.05))",
        }}
      >
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <EmptyState
            variant="api-card"
            size={density === "compact" ? "compact" : "default"}
            action={{
              label: "Explore Marketplace",
              onClick: () => {
                window.location.href = "/marketplace";
              },
            }}
          />
        </div>
      </article>
    );
  }

  const isMobile = useMediaQuery("(max-width: 768px)");

  const pricePerCall = api.pricePerCall ?? api.pricePerRequest;
  const avgLatencyMs = api.avgLatencyMs;
  const uptimePercent = api.uptimePercent;
  const isCompact = density === "compact" || isMobile;

  const [liveMessage, setLiveMessage] = useState("");
  const announce = useCallback((msg: string) => {
    setLiveMessage(msg);
  }, []);

  const prefersReducedMotion = useMemo(() => {
    return typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)")?.matches;
  }, []);

  const { isFavorite, toggleFavorite } = useFavorites();
  const { apis: comparedApis } = useCompareStore();
  const isCompared = comparedApis.some((item) => item.id === api.id);
  const canCompare = isCompared || comparedApis.length < 3;

  const sparklineValues = useMemo(() => {
    if (api.sparklineValues && api.sparklineValues.length > 0) {
      return api.sparklineValues;
    }
    // Generate deterministic values based on API properties/id so every API has a unique visually appealing trend
    const seed = api.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const vals = [];
    let current = 20 + (seed % 30);
    for (let i = 0; i < 12; i++) {
      const step = Math.sin(seed + i) * 10;
      current = Math.max(5, Math.min(100, current + step));
      vals.push(Math.round(current));
    }
    return vals;
  }, [api.id, api.sparklineValues]);

  const handleCompareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCompared) {
      compareStore.removeApi(api.id);
      announce(`Removed ${api.name} from comparison`);
    } else if (canCompare) {
      compareStore.addApi(api);
      announce(`Added ${api.name} to comparison`);
    }
  };

  /**
   * Handle keyboard interactions on the card.
   * - Enter/Space: View API details
   * - 'c': Add/remove card from comparison (only when card is focused, not in form controls)
   *
   * The 'c' shortcut enables quick comparison without using the mouse.
   * Respects the same 3-item limit as the click-based compare button.
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onViewDetails?.(api);
    }

    // Handle 'c' key for add-to-compare shortcut (lowercase only, no modifiers)
    if (e.key.toLowerCase() === "c" && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
      // Don't fire if focus is in a form field
      if ((e.target as HTMLElement).closest("input, textarea, [contenteditable]")) {
        return;
      }

      e.preventDefault();
      // Reuse exact same logic as the compare button click
      handleCompareClick(e as unknown as React.MouseEvent);
    }
  };

  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [isCompareHovered, setIsCompareHovered] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleOpenMenu = (e: React.MouseEvent | React.TouchEvent, clientX: number, clientY: number) => {
    e.preventDefault();
    setMenuPos({ x: clientX, y: clientY });
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    // Prevent menu from opening on interactive elements
    if ((e.target as HTMLElement).closest("button, a")) return;
    handleOpenMenu(e, e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest("button, a")) return;
    const touch = e.touches[0];
    longPressTimer.current = setTimeout(() => {
      handleOpenMenu(e, touch.clientX, touch.clientY);
    }, 600); // 600ms long press threshold
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const contextActions: import("./ContextMenu").ContextMenuAction[] = [
    {
      label: "View Details",
      action: () => onViewDetails?.(api),
    },
    {
      label: "Copy Endpoint URL",
      action: () => {
        const url = api.endpoints?.[0]?.url ?? `/${api.id}`;
        navigator.clipboard.writeText(url).catch(() => {
          /* clipboard unavailable in tests */
        });
      },
    },
    {
      label: isCompared ? "Remove from Comparison" : "Add to Comparison",
      action: () => {
        if (isCompared) compareStore.removeApi(api.id);
        else if (canCompare) compareStore.addApi(api);
      },
    },
  ];

  return (
    <article
      className={`preview-card api-marketplace-card${isCompact ? " api-card--compact" : ""}`}
      role="button"
      tabIndex={0}
      aria-label={`View details for ${api.name}`}
      aria-keyshortcuts="c"
      onClick={() => onViewDetails?.(api)}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
       style={{
         padding: isCompact ? "var(--mkt-card-compact-padding)" : "var(--mkt-card-padding)",
         display: "flex",
         flexDirection: "column",
         minHeight: isCompact ? "var(--mkt-card-compact-min-height)" : "var(--mkt-card-min-height)",
         gap: isCompact ? "var(--mkt-card-compact-gap)" : "var(--mkt-card-gap)",
       }}
    >
      {/* Identity colour stripe — stable per API for quick visual recognition */}
      <span
        aria-hidden="true"
        data-testid="api-card-color-stripe"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 4,
          height: "100%",
          borderRadius: "var(--radius-lg) 0 0 var(--radius-lg)",
          background: colorFromId(api.id),
          transition: prefersReducedMotion ? "none" : undefined,
        }}
      />

      {menuPos && <ContextMenu x={menuPos.x} y={menuPos.y} onClose={() => setMenuPos(null)} actions={contextActions} />}
      
      {/* Absolutely-positioned bookmark button in the top-right corner */}
      <BookmarkButton endpointId={api.id} prefersReducedMotion={prefersReducedMotion} onStatusChange={announce} />

      {/* Pin/unpin button — below bookmark, top-right */}
      <PinButton apiId={api.id} prefersReducedMotion={prefersReducedMotion} onStatusChange={announce} />
      
      <FavoriteButton
        endpointId={api.id}
        isFavorite={isFavorite(api.id)}
        onToggle={toggleFavorite}
        prefersReducedMotion={prefersReducedMotion}
        onStatusChange={announce}
      />

       {/* Compare button - absolutely positioned, top-left */}
       <button
         onClick={handleCompareClick}
         onMouseEnter={() => setIsCompareHovered(true)}
         onMouseLeave={() => setIsCompareHovered(false)}
         onFocus={() => setIsCompareHovered(true)}
         onBlur={() => setIsCompareHovered(false)}
         disabled={!canCompare}
         className="api-card__compare-btn"
         style={{
           position: "absolute",
           top: "8px",
           left: "48px",
           zIndex: 10,
           background: isCompared ? "var(--accent)" : (isCompareHovered ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.5)"),
           color: "white",
           border: "none",
           borderRadius: "8px",
           padding: "4px 8px",
           fontSize: "0.75rem",
           fontWeight: 600,
           cursor: canCompare ? "pointer" : "not-allowed",
           opacity: isCompared ? 1 : (isCompareHovered ? 1 : 0.6),
           outline: isCompareHovered ? "2px solid rgba(255,255,255,0.6)" : "2px solid transparent",
           outlineOffset: "2px",
           transform: prefersReducedMotion ? "none" : (isCompareHovered && !isCompared && canCompare ? "translateY(-2px)" : "none"),
           transition: prefersReducedMotion
              ? "opacity 0.1s, background 0.1s, outline 0.1s" 
              : "opacity 0.2s, background 0.2s, transform 0.2s, outline 0.2s"
         }}
         aria-label={isCompared ? `Remove ${api.name} from comparison` : `Add ${api.name} to comparison`}
         aria-pressed={isCompared}
       >
         {isCompared ? "Compared" : "Compare"}
       </button>

      <div className="api-marketplace-card-header" style={{ display: "flex", gap: "var(--mkt-space-lg)", alignItems: "center" }}>
        <div
         className="api-marketplace-card-icon"
           style={{
             width: "var(--mkt-card-icon-size)",
             height: "var(--mkt-card-icon-size)",
             borderRadius: "var(--mkt-card-icon-radius)",
             background: "rgba(255,255,255,0.04)",
             display: "grid",
             placeItems: "center",
             fontWeight: 700,
             fontSize: "var(--mkt-card-icon-font-size)",
             flexShrink: 0,
           }}
        >
          {api.name[0]}
        </div>

        <div className="api-marketplace-card-body" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
           <div className="api-marketplace-card-title-row" style={{ display: "flex", gap: "var(--mkt-space-md)", alignItems: "baseline", flexWrap: "wrap" }}>
             <strong>{api.name}</strong>
             <div style={{ color: "var(--muted)", fontSize: "var(--mkt-font-size-micro)" }}>{api.provider?.name}</div>
          </div>

          {!isCompact && (
            <div
              className="api-marketplace-card-description"
               style={{
                 color: "var(--muted)",
                 marginTop: "var(--mkt-card-margin-top-sm)",
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
           className="api-marketplace-card-price numeric-tabular"
           style={{ textAlign: "right", paddingRight: "var(--mkt-card-price-padding-right)", flexShrink: 0 }}
         >
           <div style={{ color: "var(--muted)", fontSize: "var(--mkt-font-size-micro)" }}>
             {`$${formatPrice(pricePerCall)}`} / call
           </div>
           {api.rating !== undefined && (
             <div style={{ color: "var(--muted)", marginTop: "var(--mkt-card-margin-top-sm)" }}>
              <RatingHistogram rating={api.rating} distribution={api.ratingDistribution} placement="top-end">
                ⭐ {api.rating}
              </RatingHistogram>
            </div>
          )}
        </div>
      </div>

      <div className="api-marketplace-card-tags" style={{ display: "flex", gap: "var(--mkt-space-md)", flexWrap: "wrap" }}>
        {((api.tags as string[]) || []).slice(0, 4).map((t: string) => (
          <TagChip key={t} tag={t} active={activeTag?.toLowerCase() === t.toLowerCase()} onClick={onTagClick} />
        ))}
      </div>

      {/* "Why this API?" rationale — hidden in compact rows to keep them dense. */}
      {!isCompact && <WhyApi api={api} />}

      <div
        style={{
          marginTop: "var(--mkt-space-md)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--mkt-space-lg)",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: "var(--mkt-font-size-micro)",
            color: "var(--muted)",
            fontWeight: 600,
          }}
        >
          Last 24h
        </span>

        <Sparkline values={sparklineValues} width={90} height={28} />
      </div>

      <div
        className="api-marketplace-card-footer"
        style={{
          marginTop: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "var(--mkt-space-lg)",
        }}
      >
        {/* Always render three cells so marketplace rows keep consistent heights while missing values stay scannable. */}
        <div className="api-card__stats" aria-label="API stats">
          <div className="api-card__stat">
            <span className="api-card__stat-label">Price / call</span>
            {renderStatValue(pricePerCall !== undefined ? `$${formatPrice(pricePerCall)}` : undefined)}
          </div>

          <div className="api-card__stat">
            <span className="api-card__stat-label" style={{ display: "inline-flex", alignItems: "center", gap: "var(--mkt-space-sm)" }}>
              <ClockIcon size={16} /> Latency
            </span>
            {renderStatValue(avgLatencyMs !== undefined ? `${avgLatencyMs} ms` : undefined)}
          </div>

          <div className="api-card__stat">
            <span className="api-card__stat-label" style={{ display: "inline-flex", alignItems: "center", gap: "var(--mkt-space-sm)" }}>
              <BoltIcon size={16} /> Uptime
            </span>
            {renderStatValue(uptimePercent !== undefined ? `${uptimePercent.toFixed(2)}%` : undefined)}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
              gap: "var(--mkt-space-lg)",
            flexWrap: "wrap",
          }}
        >
          <span className="ghost-button" aria-hidden="true" style={{ display: "inline-flex", alignItems: "center" }}>
            View Details
          </span>
          <div style={{ color: "var(--muted)", fontSize: "var(--mkt-font-size-micro)" }}>
            {api.rating ? (
              <RatingHistogram rating={api.rating} distribution={api.ratingDistribution} placement="top-end">
                {api.rating} ★
              </RatingHistogram>
            ) : (
              "No reviews"
            )}
          </div>
        </div>
      </div>

      <KbdHint shortcuts={CARD_SHORTCUTS} />

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="api-card-live-region"
        style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}
      >
        {liveMessage}
      </div>
    </article>
  );
}