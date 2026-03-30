import { useState } from "react";
import CodeExample from "../components/CodeExample";

type Props = {
  onBack?: () => void;
};

const mockApi = {
  id: "weather-001",
  name: "WeatherSim API",
  provider: { name: "Acme Labs", url: "#" },
  pricePerRequest: 0.01,
  rating: 4.6,
  description:
    "WeatherSim provides hyper-local weather forecasts, historical climate data, and simulated conditions for testing your services. Built for reliability and low-latency responses.",
  features: [
    "Sub-second response times",
    "JSON schema responses",
    "Geo-aware querying",
    "ISO timestamps and timezone handling",
  ],
  useCases: [
    "Personalized forecasts",
    "Gaming/weather simulations",
    "IoT device calibration",
  ],
  endpoints: [
    {
      id: "forecast",
      title: "Get Forecast",
      url: "/v1/forecast",
      method: "GET",
      params: [
        { name: "lat", type: "number", required: true },
        { name: "lon", type: "number", required: true },
      ],
      response: '{ "temp_c": 12.3, "conditions": "rain" }',
    },
    {
      id: "history",
      title: "Historical Weather",
      url: "/v1/history",
      method: "GET",
      params: [{ name: "date", type: "string", required: true }],
      response: '{ "date": "2026-03-01", "summary": { ... } }',
    },
  ],
  stats: { totalCalls: 382_412, avgResponseMs: 180, uptimePct: 99.97 },
};

export default function ApiDetailPage({ onBack }: Props) {
  const [tab, setTab] = useState<
    "overview" | "documentation" | "pricing" | "examples" | "reviews"
  >("overview");
  const [requests, setRequests] = useState(1000);

  const currency = (n: number) => `$${n.toFixed(3)}`;

  const curlExample = `curl -X GET "https://api.example.com${mockApi.endpoints[0].url}?lat=37.78&lon=-122.41" -H "Authorization: Bearer $API_KEY"`;
  const jsExample = `import fetch from 'node-fetch';\n\nconst res = await fetch('https://api.example.com${mockApi.endpoints[0].url}?lat=37.78&lon=-122.41', {\n  headers: { Authorization: 'Bearer YOUR_KEY' }\n});\nconst data = await res.json();\nconsole.log(data);`;
  const pyExample = `import requests\n\nresp = requests.get('https://api.example.com${mockApi.endpoints[0].url}', params={'lat':37.78, 'lon':-122.41}, headers={'Authorization':'Bearer YOUR_KEY'})\nprint(resp.json())`;

  const estimatedCost = (n: number) =>
    `$${(n * mockApi.pricePerRequest).toFixed(2)}`;

  return (
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
            style={{ display: "flex", gap: 16, alignItems: "center", flex: 1 }}
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
              <h2 style={{ margin: 0 }}>{mockApi.name}</h2>
              <div style={{ color: "var(--muted)", marginTop: 6 }}>
                <a href={mockApi.provider.url}>{mockApi.provider.name}</a> ·{" "}
                <strong style={{ color: "var(--accent-strong)" }}>
                  {currency(mockApi.pricePerRequest)}
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
                ⭐ {mockApi.rating}
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
                    tab === t ? "3px solid #4e85ff" : "3px solid transparent",
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
                <p className="helper-text">{mockApi.description}</p>

                <h3 style={{ marginTop: 18 }}>Key features</h3>
                <ul>
                  {mockApi.features.map((f) => (
                    <li key={f} style={{ color: "var(--muted)" }}>
                      {f}
                    </li>
                  ))}
                </ul>

                <h3>Use cases</h3>
                <ul>
                  {mockApi.useCases.map((u) => (
                    <li key={u} style={{ color: "var(--muted)" }}>
                      {u}
                    </li>
                  ))}
                </ul>

                <h3>Endpoints (summary)</h3>
                <div style={{ display: "grid", gap: 8 }}>
                  {mockApi.endpoints.map((ep) => (
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
                          <div style={{ color: "var(--muted)", marginTop: 6 }}>
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
                    <strong>{mockApi.stats.totalCalls.toLocaleString()}</strong>
                  </div>
                  <div className="stat-card">
                    <span>Avg response time</span>
                    <strong>{mockApi.stats.avgResponseMs} ms</strong>
                  </div>
                  <div className="stat-card">
                    <span>Uptime</span>
                    <strong>{mockApi.stats.uptimePct}%</strong>
                  </div>
                </div>
              </section>
            )}

            {tab === "documentation" && (
              <section>
                <h3>Endpoints</h3>
                <div style={{ display: "grid", gap: 12 }}>
                  {mockApi.endpoints.map((ep) => (
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
                        <div style={{ color: "var(--muted)" }}>Parameters:</div>
                        <ul>
                          {ep.params.map((p: any) => (
                            <li key={p.name} style={{ color: "var(--muted)" }}>
                              <strong>{p.name}</strong> — {p.type}{" "}
                              {p.required ? "(required)" : "(optional)"}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div style={{ marginTop: 12 }}>
                        <CodeExample language="cURL" code={curlExample} />
                        <div style={{ height: 12 }} />
                        <CodeExample language="JavaScript" code={jsExample} />
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
                          <strong>{currency(mockApi.pricePerRequest)}</strong>
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
                    <label className="field-label">Number of requests</label>
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
                    A short real-world example showing how to call the forecast
                    endpoint and handle results.
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
        style={{ padding: 20, borderLeft: "1px solid rgba(255,255,255,0.03)" }}
      >
        <div className="stat-card" style={{ marginBottom: 12 }}>
          <span>Price per request</span>
          <strong>{currency(mockApi.pricePerRequest)}</strong>
          <div style={{ color: "var(--muted)", marginTop: 8 }}>
            Category: Weather · Last updated: Mar 25, 2026
          </div>
        </div>

        <div className="stat-card" style={{ marginBottom: 12 }}>
          <span>Quick stats</span>
          <div style={{ marginTop: 8, color: "var(--muted)" }}>
            <div>Total calls: {mockApi.stats.totalCalls.toLocaleString()}</div>
            <div>Uptime: {mockApi.stats.uptimePct}%</div>
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
  );
}
