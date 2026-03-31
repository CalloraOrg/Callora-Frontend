export type APIItem = {
  id: string;
  name: string;
  provider: { name: string; url?: string };
  description: string;
  pricePerRequest: number;
  rating?: number;
  tags?: string[];
  category?: string;
  createdAt?: string;
  usageCount?: number;
  features?: string[];
  useCases?: string[];
  endpoints?: Array<any>;
  stats?: { totalCalls?: number; avgResponseMs?: number; uptimePct?: number };
};

export const MOCK_APIS: APIItem[] = [
  {
    id: "weather-001",
    name: "WeatherSim API",
    provider: { name: "Acme Labs", url: "#" },
    description:
      "WeatherSim provides hyper-local weather forecasts, historical climate data, and simulated conditions for testing your services.",
    pricePerRequest: 0.01,
    rating: 4.6,
    tags: ["weather", "geo", "forecast"],
    category: "Data & Analytics",
    createdAt: "2026-03-01",
    usageCount: 382412,
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
    stats: { totalCalls: 382412, avgResponseMs: 180, uptimePct: 99.97 },
  },
  {
    id: "pay-qr",
    name: "QuickPay",
    provider: { name: "PayFast", url: "#" },
    description: "Simple payment processing with card and ACH support.",
    pricePerRequest: 0.001,
    rating: 4.3,
    tags: ["payments", "cards"],
    category: "Payment Processing",
    createdAt: "2026-02-15",
    usageCount: 880000,
    features: ["PCI-compliant", "Low-latency captures"],
    useCases: ["Checkout", "Subscriptions"],
    endpoints: [],
    stats: { totalCalls: 880000, avgResponseMs: 260, uptimePct: 99.9 },
  },
  {
    id: "msg-01",
    name: "ChatStream",
    provider: { name: "Comms Inc.", url: "#" },
    description: "Scalable messaging and notifications for apps.",
    pricePerRequest: 0.0005,
    rating: 4.1,
    tags: ["sms", "email"],
    category: "Communication",
    createdAt: "2025-12-01",
    usageCount: 1200000,
    features: ["Bulk sending", "Delivery webhooks"],
    useCases: ["Notifications", "Two-factor auth"],
    endpoints: [],
    stats: { totalCalls: 1200000, avgResponseMs: 120, uptimePct: 99.99 },
  },
  // minimal demo items
  ...Array.from({ length: 10 }).map((_, i) => ({
    id: `demo-${i}`,
    name: `Demo API ${i + 1}`,
    provider: { name: i % 2 === 0 ? "OpenTools" : "ThirdParty", url: "#" },
    description: `Demo API number ${i + 1} showcasing features and endpoints.`,
    pricePerRequest: Number((Math.random() * 0.02).toFixed(4)),
    rating: Number((3.5 + Math.random() * 1.5).toFixed(1)),
    tags: [i % 2 === 0 ? "analytics" : "utility"],
    category: i % 2 === 0 ? "Data & Analytics" : "Other",
    createdAt: new Date(Date.now() - i * 86400000).toISOString(),
    usageCount: Math.floor(Math.random() * 500000),
    features: [],
    useCases: [],
    endpoints: [],
    stats: {
      totalCalls: Math.floor(Math.random() * 500000),
      avgResponseMs: 200,
      uptimePct: 99.5,
    },
  })),
];

export function findApiById(id: string | undefined) {
  if (!id) return undefined;
  return MOCK_APIS.find((a) => a.id === id || a.id === decodeURIComponent(id));
}

export default MOCK_APIS;
