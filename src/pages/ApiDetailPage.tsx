import { useMemo, useState } from "react";
import CodeExample from "../components/CodeExample";
import Breadcrumb from "../components/Breadcrumb";
import { findApiById } from "../data/mockApis";
import EmptyState from "../components/EmptyState";

/**
 * ApiDetailPage Component
 * * Provides a comprehensive view of a specific API, including:
 * - Interactive documentation with code snippets
 * - Real-time cost estimation
 * - Performance statistics and health metrics
 * - Implementation examples across multiple languages
 */

type Props = {
  onBack?: () => void;
};

type TabType = "overview" | "documentation" | "pricing" | "examples" | "reviews";

export default function ApiDetailPage({ onBack }: Props) {
  const [tab, setTab] = useState<TabType>("overview");
  const [requests, setRequests] = useState(1000);

  // Extract ID from URL path: /details/[id]
  const id =
    typeof window !== "undefined"
      ? window.location.pathname.split("/").filter(Boolean).pop()
      : undefined;

  const api = useMemo(() => findApiById(id), [id]);

  if (!api) {
    return (
      <div className="api-detail-page">
        <div className="api-detail-container">
          <Breadcrumb
            items={[
              { label: "Marketplace", href: "/marketplace" },
              { label: "Not Found", href: "", isCurrent: true },
            ]}
          />
          <EmptyState
            title="API not found"
            message="We couldn't find that API. Try the marketplace."
          />
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <button
              className="primary-button"
              onClick={() => (window.location.href = "/marketplace")}
            >
              Back to marketplace
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currency = (n: number) => `$${n.toFixed(3)}`;

  // Example Generation Logic
  const firstEndpoint = (api.endpoints && api.endpoints[0]) || { url: "/v1/data", method: "GET" };
  const baseUrl = "https://api.callora.com";

  const curlExample = `curl -X ${firstEndpoint.method} "${baseUrl}${firstEndpoint.url}?lat=37.78&lon=-122.41" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"`;

  const jsExample = `import fetch from 'node-fetch';

const getApiData = async () => {
  const response = await fetch('${baseUrl}${firstEndpoint.url}', {
    method: '${firstEndpoint.method}',
    headers: { 
      'Authorization': 'Bearer YOUR_API_KEY',
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) throw new Error('API request failed');
  
  const data = await response.json();
  return data;
};

getApiData().then(console.log).catch(console.error);`;

  const pyExample = `import requests

url = "${baseUrl}${firstEndpoint.url}"
headers = {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
}
params = {
    "lat": 37.78,
    "lon": -122.41
}

response = requests.get(url, headers=headers, params=params)
data = response.json()

print(data)`;

  const allSnippets = {
    bash: curlExample,
    javascript: jsExample,
    python: pyExample,
  };

  const estimatedCost = (n: number) =>
    `$${(n * (api.pricePerRequest ?? 0)).toFixed(2)}`;

  return (
    <div className="api-detail-page">
      <div className="api-detail-container">
        <Breadcrumb
          items={[
            { label: "Marketplace", href: "/marketplace" },
            { label: api.name, href: "", isCurrent: true },
          ]}
        />
        <div
          className="api-detail-shell"
        >
          <div className="api-detail-hero">
            <div className="api-detail-heading">
              <button
                className="ghost-button"
                onClick={onBack}
                type="button"
              >
                Back
              </button>
              <div
                className="api-detail-brand"
              >
                <div
                  className="api-detail-logo"
                >
                  W
                </div>
                <div className="api-detail-title">
                  <h2>{api.name}</h2>
                  <div className="api-detail-meta">
                    <a href={api.provider?.url}>{api.provider?.name}</a> ·{" "}
                    <strong style={{ color: "var(--accent-strong)" }}>
                      {currency(api.pricePerRequest ?? 0)}
                    </strong>{" "}
                    per request
                  </div>
                </div>
                <div className="api-detail-provider">
                  Published by <a href={api.provider?.url} style={{ color: "var(--text-main)", textDecoration: "none" }}>{api.provider?.name}</a>
                </div>
              </div>
            </div>
            <div className="api-detail-price-panel">
              <div className="api-detail-price">
                {currency(api.pricePerRequest ?? 0)}
              </div>
              <div className="api-detail-price-label">per successful request</div>
              <button className="primary-button">
                Connect API
              </button>
            </div>
          </div>

          <div className="api-detail-content-grid">
            <div className="content-left">
              {/* Tabs Navigation */}
              <nav className="api-detail-tabs">
                {(["overview", "documentation", "pricing", "examples", "reviews"] as TabType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: "12px 0",
                      color: tab === t ? "var(--text-main)" : "var(--muted)",
                      fontSize: 15,
                      fontWeight: tab === t ? 600 : 400,
                      cursor: "pointer",
                      position: "relative",
                      transition: "color 0.2s"
                    }}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                    {tab === t && (
                      <div style={{
                        position: "absolute",
                        bottom: -1,
                        left: 0,
                        right: 0,
                        height: 2,
                        background: "var(--accent)"
                      }} />
                    )}
                  </button>
                ))}
              </nav>

              <div className="tab-content" style={{ animation: "fadeIn 0.3s ease" }}>
                {/* OVERVIEW TAB */}
                {tab === "overview" && (
                  <section>
                    <div className="preview-card" style={{ padding: 24, marginBottom: 32 }}>
                       <h3 style={{ marginTop: 0 }}>About this API</h3>
                       <p style={{ lineHeight: 1.6, fontSize: 16, color: "var(--text-secondary)" }}>{api.description}</p>
                    </div>

                    <div className="api-detail-two-column">
                      <div>
                        <h3>Key Features</h3>
                        <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
                          {(api.features || []).map((f) => (
                            <li key={f} style={{ color: "var(--text-secondary)" }}>{f}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h3>Primary Use Cases</h3>
                        <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
                          {(api.useCases || []).map((u) => (
                            <li key={u} style={{ color: "var(--text-secondary)" }}>{u}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <h3 style={{ marginTop: 40 }}>Performance Metrics</h3>
                    <div className="api-detail-metrics">
                      <div className="stat-card" style={{ padding: 20, background: "var(--bg-subtle)", borderRadius: 12 }}>
                        <div style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase" }}>Total Requests</div>
                        <div style={{ fontSize: 24, fontWeight: 700, marginTop: 8 }}>{(api.stats?.totalCalls ?? 0).toLocaleString()}</div>
                      </div>
                      <div className="stat-card" style={{ padding: 20, background: "var(--bg-subtle)", borderRadius: 12 }}>
                        <div style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase" }}>Latency (P95)</div>
                        <div style={{ fontSize: 24, fontWeight: 700, marginTop: 8 }}>{api.stats?.avgResponseMs ?? 0}ms</div>
                      </div>
                      <div className="stat-card" style={{ padding: 20, background: "var(--bg-subtle)", borderRadius: 12 }}>
                        <div style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase" }}>System Uptime</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: "#10b981", marginTop: 8 }}>{api.stats?.uptimePct ?? 0}%</div>
                      </div>
                    </div>
                  </section>
                )}

                {/* DOCUMENTATION TAB */}
                {tab === "documentation" && (
                  <section>
                    <div className="endpoint-section-header">
                      <h3>Available Endpoints</h3>
                      <span style={{ fontSize: 13, color: "var(--muted)" }}>Base URL: <code>{baseUrl}</code></span>
                    </div>
                    
                    <div style={{ display: "grid", gap: 20, marginTop: 16 }}>
                      {(api.endpoints || []).map((ep: any) => (
                        <div key={ep.id} className="preview-card" style={{ padding: 0, overflow: "hidden" }}>
                          <div className="endpoint-card-header">
                            <div className="endpoint-title-row">
                              <span style={{ 
                                padding: "4px 8px", 
                                background: ep.method === "GET" ? "#3b82f6" : "#10b981",
                                color: "white",
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 800
                              }}>{ep.method}</span>
                              <strong style={{ fontSize: 15 }}>{ep.title}</strong>
                            </div>
                            <code className="endpoint-url">{ep.url}</code>
                          </div>
                          
                          <div style={{ padding: 24 }}>
                            <h4 style={{ margin: "0 0 12px 0", fontSize: 14 }}>Request Parameters</h4>
                            <div className="endpoint-table-wrap">
                              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                                <thead>
                                  <tr style={{ textAlign: "left", color: "var(--muted)", borderBottom: "1px solid var(--border-subtle)" }}>
                                    <th style={{ padding: "8px 0" }}>Parameter</th>
                                    <th>Type</th>
                                    <th>Required</th>
                                    <th>Description</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {ep.params.map((p: any) => (
                                    <tr key={p.name} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                                      <td style={{ padding: "12px 0", fontFamily: "monospace", color: "var(--accent)" }}>{p.name}</td>
                                      <td><span className="type-tag">{p.type}</span></td>
                                      <td>{p.required ? "Yes" : "Optional"}</td>
                                      <td style={{ color: "var(--muted)" }}>Standard filter for this endpoint.</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            <h4 style={{ margin: "24px 0 12px 0", fontSize: 14 }}>Implementation</h4>
                            <CodeExample snippets={allSnippets} defaultLanguage="bash" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* PRICING TAB */}
                {tab === "pricing" && (
                  <section>
                    <h3>Pricing Plans</h3>
                    <div className="api-detail-pricing-grid">
                      <div className="preview-card" style={{ padding: 24, border: "2px solid var(--accent)" }}>
                        <div style={{ color: "var(--accent)", fontWeight: 700, fontSize: 12, textTransform: "uppercase" }}>Standard</div>
                        <div className="api-detail-plan-price">{currency(api.pricePerRequest ?? 0)} <span style={{ fontSize: 14, color: "var(--muted)" }}>/ call</span></div>
                        <p style={{ fontSize: 14, color: "var(--muted)" }}>Perfect for startups and scaling applications. Pay only for what you use.</p>
                        <ul style={{ padding: 0, listStyle: "none", fontSize: 14, marginTop: 20 }}>
                          <li style={{ marginBottom: 10 }}>✅ Unlimited Throughput</li>
                          <li style={{ marginBottom: 10 }}>✅ 99.9% Uptime SLA</li>
                          <li style={{ marginBottom: 10 }}>✅ Community Support</li>
                        </ul>
                      </div>
                      <div className="preview-card" style={{ padding: 24 }}>
                        <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12, textTransform: "uppercase" }}>Enterprise</div>
                        <div className="api-detail-plan-price">Custom</div>
                        <p style={{ fontSize: 14, color: "var(--muted)" }}>For high-volume needs requiring dedicated infrastructure and support.</p>
                        <ul style={{ padding: 0, listStyle: "none", fontSize: 14, marginTop: 20 }}>
                          <li style={{ marginBottom: 10 }}>✅ Dedicated Node</li>
                          <li style={{ marginBottom: 10 }}>✅ 24/7 Phone Support</li>
                          <li style={{ marginBottom: 10 }}>✅ Custom Rate Limits</li>
                        </ul>
                        <button className="secondary-button" style={{ width: "100%", marginTop: 10 }}>Contact Sales</button>
                      </div>
                    </div>

                    <div className="preview-card" style={{ padding: 32 }}>
                      <h4 style={{ marginTop: 0 }}>Cost Calculator</h4>
                      <p style={{ color: "var(--muted)" }}>Estimate your monthly billing based on projected request volume.</p>
                      
                      <div style={{ marginTop: 32 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                          <span style={{ fontWeight: 600 }}>Monthly Volume</span>
                          <span style={{ color: "var(--accent)", fontWeight: 700 }}>{requests.toLocaleString()} Requests</span>
                        </div>
                        <input
                          type="range"
                          min={100}
                          max={1000000}
                          step={100}
                          value={requests}
                          onChange={(e) => setRequests(Number(e.target.value))}
                          style={{ width: "100%", height: 6, borderRadius: 3, appearance: "none", background: "var(--border-subtle)" }}
                        />
                        
                        <div className="api-detail-calculator-total">
                          <div>
                            <div style={{ fontSize: 12, color: "var(--muted)" }}>Estimated Monthly Total</div>
                            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text-main)" }}>{estimatedCost(requests)}</div>
                          </div>
                          <div style={{ textAlign: "right", fontSize: 13, color: "var(--muted)" }}>
                            * Volume discounts apply automatically <br /> 
                            at 500k+ requests.
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {/* EXAMPLES TAB */}
                {tab === "examples" && (
                  <section>
                    <h3>Integration Gallery</h3>
                    <p style={{ color: "var(--muted)", marginBottom: 24 }}>Explore these Boilerplate examples to get integrated in minutes.</p>
                    
                    <div className="preview-card" style={{ padding: 24, marginBottom: 24 }}>
                      <div className="api-detail-example-tags">
                        <span style={{ padding: "4px 12px", background: "#e0f2fe", color: "#0369a1", borderRadius: 4, fontSize: 12, fontWeight: 600 }}>React / Next.js</span>
                        <span style={{ padding: "4px 12px", background: "#fef3c7", color: "#92400e", borderRadius: 4, fontSize: 12, fontWeight: 600 }}>Server-side</span>
                      </div>
                      <h4>Fetching data in a Next.js Page</h4>
                      <CodeExample snippets={allSnippets} defaultLanguage="javascript" />
                    </div>

                    <div className="preview-card" style={{ padding: 24 }}>
                      <h4>Python Data Analysis Workflow</h4>
                      <CodeExample snippets={allSnippets} defaultLanguage="python" />
                    </div>
                  </section>
                )}

                {/* REVIEWS TAB */}
                {tab === "reviews" && (
                  <section>
                    <div className="api-detail-reviews-header">
                      <h3>Developer Feedback</h3>
                      <button className="secondary-button">Write a Review</button>
                    </div>
                    
                    <div className="preview-card" style={{ padding: 40, textAlign: "center", borderStyle: "dashed" }}>
                       <div style={{ fontSize: 40, marginBottom: 16 }}>💬</div>
                       <h4>No public reviews yet</h4>
                       <p style={{ color: "var(--muted)", maxWidth: 400, margin: "0 auto" }}>
                         Be the first to share your experience with this API. 
                         Your feedback helps other developers make better choices.
                       </p>
                    </div>
                  </section>
                )}
              </div>
            </div>

            {/* Sidebar Sticky Column */}
            <aside className="api-detail-sidebar">
              <div className="api-detail-sidebar-inner">
                <div className="stat-card" style={{ padding: 24, marginBottom: 20 }}>
                  <h4 style={{ marginTop: 0 }}>API Health</h4>
                  <div style={{ display: "grid", gap: 16, marginTop: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 14, color: "var(--muted)" }}>Status</span>
                      <span style={{ fontSize: 14, color: "#10b981", fontWeight: 600 }}>● Operational</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 14, color: "var(--muted)" }}>Region</span>
                      <span style={{ fontSize: 14 }}>Global (Edge)</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 14, color: "var(--muted)" }}>CORS</span>
                      <span style={{ fontSize: 14, color: "#10b981" }}>Supported</span>
                    </div>
                  </div>
                </div>

                <div className="preview-card" style={{ padding: 24, marginBottom: 20 }}>
                  <h4 style={{ marginTop: 0 }}>SDKs & Tools</h4>
                  <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                    <button className="ghost-button" style={{ justifyContent: "flex-start", width: "100%", fontSize: 13 }}>📦 Node.js SDK</button>
                    <button className="ghost-button" style={{ justifyContent: "flex-start", width: "100%", fontSize: 13 }}>📦 Python Wrapper</button>
                    <button className="ghost-button" style={{ justifyContent: "flex-start", width: "100%", fontSize: 13 }}>📜 OpenAPI Spec (JSON)</button>
                  </div>
                </div>

                <div style={{ 
                  background: "linear-gradient(rgba(78, 133, 255, 0.1), rgba(78, 133, 255, 0.05))", 
                  padding: 24, 
                  borderRadius: 16,
                  border: "1px solid rgba(78, 133, 255, 0.2)"
                }}>
                  <h4 style={{ marginTop: 0, color: "var(--accent-strong)" }}>Support</h4>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    Need help with integration? Access our developer discord or email the provider directly.
                  </p>
                  <button className="primary-button" style={{ width: "100%", marginTop: 12 }}>Contact Publisher</button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
