import { useMemo, useState } from "react";
import CodeExample from "../components/CodeExample";
import { findApiById } from "../data/mockApis";
import EmptyState from "../components/EmptyState";

type Props = {
  onBack?: () => void;
};

export default function ApiDetailPage({ onBack }: Props) {
  const [tab, setTab] = useState<
    "overview" | "documentation" | "pricing" | "examples" | "reviews"
  >("overview");
  const [requests, setRequests] = useState(1000);

  const id =
    typeof window !== "undefined"
      ? window.location.pathname.split("/").filter(Boolean).pop()
      : undefined;
  const api = useMemo(() => findApiById(id), [id]);

  if (!api) {
    return (
      <div style={{ padding: 20 }}>
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
    );
  }

  const currency = (n: number) => `$${n.toFixed(3)}`;

  const firstEndpoint = (api.endpoints && api.endpoints[0]) || { url: "/" };
  const curlExample = `curl -X GET "https://api.example.com${firstEndpoint.url}?lat=37.78&lon=-122.41" -H "Authorization: Bearer $API_KEY"`;
  const jsExample = `import fetch from 'node-fetch';\n\nconst res = await fetch('https://api.example.com${firstEndpoint.url}?lat=37.78&lon=-122.41', {\n  headers: { Authorization: 'Bearer YOUR_KEY' }\n});\nconst data = await res.json();\nconsole.log(data);`;
  const pyExample = `import requests\n\nresp = requests.get('https://api.example.com${firstEndpoint.url}', params={'lat':37.78, 'lon':-122.41}, headers={'Authorization':'Bearer YOUR_KEY'})\nprint(resp.json())`;

  const estimatedCost = (n: number) =>
    `$${(n * (api.pricePerRequest ?? 0)).toFixed(2)}`;

  return (
    <div style={{ padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 1280, margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 320px",
            gap: 0,
          }}
        >
          <div style={{ padding: 24 }}>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <button
                className="ghost-button"
                onClick={onBack}
                style={{ marginRight: 8 }}
              >
                Back
              </button>
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  alignItems: "center",
                  flex: 1,
                }}
              >
                <div
                  style={{
                    width: 84,
                    height: 84,
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.04)",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 700,
                  }}
                >
                  W
                </div>
                <div>
                  <h2 style={{ margin: 0 }}>{api.name}</h2>
                  <div style={{ color: "var(--muted)", marginTop: 6 }}>
                    <a href={api.provider?.url}>{api.provider?.name}</a> ·{" "}
                    <strong style={{ color: "var(--accent-strong)" }}>
                      {currency(api.pricePerRequest ?? 0)}
                    </strong>{" "}
                    per request
                  </div>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <button
                    className="primary-button"
                    onClick={() => alert("Start using API (placeholder)")}
                  >
                    Start Using API
                  </button>
                  <div style={{ alignSelf: "center", color: "var(--muted)" }}>
                    ⭐ {api.rating}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <nav
                style={{
                  display: "flex",
                  gap: 12,
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  paddingBottom: 12,
                }}
              >
                {[
                  "overview",
                  "documentation",
                  "pricing",
                  "examples",
                  "reviews",
                ].map((t) => (
                  <button
                    key={t}
                    className={
                      tab === (t as any) ? "nav-button active" : "nav-button"
                    }
                    onClick={() => setTab(t as any)}
                    style={{
                      background: "transparent",
                      color: "var(--text)",
                      borderBottom:
                        tab === t
                          ? "3px solid #4e85ff"
                          : "3px solid transparent",
                      paddingBottom: 8,
                      transition: "border-color 180ms ease",
                    }}
                  >
                    {t[0].toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </nav>

              <div style={{ marginTop: 18 }}>
                {tab === "overview" && (
                  <section>
                    <p className="helper-text">{api.description}</p>

                    <h3 style={{ marginTop: 18 }}>Key features</h3>
                    <ul>
                      {(api.features || []).map((f: string) => (
                        <li key={f} style={{ color: "var(--muted)" }}>
                          {f}
                        </li>
                      ))}
                    </ul>

                    <h3>Use cases</h3>
                    <ul>
                      {(api.useCases || []).map((u: string) => (
                        <li key={u} style={{ color: "var(--muted)" }}>
                          {u}
                        </li>
                      ))}
                    </ul>

                    <h3>Endpoints (summary)</h3>
                    <div style={{ display: "grid", gap: 8 }}>
                      {(api.endpoints || []).map((ep: any) => (
                        <article
                          key={ep.id}
                          className="preview-card"
                          style={{ padding: 12 }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                            }}
                          >
                            <div>
                              <strong>{ep.title}</strong>
                              <div
                                style={{ color: "var(--muted)", marginTop: 6 }}
                              >
                                {ep.method} {ep.url}
                              </div>
                            </div>
                            <div style={{ color: "var(--muted)" }}>
                              Example response
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>

                    <h3 style={{ marginTop: 18 }}>Statistics</h3>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, minmax(0,1fr))",
                        gap: 12,
                      }}
                    >
                      <div className="stat-card">
                        <span>Total calls</span>
                        <strong>
                          {(api.stats?.totalCalls ?? 0).toLocaleString()}
                        </strong>
                      </div>
                      <div className="stat-card">
                        <span>Avg response time</span>
                        <strong>{api.stats?.avgResponseMs ?? 0} ms</strong>
                      </div>
                      <div className="stat-card">
                        <span>Uptime</span>
                        <strong>{api.stats?.uptimePct ?? 0}%</strong>
                      </div>
                    </div>
                  </section>
                )}

                {tab === "documentation" && (
                  <section>
                    <h3>Endpoints</h3>
                    <div style={{ display: "grid", gap: 12 }}>
                      {(api.endpoints || []).map((ep: any) => (
                        <article
                          key={ep.id}
                          className="preview-card"
                          style={{ padding: 12 }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                            }}
                          >
                            <div>
                              <strong>{ep.title}</strong>
                              <div style={{ color: "var(--muted)" }}>
                                {ep.method} {ep.url}
                              </div>
                            </div>
                            <div style={{ color: "var(--muted)" }}>
                              Response: JSON
                            </div>
                          </div>

                          <div style={{ marginTop: 12 }}>
                            <div style={{ color: "var(--muted)" }}>
                              Parameters:
                            </div>
                            <ul>
                              {ep.params.map((p: any) => (
                                <li
                                  key={p.name}
                                  style={{ color: "var(--muted)" }}
                                >
                                  <strong>{p.name}</strong> — {p.type}{" "}
                                  {p.required ? "(required)" : "(optional)"}
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div style={{ marginTop: 12 }}>
                            <CodeExample language="cURL" code={curlExample} />
                            <div style={{ height: 12 }} />
                            <CodeExample
                              language="JavaScript"
                              code={jsExample}
                            />
                            <div style={{ height: 12 }} />
                            <CodeExample language="Python" code={pyExample} />
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                )}

                {tab === "pricing" && (
                  <section>
                    <h3>Pricing</h3>
                    <div style={{ display: "flex", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div className="preview-card" style={{ padding: 12 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                            }}
                          >
                            <div>
                              <strong>
                                {currency(api.pricePerRequest ?? 0)}
                              </strong>
                              <div style={{ color: "var(--muted)" }}>
                                per request
                              </div>
                            </div>
                            <div style={{ color: "var(--muted)" }}>
                              Volume discounts available
                            </div>
                          </div>
                        </div>

                        <h4 style={{ marginTop: 12 }}>Estimate costs</h4>
                        <label className="field-label">
                          Number of requests
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={100000}
                          value={requests}
                          onChange={(e) => setRequests(Number(e.target.value))}
                        />
                        <div
                          style={{
                            marginTop: 8,
                            display: "flex",
                            justifyContent: "space-between",
                            color: "var(--muted)",
                          }}
                        >
                          <div>{requests.toLocaleString()} requests</div>
                          <div>
                            Estimated:{" "}
                            <strong style={{ color: "var(--accent-strong)" }}>
                              {estimatedCost(requests)}
                            </strong>
                          </div>
                        </div>
                      </div>

                      <div style={{ width: 320 }}>
                        <div className="stat-card">
                          <span>Pricing tiers</span>
                          <div style={{ marginTop: 8, color: "var(--muted)" }}>
                            <div>$0.010 / req — 0–100k</div>
                            <div>$0.008 / req — 100k–1M</div>
                            <div>Contact sales — enterprise</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {tab === "examples" && (
                  <section>
                    <h3>Integration examples</h3>
                    <div className="preview-card" style={{ padding: 12 }}>
                      <p className="helper-text">
                        A short real-world example showing how to call the
                        forecast endpoint and handle results.
                      </p>
                      <CodeExample language="JavaScript" code={jsExample} />
                    </div>
                  </section>
                )}

                {tab === "reviews" && (
                  <section>
                    <h3>Reviews & Feedback</h3>
                    <div className="preview-card" style={{ padding: 12 }}>
                      <p style={{ margin: 0, color: "var(--muted)" }}>
                        No public reviews yet. Be the first to leave feedback.
                      </p>
                    </div>
                  </section>
                )}
              </div>
            </div>
          </div>

          <aside
            style={{
              padding: 20,
              borderLeft: "1px solid rgba(255,255,255,0.03)",
            }}
          >
            <div className="stat-card" style={{ marginBottom: 12 }}>
              <span>Price per request</span>
              <strong>{currency(api.pricePerRequest ?? 0)}</strong>
              <div style={{ color: "var(--muted)", marginTop: 8 }}>
                Category: Weather · Last updated: Mar 25, 2026
              </div>
            </div>

            <div className="stat-card" style={{ marginBottom: 12 }}>
              <span>Quick stats</span>
              <div style={{ marginTop: 8, color: "var(--muted)" }}>
                <div>
                  Total calls: {(api.stats?.totalCalls ?? 0).toLocaleString()}
                </div>
                <div>Uptime: {api.stats?.uptimePct ?? 0}%</div>
              </div>
            </div>

            <div style={{ position: "sticky", top: 24 }}>
              <button
                className="primary-button"
                style={{ width: "100%", marginBottom: 12 }}
                onClick={() => alert("Start using API (placeholder)")}
              >
                Start Using API
              </button>

              <div className="stat-card">
                <span>Related APIs</span>
                <div style={{ marginTop: 8, color: "var(--muted)" }}>
                  <div>ClimateTrend API — $0.02 / req</div>
                  <div>StormAlert API — $0.012 / req</div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
