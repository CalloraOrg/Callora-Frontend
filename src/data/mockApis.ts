export type Review = {
  id: string;
  author: string;
  rating: number; // 1–5
  date: string;   // ISO date string
  body: string;
  verified: boolean;
};



export type APIItem = {
  id: string;
  name: string;
  provider: { name: string; url?: string; avatar?:string;};
   version?: string;
  status?: "operational" | "degraded" | "maintenance";
  description: string;
  pricePerRequest: number;
  pricePerCall?: number;
  avgLatencyMs?: number;
  uptimePercent?: number;
  rating?: number;
  tags?: string[];
  category?: string;
  createdAt?: string;
  usageCount?: number;
  features?: string[];
  useCases?: string[];
  endpoints?: Array<any>;
  stats?: { totalCalls?: number; avgResponseMs?: number; uptimePct?: number };
  ratingDistribution?: Record<number, number>;
  hourlyHealth?: ("operational" | "degraded" | "down")[];
  reviews?: Review[];
};


export const MOCK_APIS: APIItem[] = [
  {
    id: "weather-001",
    name: "WeatherSim API",
    provider: { name: "Acme Labs", url: "#" },
     version: "2.3.1",
  status: "operational",
    description:
      "WeatherSim provides hyper-local weather forecasts, historical climate data, and simulated conditions for testing your services.",
    pricePerRequest: 0.01,
    pricePerCall: 0.01,
    avgLatencyMs: 180,
    uptimePercent: 99.97,
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
        group: "Forecast",
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
        group: "Forecast",
        params: [{ name: "date", type: "string", required: true }],
        response: '{ "date": "2026-03-01", "summary": { ... } }',
      },
      {
        id: "alerts-create",
        title: "Create Weather Alert",
        url: "/v1/alerts",
        method: "POST",
        group: "Alerts",
        params: [
          { name: "location", type: "string", required: true },
          { name: "conditions", type: "array", required: false },
        ],
        response: '{ "alert_id": "12345", "status": "active" }',
      },
      {
        id: "alerts-delete",
        title: "Delete Weather Alert",
        url: "/v1/alerts/{id}",
        method: "DELETE",
        group: "Alerts",
        params: [
          { name: "id", type: "string", required: true },
        ],
        response: '{ "status": "deleted" }',
      },
    ],
    stats: { totalCalls: 382412, avgResponseMs: 180, uptimePct: 99.97 },
    ratingDistribution: { 5: 85, 4: 25, 3: 10, 2: 2, 1: 2 },
    hourlyHealth: Array(24).fill("operational").map((_, i) => i === 12 || i === 13 ? "degraded" : "operational"),
  },
  {
    id: "pay-qr",
    name: "QuickPay",
    provider: { name: "PayFast", url: "#" },
    status: "degraded",
 version: "1.8.0",
    description: "Simple payment processing with card and ACH support",
    pricePerRequest: 0.001,
    pricePerCall: 0.001,
    avgLatencyMs: 260,
    uptimePercent: 99.9,
    rating: 4.3,
    tags: ["payments", "cards"],
    category: "Payment Processing",
    createdAt: "2026-02-15",
    usageCount: 880000,
    features: ["PCI-compliant", "Low-latency captures"],
    useCases: ["Checkout", "Subscriptions"],
    endpoints: [
      {
        id: "payment-create",
        title: "Create Payment",
        url: "/v1/payments",
        method: "POST",
        group: "Payments",
        params: [
          { name: "amount", type: "number", required: true },
          { name: "currency", type: "string", required: true },
          { name: "card_token", type: "string", required: true },
        ],
        response: '{ "payment_id": "pay_123", "status": "processed" }',
      },
      {
        id: "payment-refund",
        title: "Refund Payment",
        url: "/v1/payments/{id}/refund",
        method: "POST",
        group: "Payments",
        params: [
          { name: "id", type: "string", required: true },
          { name: "amount", type: "number", required: false },
        ],
        response: '{ "refund_id": "ref_456", "status": "processed" }',
      },
      {
        id: "webhook-register",
        title: "Register Webhook",
        url: "/v1/webhooks",
        method: "POST",
        group: "Webhooks",
        params: [
          { name: "url", type: "string", required: true },
          { name: "events", type: "array", required: true },
        ],
        response: '{ "webhook_id": "wh_789", "status": "active" }',
      },
    ],
    stats: { totalCalls: 880000, avgResponseMs: 260, uptimePct: 99.9 },
    reviews: [
      {
        id: "r1",
        author: "Naomi L.",
        rating: 4,
        date: "2026-06-01",
        body: "PCI compliance out of the box is a huge time-saver.",
        verified: true,
      },
      {
        id: "r2",
        author: "Ben F.",
        rating: 5,
        date: "2026-04-20",
        body: "Handles high-volume checkouts with no issues.",
        verified: false,
      },
    ],
    hourlyHealth: Array(24).fill("operational"),
  },
  {
    id: "msg-01",
    name: "ChatStream",
    provider: { name: "Comms Inc.", url: "#" },
     version: "3.0.2",
  status: "maintenance",
    description: "Scalable messaging and notifications for apps.",
    pricePerRequest: 0.0005,
    pricePerCall: 0.0005,
    avgLatencyMs: 120,
    uptimePercent: 99.99,
    rating: 4.1,
    tags: ["sms", "email"],
    category: "Communication",
    createdAt: "2025-12-01",
    usageCount: 1200000,
    features: ["Bulk sending", "Delivery webhooks"],
    useCases: ["Notifications", "Two-factor auth"],
    endpoints: [
      {
        id: "sms-send",
        title: "Send SMS",
        url: "/v1/sms",
        method: "POST",
        group: "Messaging",
        params: [
          { name: "to", type: "string", required: true },
          { name: "message", type: "string", required: true },
          { name: "from", type: "string", required: false },
        ],
        response: '{ "message_id": "msg_001", "status": "sent" }',
      },
      {
        id: "email-send",
        title: "Send Email",
        url: "/v1/email",
        method: "POST",
        group: "Messaging",
        params: [
          { name: "to", type: "string", required: true },
          { name: "subject", type: "string", required: true },
          { name: "body", type: "string", required: true },
        ],
        response: '{ "email_id": "email_002", "status": "queued" }',
      },
      {
        id: "template-create",
        title: "Create Template",
        url: "/v1/templates",
        method: "POST",
        group: "Templates",
        params: [
          { name: "name", type: "string", required: true },
          { name: "content", type: "string", required: true },
          { name: "type", type: "string", required: true },
        ],
        response: '{ "template_id": "tpl_003", "status": "active" }',
      },
    ],
    stats: { totalCalls: 1200000, avgResponseMs: 120, uptimePct: 99.99 },
    reviews: [
      {
        id: "r1",
        author: "Eva C.",
        rating: 5,
        date: "2026-06-15",
        body: "Delivery webhooks are rock-solid. Brilliant product.",
        verified: true,
      },
    ],
    hourlyHealth: Array(24).fill("operational").map((_, i) => i > 18 && i < 22 ? "down" : "operational"),
  },
  // minimal demo items
  ...Array.from({ length: 10 }).map((_, i) => {
    const pricePerRequest = Number((Math.random() * 0.02).toFixed(4));
    const avgLatencyMs = i % 5 === 0 ? undefined : 140 + i * 18;
    const uptimePercent =
      i % 3 === 0 ? undefined : Number((99.2 + i * 0.07).toFixed(2));
const status:  APIItem["status"] =
  i % 3 === 0
    ? "operational"
    : i % 3 === 1
    ? "degraded"
    : "maintenance";
    return {
      id: `demo-${i}`,
      name: `Demo API ${i + 1}`,
      provider: { name: i % 2 === 0 ? "OpenTools" : "ThirdParty", url: "#" },
       version: `1.${i}.0`,
       status,
      description: `Demo API number ${i + 1} showcasing features and endpoints.`,
      pricePerRequest,
      pricePerCall: i % 4 === 0 ? undefined : pricePerRequest,
      avgLatencyMs,
      uptimePercent,
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
        avgResponseMs: avgLatencyMs,
        uptimePct: uptimePercent,
      },
      hourlyHealth: Array(24).fill("operational").map(() => Math.random() > 0.9 ? (Math.random() > 0.5 ? "degraded" : "down") : "operational"),
    };
  }),
];

export function findApiById(id: string | undefined) {
  if (!id) return undefined;
  return MOCK_APIS.find((a) => a.id === id || a.id === decodeURIComponent(id));
}

export default MOCK_APIS;
