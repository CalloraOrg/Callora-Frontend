import { useState, useEffect, useRef } from "react";
import useDocumentTitle from "../hooks/useDocumentTitle";
import { MOCK_APIS } from "../data/mockApis";
import LiveRegion from "../components/LiveRegion";
import "./EndpointSummary.css";

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
      <header className="no-print endpoint-summary-header">
        <p className="eyebrow">API Documentation</p>
        <h1 className="endpoint-summary-title">Endpoint Summary</h1>
        <p className="endpoint-summary-description">
          Quick reference list of all API endpoints. Click any card to view parameters and details.
        </p>
        <button
          type="button"
          className="primary-button no-print endpoint-summary-print-btn"
          onClick={() => window.print()}
        >
          Print Summary
        </button>
        <LiveRegion
          message={announcement}
          regionId="endpoint-summary"
        />
      </header>

      <section className="endpoint-summary-list">
        {allEndpoints.map((ep) => {
          const isExpanded = expandedIds.has(ep.id);
          const panelId = `endpoint-panel-${ep.id}`;
          const triggerId = `endpoint-trigger-${ep.id}`;

          return (
            <div
              key={ep.id}
              className="preview-card endpoint-summary-card"
            >
              <button
                id={triggerId}
                type="button"
                className="endpoint-summary-trigger"
                onClick={() => toggleExpand(ep.id)}
                aria-expanded={isExpanded}
                aria-controls={panelId}
              >
                <div className="endpoint-summary-trigger-content">
                  <span className="eyebrow endpoint-summary-trigger-eyebrow">
                    {ep.apiName}
                  </span>
                  <div className="endpoint-summary-badge-row">
                    <span className={`method-badge method-badge--${(ep.method || "get").toLowerCase()}`}>
                      {ep.method}
                    </span>
                    <strong className="endpoint-summary-card-title">{ep.title}</strong>
                    <code className="endpoint-summary-url">{ep.url}</code>
                  </div>
                </div>
                <span className="endpoint-summary-chevron-wrap" aria-hidden="true">
                  <span
                    className={`chevron-icon endpoint-summary-chevron ${
                      isExpanded ? "endpoint-summary-chevron--expanded" : ""
                    }`}
                  >
                    ▼
                  </span>
                </span>
              </button>

              <div
                id={panelId}
                role="region"
                aria-labelledby={triggerId}
                hidden={!isExpanded}
                {...(!isExpanded ? ({ inert: "" } as Record<string, string>) : {})}
                className={`endpoint-summary-content ${
                  isExpanded ? "endpoint-summary-content--expanded" : "endpoint-summary-content--collapsed"
                }`}
              >
                <h4 className="endpoint-summary-params-heading">Request Parameters</h4>
                {ep.params && ep.params.length > 0 ? (
                  <>
                    {/* Desktop table view */}
                    <div className="endpoint-table-wrap">
                      <table className="endpoint-params-table">
                        <caption className="sr-only">{ep.title} parameters</caption>
                        <thead>
                          <tr className="endpoint-params-table-header-row">
                            <th scope="col">Parameter</th>
                            <th scope="col">Type</th>
                            <th scope="col">Required</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ep.params.map((p: any) => (
                            <tr key={p.name}>
                              <td className="endpoint-param-name">{p.name}</td>
                              <td>
                                <span className="type-tag">{p.type}</span>
                              </td>
                              <td>{p.required ? "Required" : "Optional"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile definition list view */}
                    <dl className="endpoint-params-dl">
                      {ep.params.map((p: any) => (
                        <div key={p.name} className="endpoint-params-dl-item">
                          <dt className="endpoint-params-dl-name">{p.name}</dt>
                          <dd className="endpoint-params-dl-meta">
                            <span className="type-tag">{p.type}</span>
                            <span
                              className={`endpoint-param-chip ${
                                p.required
                                  ? "endpoint-param-chip--required"
                                  : "endpoint-param-chip--optional"
                              }`}
                            >
                              {p.required ? "Required" : "Optional"}
                            </span>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </>
                ) : (
                  <p className="endpoint-summary-empty">No parameters required.</p>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
