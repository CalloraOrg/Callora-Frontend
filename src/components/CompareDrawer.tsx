import React, { useEffect, useState, useRef } from "react";
import { useCompareStore, compareStore } from "../state/compareStore";
import { formatPrice } from "../utils/format";
import RatingHistogram from "./RatingHistogram";
import "./CompareDrawer.css";

export default function CompareDrawer() {
  const { apis, isOpen } = useCompareStore();
  const [announcement, setAnnouncement] = useState("");
  const drawerRef = useRef<HTMLDivElement>(null);

  // Handle ESC to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        compareStore.setOpen(false);
        drawerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  const handleRemove = (id: string, name: string) => {
    compareStore.removeApi(id);
    setAnnouncement(`Removed ${name} from comparison.`);
    setTimeout(() => setAnnouncement(""), 3000);
  };

  const handleClear = () => {
    compareStore.clear();
    setAnnouncement("Cleared all comparison items.");
    setTimeout(() => setAnnouncement(""), 3000);
  };

  if (!isOpen) return null;

  return (
    <>
      <div aria-live="polite" className="skip-link">
        {announcement}
      </div>

      <div className="compare-drawer-overlay open" onClick={() => compareStore.setOpen(false)}>
        <div
          ref={drawerRef}
          className="compare-drawer open"
          role="dialog"
          aria-modal="true"
          aria-labelledby="compare-drawer-title"
          onClick={(e) => e.stopPropagation()}
          tabIndex={-1}
        >
          <div className="compare-drawer-header">
            <h2 id="compare-drawer-title" className="compare-drawer-title">Compare APIs</h2>
            <div className="compare-drawer-actions">
               <button className="ghost-button" onClick={handleClear} aria-label="Clear all comparisons">
                Clear
              </button>
              <button className="close-button" onClick={() => compareStore.setOpen(false)} aria-label="Close drawer">
                ✕
              </button>
            </div>
          </div>

          <div className="compare-drawer-content">
            {apis.length === 0 ? (
              <div className="compare-drawer-empty">
                Select APIs to compare them.
              </div>
            ) : (
              <div className="compare-grid">
                {apis.map((api) => (
                  <div key={api.id} className="compare-column">
                    <button
                      className="compare-column-remove"
                      onClick={() => handleRemove(api.id, api.name)}
                      aria-label={`Remove ${api.name} from comparison`}
                    >
                      <span aria-hidden="true">✕</span>
                    </button>
                    
                    <div className="compare-column-header">{api.name}</div>
                    
                    <div className="compare-stat">
                      <span className="compare-stat-label">Price / call</span>
                      <span className="compare-stat-value">
                        {api.pricePerCall !== undefined ? `$${formatPrice(api.pricePerCall)}` : "—"}
                      </span>
                    </div>

                    <div className="compare-stat">
                      <span className="compare-stat-label">Latency</span>
                      <span className="compare-stat-value">
                        {api.avgLatencyMs !== undefined ? `${api.avgLatencyMs} ms` : "—"}
                      </span>
                    </div>

                    <div className="compare-stat">
                      <span className="compare-stat-label">Uptime</span>
                      <span className="compare-stat-value">
                        {api.uptimePercent !== undefined ? `${api.uptimePercent.toFixed(2)}%` : "—"}
                      </span>
                    </div>

                    <div className="compare-stat">
                      <span className="compare-stat-label">Rating</span>
                      <span className="compare-stat-value" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {api.rating !== undefined ? (
                          <RatingHistogram rating={api.rating} distribution={api.ratingDistribution}>
                            ⭐ {api.rating}
                          </RatingHistogram>
                        ) : "—"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
