import { useEffect, useRef } from "react";
import { Icons } from "../utils/icons";
import EmptyState from "./EmptyState";
import type { HistoryEntry } from "../state/testCallHistory";

type Props = {
  entries: HistoryEntry[];
  isOpen: boolean;
  onClose: () => void;
  onSelect: (entry: HistoryEntry) => void;
  onClear: () => void;
};

function formatTime(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RequestHistoryPanel({
  entries,
  isOpen,
  onClose,
  onSelect,
  onClear,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      if (wasOpenRef.current) {
        if (previousFocusRef.current?.isConnected) {
          previousFocusRef.current.focus();
        }
        previousFocusRef.current = null;
      }
      wasOpenRef.current = false;
      return;
    }

    if (!wasOpenRef.current) {
      previousFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    }
    wasOpenRef.current = true;

    const getActivePanel = () => {
      const isMobile =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(max-width: 768px)").matches;
      return isMobile ? mobilePanelRef.current : panelRef.current;
    };
    const panel = getActivePanel();
    panel?.querySelector<HTMLButtonElement>(".history-panel__close")?.focus();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key !== "Tab") return;

      const activePanel = getActivePanel();
      if (!activePanel) return;

      const focusableElements = Array.from(
        activePanel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (!firstElement || !lastElement) return;

      if (
        e.shiftKey &&
        (document.activeElement === firstElement ||
          !activePanel.contains(document.activeElement))
      ) {
        e.preventDefault();
        lastElement.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === lastElement ||
          !activePanel.contains(document.activeElement))
      ) {
        e.preventDefault();
        firstElement.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  return (
    <>
      {isOpen && (
        <div
          className="history-panel-overlay"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        ref={panelRef}
        className={`history-panel${isOpen ? " history-panel--open" : ""}`}
        role="complementary"
        aria-label="Request history"
        aria-hidden={!isOpen}
        inert={!isOpen}
      >
        <div className="history-panel__header">
          <h2 className="history-panel__title">Request History</h2>
          <button
            className="ghost-button history-panel__close"
            onClick={onClose}
            aria-label="Close request history"
          >
            <Icons.Close size={18} />
          </button>
        </div>

        {entries.length > 0 && (
          <div className="history-panel__toolbar">
            <span className="history-panel__count">{entries.length} of 50</span>
            <button
              className="ghost-button"
              onClick={onClear}
              style={{ color: "var(--danger)", fontSize: 13 }}
            >
              Clear all
            </button>
          </div>
        )}

        <div className="history-panel__body">
          {entries.length === 0 ? (
            <div className="history-panel__empty">
              <EmptyState
                variant="empty"
                title="No requests yet"
                message="Make a test call to see it appear here."
              />
            </div>
          ) : (
            <ul className="history-panel__list" role="list">
              {entries.map((entry) => (
                <li key={entry.id}>
                  <button
                    className="history-panel__item"
                    onClick={() => onSelect(entry)}
                  >
                    <div className="history-panel__item-top">
                      <span
                        className={`method-chip method-chip--${entry.method.toLowerCase()}`}
                      >
                        {entry.method}
                      </span>
                      <span className="history-panel__item-path">
                        {entry.endpointPath}
                      </span>
                    </div>
                    <div className="history-panel__item-bottom">
                      <span className="history-panel__item-time">
                        {formatTime(entry.timestamp)}
                      </span>
                      {entry.status === "success" ? (
                        <span className="history-panel__item-status history-panel__item-status--success">
                          <Icons.Check size={12} /> {entry.responseTime}ms
                        </span>
                      ) : (
                        <span className="history-panel__item-status history-panel__item-status--error">
                          <Icons.Error size={12} /> Error
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Mobile bottom sheet */}
      {isOpen && (
        <div
          ref={mobilePanelRef}
          className="history-bottom-sheet"
          role="dialog"
          aria-modal="true"
          aria-label="Request history"
        >
          <div className="bottom-sheet__handle-area">
            <div className="bottom-sheet__handle" />
          </div>
          <div className="history-panel__header">
            <h2 className="history-panel__title">Request History</h2>
            <button
              className="ghost-button history-panel__close"
              onClick={onClose}
              aria-label="Close request history"
            >
              <Icons.Close size={18} />
            </button>
          </div>

          {entries.length > 0 && (
            <div className="history-panel__toolbar">
              <span className="history-panel__count">
                {entries.length} of 50
              </span>
              <button
                className="ghost-button"
                onClick={onClear}
                style={{ color: "var(--danger)", fontSize: 13 }}
              >
                Clear all
              </button>
            </div>
          )}

          <div className="history-panel__body">
            {entries.length === 0 ? (
              <div className="history-panel__empty">
                <EmptyState
                  variant="empty"
                  title="No requests yet"
                  message="Make a test call to see it appear here."
                />
              </div>
            ) : (
              <ul className="history-panel__list" role="list">
                {entries.map((entry) => (
                  <li key={entry.id}>
                    <button
                      className="history-panel__item"
                      onClick={() => onSelect(entry)}
                    >
                      <div className="history-panel__item-top">
                        <span
                          className={`method-chip method-chip--${entry.method.toLowerCase()}`}
                        >
                          {entry.method}
                        </span>
                        <span className="history-panel__item-path">
                          {entry.endpointPath}
                        </span>
                      </div>
                      <div className="history-panel__item-bottom">
                        <span className="history-panel__item-time">
                          {formatTime(entry.timestamp)}
                        </span>
                        {entry.status === "success" ? (
                          <span className="history-panel__item-status history-panel__item-status--success">
                            <Icons.Check size={12} /> {entry.responseTime}ms
                          </span>
                        ) : (
                          <span className="history-panel__item-status history-panel__item-status--error">
                            <Icons.Error size={12} /> Error
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
