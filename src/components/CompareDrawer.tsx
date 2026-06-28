import React, { useEffect, useState } from "react";
import { useCompareStore, compareStore } from "../state/compareStore";
import { formatPrice } from "../utils/format";
import RatingHistogram from "./RatingHistogram";
import "./CompareDrawer.css";

export default function CompareDrawer() {
  const comparedApis = useCompareStore();
  const [isOpen, setIsOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  // Sync drawer visibility with items
  useEffect(() => {
    if (comparedApis.length > 0) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [comparedApis.length]);

  const handleRemove = (id: string, name: string) => {
    compareStore.removeApi(id);
    setAnnouncement(`Removed ${name} from comparison.`);
    // Clear announcement after a moment to allow re-announcing
    setTimeout(() => setAnnouncement(""), 3000);
  };

  const handleClear = () => {
    compareStore.clear();
    setAnnouncement("Cleared all comparison items.");
    setTimeout(() => setAnnouncement(""), 3000);
  };

  return (
    <>
      <div aria-live="polite" className="skip-link">
        {announcement}
      </div>

      <div className={`compare-drawer-overlay ${isOpen ? "open" : ""}`}>
        <div className={`compare-drawer ${isOpen ? "open" : ""}`}>
          <div className="compare-drawer-header">
            <h2 className="compare-drawer-title">Compare APIs</h2>
            <button className="ghost-button" onClick={handleClear} aria-label="Clear all comparisons">
              Clear
            </button>
          </div>

          <div className="compare-drawer-content">
            {comparedApis.length === 0 ? (
              <div className="compare-drawer-empty">
                Select APIs to compare them.
              </div>
            ) : (
              <div className="compare-grid">
                {comparedApis.map((api) => (
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
