import { useState, useEffect, useRef } from "react";
import useDocumentTitle from "../hooks/useDocumentTitle";
import { MOCK_APIS } from "../data/mockApis";
import { API_BASE_URL } from "../config/constants";
import LiveRegion from "../components/LiveRegion";

export default function EndpointSummary(): JSX.Element {
  useDocumentTitle(
    "Endpoint Summary – Callora",
    "Summary of all endpoints available on Callora."
  );

  // Flatten all endpoints from all mock APIs
  const allEndpoints = MOCK_APIS.flatMap((api) =>
    (api.endpoints || []).map((ep) => ({
      ...ep,
      apiName: api.name,
    }))
  );

  // Track expanded cards
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(allEndpoints.slice(0, 3).map((ep) => ep.id)) // Expand first 3 by default
  );

  // Screen-reader announcement state
  const [announcement, setAnnouncement] = useState("");
  const prevExpandedIdsRef = useRef(expandedIds);

  useEffect(() => {
    const prev = prevExpandedIdsRef.current;
    const endpointMap = new Map(allEndpoints.map((ep) => [ep.id, ep]));

    for (const id of expandedIds) {
      if (!prev.has(id)) {
        const ep = endpointMap.get(id);
        setAnnouncement(`Expanded ${ep?.title ?? id} details`);
        prevExpandedIdsRef.current = expandedIds;
        return;
      }
    }
    for (const id of prev) {
      if (!expandedIds.has(id)) {
        const ep = endpointMap.get(id);
        setAnnouncement(`Collapsed ${ep?.title ?? id} details`);
        prevExpandedIdsRef.current = expandedIds;
        return;
      }
    }
    prevExpandedIdsRef.current = expandedIds;
  }, [expandedIds, allEndpoints]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="endpoint-summary-page" style={{ padding: "24px 0" }}>
      <header className="no-print" style={{ marginBottom: "32px", padding: "0 4px" }}>
        <p className="eyebrow">API Documentation</p>
        <h1
          style={{
            margin: "0 0 12px",
            fontSize: "clamp(1.8rem, 3vw, 2.4rem)",
            fontWeight: "700",
            color: "var(--text)",
          }}
        >
          Endpoint Summary
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: "1rem",
            color: "var(--muted)",
            lineHeight: "1.65",
            maxWidth: "600px",
          }}
        >
          Quick reference list of all API endpoints. Click any card to view parameters and details.
        </p>
        <button
          type="button"
          className="primary-button no-print"
          style={{ marginTop: "16px" }}
          onClick={() => window.print()}
        >
          Print Summary
        </button>
        <LiveRegion
          message={announcement}
          regionId="endpoint-summary"
        />
      </header>

      <section style={{ display: "grid", gap: "16px" }}>
        {allEndpoints.map((ep) => {
          const isExpanded = expandedIds.has(ep.id);
          return (
            <div
              key={ep.id}
              className="preview-card endpoint-summary-card"
              style={{ padding: 0, overflow: "hidden" }}
            >
              <button
                type="button"
                className="endpoint-summary-trigger"
                onClick={() => toggleExpand(ep.id)}
                aria-expanded={isExpanded}
                style={{
                  width: "100%",
                  textAlign: "left",
                  background: "var(--surface-soft)",
                  border: "none",
                  padding: "16px 24px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                  color: "var(--text)",
                }}
              >
                <div>
                  <span className="eyebrow" style={{ display: "block", marginBottom: "4px" }}>
                    {ep.apiName}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                    <span className={`method-badge method-badge--${(ep.method || "get").toLowerCase()}`}>
                      {ep.method}
                    </span>
                    <strong style={{ fontSize: "16px" }}>{ep.title}</strong>
                    <code style={{ fontSize: "13px", color: "var(--muted)" }}>{ep.url}</code>
                  </div>
                </div>
                <span
                  className="chevron-icon"
                  style={{
                    transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s",
                    display: "inline-block",
                  }}
                >
                  ▼
                </span>
              </button>

              <div
                className={`endpoint-summary-content ${
                  isExpanded ? "endpoint-summary-content--expanded" : "endpoint-summary-content--collapsed"
                }`}
                style={{
                  padding: "24px",
                  borderTop: "1px solid var(--line)",
                }}
              >
                <h4 style={{ margin: "0 0 12px 0", fontSize: "14px" }}>Request Parameters</h4>
                {ep.params && ep.params.length > 0 ? (
                  <div className="endpoint-table-wrap">
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                      <thead>
                        <tr
                          style={{
                            textAlign: "left",
                            color: "var(--muted)",
                            borderBottom: "1px solid var(--line)",
                          }}
                        >
                          <th style={{ padding: "8px 0" }}>Parameter</th>
                          <th>Type</th>
                          <th>Required</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ep.params.map((p: any) => (
                          <tr key={p.name} style={{ borderBottom: "1px solid var(--line)" }}>
                            <td
                              style={{
                                padding: "12px 0",
                                fontFamily: "monospace",
                                color: "var(--accent)",
                              }}
                            >
                              {p.name}
                            </td>
                            <td>
                              <span className="type-tag">{p.type}</span>
                            </td>
                            <td>{p.required ? "Yes" : "Optional"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ color: "var(--muted)", fontSize: "13px" }}>No parameters required.</p>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
