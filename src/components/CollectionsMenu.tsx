/**
 * CollectionsMenu.tsx
 *
 * Dropdown/panel accessible from the Marketplace header.
 * Features:
 *  - Lists all collections with endpoint counts
 *  - Create new collection via inline name input
 *  - Expand each collection to see saved endpoints
 *  - Rename / delete each collection
 *  - Drag-and-drop reorder (HTML5 drag API)
 *  - Keyboard: Arrow keys to reorder, Enter to rename, Delete to remove
 *  - Dark/light mode via CSS custom properties (consistent with ThemeContext)
 *  - WCAG 2.1 AA: aria labels, roles, focus management
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useCollections } from "../state/collectionsStore";
import MOCK_APIS from "../data/mockApis";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Look up a human-readable label for a saved endpoint id. */
function resolveEndpointLabel(endpointId: string): string {
  for (const api of MOCK_APIS) {
    if (api.id === endpointId) return api.name;
    const ep = (api.endpoints ?? []).find((e: any) => e.id === endpointId);
    if (ep) return `${api.name} – ${ep.title ?? ep.id}`;
  }
  return endpointId;
}

// ─── Sub-component: one collection row ───────────────────────────────────────

interface CollectionRowProps {
  id: string;
  name: string;
  endpointIds: string[];
  index: number;
  totalCollections: number;
  dragIndex: number | null;
  onDragStart: (index: number) => void;
  onDragEnter: (index: number) => void;
  onDragEnd: () => void;
}

function CollectionRow({
  id,
  name,
  endpointIds,
  index,
  totalCollections,
  dragIndex,
  onDragStart,
  onDragEnter,
  onDragEnd,
}: CollectionRowProps) {
  const {
    renameCollection,
    deleteCollection,
    removeEndpointFromCollection,
    reorderCollections,
  } = useCollections();

  const [expanded, setExpanded] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Focus rename input when entering rename mode
  useEffect(() => {
    if (renaming) renameInputRef.current?.focus();
  }, [renaming]);

  const commitRename = () => {
    renameCollection(id, draftName);
    setRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); commitRename(); }
    if (e.key === "Escape") {
      e.stopPropagation(); // prevent global panel-close handler from firing
      setRenaming(false);
      setDraftName(name);
    }
  };

  // Keyboard reorder on the drag handle
  const handleDragHandleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp" && index > 0) {
      e.preventDefault();
      reorderCollections(index, index - 1);
    }
    if (e.key === "ArrowDown" && index < totalCollections - 1) {
      e.preventDefault();
      reorderCollections(index, index + 1);
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      if (window.confirm(`Delete collection "${name}"?`)) {
        deleteCollection(id);
      }
    }
    if (e.key === "Enter") {
      e.preventDefault();
      setDraftName(name);
      setRenaming(true);
    }
  };

  const isDragging = dragIndex === index;

  return (
    <li
      draggable
      onDragStart={() => onDragStart(index)}
      onDragEnter={() => onDragEnter(index)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      style={{
        listStyle: "none",
        borderRadius: 10,
        border: "1px solid var(--line)",
        background: isDragging
          ? "rgba(78,133,255,0.08)"
          : "var(--surface-soft)",
        marginBottom: 6,
        opacity: isDragging ? 0.6 : 1,
        transition: "background 120ms ease, opacity 120ms ease",
      }}
      aria-label={`Collection: ${name}, ${endpointIds.length} endpoints`}
    >
      {/* Row header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
        }}
      >
        {/* Drag handle */}
        <button
          aria-label={`Drag to reorder "${name}". Use Arrow keys to move, Delete to remove, Enter to rename.`}
          title="Drag to reorder"
          onKeyDown={handleDragHandleKeyDown}
          style={{
            background: "none",
            border: "none",
            cursor: "grab",
            color: "var(--muted)",
            padding: "2px 4px",
            borderRadius: 4,
            fontSize: 14,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          ⠿
        </button>

        {/* Name / rename input */}
        {renaming ? (
          <input
            ref={renameInputRef}
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleRenameKeyDown}
            aria-label="Rename collection"
            style={{
              flex: 1,
              background: "var(--surface-strong, rgba(255,255,255,0.06))",
              border: "1px solid var(--accent)",
              borderRadius: 6,
              color: "var(--text)",
              padding: "4px 8px",
              fontSize: "0.9rem",
            }}
          />
        ) : (
          <button
            onClick={() => setExpanded((s) => !s)}
            aria-expanded={expanded}
            aria-controls={`collection-endpoints-${id}`}
            style={{
              flex: 1,
              background: "none",
              border: "none",
              textAlign: "left",
              color: "var(--text)",
              cursor: "pointer",
              padding: 0,
              display: "flex",
              alignItems: "center",
              gap: 6,
              minWidth: 0,
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: "var(--muted)",
                transition: "transform 160ms ease",
                transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                display: "inline-block",
              }}
              aria-hidden="true"
            >
              ▶
            </span>
            <span
              style={{
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontSize: "0.9rem",
              }}
            >
              {name}
            </span>
            <span
              style={{
                marginLeft: "auto",
                fontSize: 11,
                color: "var(--muted)",
                background: "rgba(255,255,255,0.06)",
                borderRadius: 999,
                padding: "1px 7px",
                flexShrink: 0,
              }}
              aria-label={`${endpointIds.length} endpoints`}
            >
              {endpointIds.length}
            </span>
          </button>
        )}

        {/* Rename button */}
        {!renaming && (
          <button
            onClick={() => { setDraftName(name); setRenaming(true); }}
            aria-label={`Rename collection "${name}"`}
            title="Rename"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--muted)",
              padding: "2px 4px",
              borderRadius: 4,
              fontSize: 13,
              flexShrink: 0,
            }}
          >
            ✏️
          </button>
        )}

        {/* Delete button */}
        {!renaming && (
          <button
            onClick={() => {
              if (window.confirm(`Delete collection "${name}"?`)) {
                deleteCollection(id);
              }
            }}
            aria-label={`Delete collection "${name}"`}
            title="Delete"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--danger)",
              padding: "2px 4px",
              borderRadius: 4,
              fontSize: 13,
              flexShrink: 0,
            }}
          >
            🗑️
          </button>
        )}
      </div>

      {/* Endpoint list */}
      {expanded && (
        <ul
          id={`collection-endpoints-${id}`}
          role="list"
          aria-label={`Endpoints in ${name}`}
          style={{ margin: 0, padding: "0 12px 10px 36px" }}
        >
          {endpointIds.length === 0 ? (
            <li style={{ color: "var(--muted)", fontSize: "0.82rem", listStyle: "none" }}>
              No endpoints saved yet.
            </li>
          ) : (
            endpointIds.map((epId) => (
              <li
                key={epId}
                style={{
                  listStyle: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "4px 0",
                  fontSize: "0.82rem",
                  color: "var(--text)",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                }}
              >
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {resolveEndpointLabel(epId)}
                </span>
                <button
                  onClick={() => removeEndpointFromCollection(id, epId)}
                  aria-label={`Remove ${resolveEndpointLabel(epId)} from ${name}`}
                  title="Remove from collection"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--danger)",
                    padding: "1px 4px",
                    borderRadius: 4,
                    fontSize: 12,
                    flexShrink: 0,
                  }}
                >
                  ✕
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </li>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface CollectionsMenuProps {
  /** Reserved for future anchor positioning — currently unused. */
  anchorRef?: React.RefObject<HTMLElement>;
}

export default function CollectionsMenu(_props: CollectionsMenuProps) {
  const { collections, createCollection, totalSavedCount } = useCollections();

  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [showNewInput, setShowNewInput] = useState(false);
  const newInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const dragEnterIndex = useRef<number | null>(null);

  const { reorderCollections } = useCollections();

  // Focus new-collection input when it appears
  useEffect(() => {
    if (showNewInput) newInputRef.current?.focus();
  }, [showNewInput]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const handleClick = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open]);

  const handleCreate = useCallback(() => {
    if (newName.trim()) {
      createCollection(newName.trim());
      setNewName("");
      setShowNewInput(false);
    }
  }, [newName, createCollection]);

  const handleNewKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); handleCreate(); }
    if (e.key === "Escape") {
      setShowNewInput(false);
      setNewName("");
    }
  };

  // Drag handlers
  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragEnter = (index: number) => { dragEnterIndex.current = index; };
  const handleDragEnd = () => {
    if (dragIndex !== null && dragEnterIndex.current !== null && dragIndex !== dragEnterIndex.current) {
      reorderCollections(dragIndex, dragEnterIndex.current);
    }
    setDragIndex(null);
    dragEnterIndex.current = null;
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        onClick={() => setOpen((s) => !s)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Collections. ${totalSavedCount} saved endpoint${totalSavedCount !== 1 ? "s" : ""}`}
        className="ghost-button"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          minHeight: 38,
          padding: "0 14px",
          position: "relative",
        }}
      >
        <span aria-hidden="true" style={{ fontSize: 16 }}>🗂️</span>
        <span>Collections</span>
        {totalSavedCount > 0 && (
          <span
            aria-hidden="true"
            style={{
              background: "var(--accent)",
              color: "#fff",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              lineHeight: 1,
              padding: "2px 6px",
              minWidth: 18,
              textAlign: "center",
            }}
          >
            {totalSavedCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-label="Collections panel"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            zIndex: 50,
            width: 320,
            maxHeight: 480,
            overflowY: "auto",
            background: "var(--surface-strong, rgba(17,24,46,0.98))",
            border: "1px solid var(--line-strong, rgba(169,184,255,0.28))",
            borderRadius: 16,
            boxShadow: "var(--shadow)",
            padding: "14px 12px",
            backdropFilter: "blur(20px)",
          }}
        >
          {/* Panel header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "0.95rem",
                fontWeight: 700,
                color: "var(--text)",
              }}
            >
              My Collections
            </h2>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close collections panel"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--muted)",
                fontSize: 16,
                lineHeight: 1,
                padding: "2px 4px",
                borderRadius: 4,
              }}
            >
              ✕
            </button>
          </div>

          {/* Collection list */}
          {collections.length === 0 && !showNewInput ? (
            <p
              style={{
                color: "var(--muted)",
                fontSize: "0.85rem",
                textAlign: "center",
                margin: "16px 0",
              }}
            >
              No collections yet. Create one to start saving endpoints.
            </p>
          ) : (
            <ul
              role="list"
              aria-label="Collections list"
              style={{ margin: 0, padding: 0 }}
            >
              {collections.map((col, idx) => (
                <CollectionRow
                  key={col.id}
                  id={col.id}
                  name={col.name}
                  endpointIds={col.endpointIds}
                  index={idx}
                  totalCollections={collections.length}
                  dragIndex={dragIndex}
                  onDragStart={handleDragStart}
                  onDragEnter={handleDragEnter}
                  onDragEnd={handleDragEnd}
                />
              ))}
            </ul>
          )}

          {/* New collection input */}
          {showNewInput && (
            <div
              style={{
                display: "flex",
                gap: 6,
                marginTop: 8,
                alignItems: "center",
              }}
            >
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
                  borderRadius: 8,
                  color: "var(--text)",
                  padding: "6px 10px",
                  fontSize: "0.88rem",
                }}
              />
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                aria-label="Confirm create collection"
                className="primary-button"
                style={{ minHeight: 34, padding: "0 12px", fontSize: "0.85rem" }}
              >
                Add
              </button>
              <button
                onClick={() => { setShowNewInput(false); setNewName(""); }}
                aria-label="Cancel create collection"
                className="ghost-button"
                style={{ minHeight: 34, padding: "0 10px", fontSize: "0.85rem" }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Create new collection button */}
          {!showNewInput && (
            <button
              onClick={() => setShowNewInput(true)}
              aria-label="Create new collection"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                width: "100%",
                marginTop: 10,
                background: "none",
                border: "1px dashed var(--line-strong, rgba(169,184,255,0.28))",
                borderRadius: 10,
                color: "var(--accent)",
                cursor: "pointer",
                padding: "8px 12px",
                fontSize: "0.88rem",
                fontWeight: 600,
                transition: "background 140ms ease",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.background =
                  "rgba(78,133,255,0.08)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.background = "none")
              }
            >
              <span aria-hidden="true">＋</span>
              New Collection
            </button>
          )}
        </div>
      )}
    </div>
  );
}
