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
  pricing?: number;
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
  sparklineValues?: number[];
  pricingOnRequest?: boolean;
  baseUrl?: string;
};


const SAMPLE_APIS: Array<{
  id: string; name: string; provider: string; version: string;
  status: "operational" | "degraded" | "maintenance"; description: string;
  price: number; latency: number; uptime: number; rating: number;
  tags: string[]; category: string; calls: number; features: string[]; useCases: string[];
  sla?: APIItem["sla"];
  endpoints: NonNullable<APIItem["endpoints"]>;
}> = [
  { id: "geocode-01", name: "GeoLocate", provider: "Acme Labs", version: "1.8.0", status: "operational",
    description: "Forward and reverse geocoding with address autocomplete for 200+ countries.",
    price: 0.002, latency: 95, uptime: 99.98, rating: 4.7, tags: ["geocoding", "maps", "address"], category: "Data & Analytics",
    calls: 912340, features: ["Address autocomplete", "Batch geocoding", "Postal code lookup"], useCases: ["Checkout forms", "Delivery routing"],
    sla: {
      uptimeTargetPct: 99.95,
      p99LatencyMs: 250,
      incidentResponseMinutes: 15,
      maintenanceWindow: "Sundays 02:00–04:00 UTC",
      supportTier: "Priority (24/7)",
      creditThresholdPct: 99.5,
    },
    endpoints: [{ id: "forward-geocode", title: "Forward Geocode", url: "/v1/geocode", method: "GET", group: "Geocoding", params: [{ name: "address", type: "string", required: true }, { name: "country", type: "string", required: false }], response: '{ "lat": 40.7128, "lon": -74.006, "confidence": 0.98 }' }, { id: "reverse-geocode", title: "Reverse Geocode", url: "/v1/reverse", method: "GET", group: "Geocoding", params: [{ name: "lat", type: "number", required: true }, { name: "lon", type: "number", required: true }], response: '{ "formatted": "350 5th Ave, New York, NY 10118, USA" }' }] },
  { id: "fx-rates-01", name: "FX Rates Live", provider: "Ledgerline", version: "2.1.4", status: "operational",
    description: "Real-time and historical exchange rates for 160 fiat and 40 crypto currencies.",
    price: 0.0015, latency: 70, uptime: 99.99, rating: 4.8, tags: ["forex", "currency", "finance"], category: "Finance",
    calls: 1530200, features: ["Tick-level history", "Cross-rate conversion"], useCases: ["Invoicing", "Portfolio tracking"],
    sla: {
      uptimeTargetPct: 99.99,
      p99LatencyMs: 120,
      incidentResponseMinutes: 10,
      maintenanceWindow: "Saturdays 01:00–03:00 UTC",
      supportTier: "Enterprise (24/7)",
      creditThresholdPct: 99.8,
    },
    endpoints: [{ id: "latest-rates", title: "Latest Rates", url: "/v1/rates/latest", method: "GET", group: "Rates", params: [{ name: "base", type: "string", required: true }, { name: "symbols", type: "string", required: false }], response: '{ "base": "USD", "rates": { "EUR": 0.92, "XLM": 8.41 } }' }, { id: "convert-amount", title: "Convert Amount", url: "/v1/convert", method: "GET", group: "Rates", params: [{ name: "from", type: "string", required: true }, { name: "to", type: "string", required: true }, { name: "amount", type: "number", required: true }], response: '{ "result": 92.13, "rate": 0.9213 }' }] },
  { id: "translate-01", name: "PolyTranslate", provider: "Lingua Works", version: "3.2.0", status: "operational",
    description: "Neural machine translation across 90 languages with glossary support.",
    price: 0.004, latency: 240, uptime: 99.9, rating: 4.5, tags: ["translation", "nlp", "language"], category: "AI & ML",
    calls: 604800, features: ["Custom glossaries", "Language detection"], useCases: ["Support localisation", "Content publishing"],
    endpoints: [{ id: "translate-text", title: "Translate Text", url: "/v1/translate", method: "POST", group: "Translation", params: [{ name: "text", type: "string", required: true }, { name: "target", type: "string", required: true }, { name: "source", type: "string", required: false }], response: '{ "translated": "Bonjour le monde", "detected": "en" }' }, { id: "detect-language", title: "Detect Language", url: "/v1/detect", method: "POST", group: "Translation", params: [{ name: "text", type: "string", required: true }], response: '{ "language": "es", "confidence": 0.99 }' }] },
  { id: "ocr-01", name: "DocScan OCR", provider: "Pixelforge", version: "1.4.2", status: "degraded",
    description: "Extract text and tables from images, receipts and PDF documents.",
    price: 0.012, latency: 620, uptime: 99.2, rating: 4.2, tags: ["ocr", "documents", "vision"], category: "AI & ML",
    calls: 215480, features: ["Table extraction", "Receipt parsing"], useCases: ["Expense automation", "KYC document intake"],
    endpoints: [{ id: "extract-text", title: "Extract Text", url: "/v1/ocr", method: "POST", group: "Documents", params: [{ name: "file_url", type: "string", required: true }, { name: "language", type: "string", required: false }], response: '{ "text": "INVOICE #4821 ...", "pages": 1 }' }, { id: "parse-receipt", title: "Parse Receipt", url: "/v1/receipts", method: "POST", group: "Documents", params: [{ name: "file_url", type: "string", required: true }], response: '{ "merchant": "Blue Bottle", "total": 12.4, "currency": "USD" }' }] },
  { id: "email-verify-01", name: "MailCheck", provider: "Comms Inc.", version: "1.2.5", status: "operational",
    description: "Validate email addresses, detect disposable domains and catch typos before sending.",
    price: 0.0008, latency: 130, uptime: 99.95, rating: 4.4, tags: ["email", "validation", "spam"], category: "Communication",
    calls: 845020, features: ["Disposable-domain detection", "Syntax and MX checks"], useCases: ["Sign-up forms", "List cleaning"],
    endpoints: [{ id: "verify-email", title: "Verify Email", url: "/v1/verify", method: "GET", group: "Validation", params: [{ name: "email", type: "string", required: true }], response: '{ "deliverable": true, "disposable": false, "suggestion": null }' }] },
  { id: "stock-01", name: "MarketTicker", provider: "Ledgerline", version: "2.0.1", status: "operational",
    description: "Streaming quotes, OHLC candles and fundamentals for global equities and ETFs.",
    price: 0.003, latency: 110, uptime: 99.93, rating: 4.6, tags: ["stocks", "quotes", "finance"], category: "Finance",
    calls: 733910, features: ["Intraday candles", "Fundamentals"], useCases: ["Trading dashboards", "Research tools"],
    endpoints: [{ id: "get-quote", title: "Get Quote", url: "/v1/quote", method: "GET", group: "Market Data", params: [{ name: "symbol", type: "string", required: true }], response: '{ "symbol": "AAPL", "price": 227.48, "change": 1.12 }' }, { id: "ohlc-candles", title: "OHLC Candles", url: "/v1/candles", method: "GET", group: "Market Data", params: [{ name: "symbol", type: "string", required: true }, { name: "interval", type: "string", required: true }], response: '{ "candles": [[1730000000, 226.1, 228.0, 225.7, 227.5]] }' }] },
  { id: "sentiment-01", name: "SentimentScope", provider: "Lingua Works", version: "1.1.0", status: "maintenance",
    description: "Score the sentiment and emotion of reviews, tweets and support tickets.",
    price: 0.0025, latency: 180, uptime: 99.5, rating: 4.0, tags: ["sentiment", "nlp", "text"], category: "AI & ML",
    calls: 128760, features: ["Emotion tagging", "Aspect-level scores"], useCases: ["Brand monitoring", "Ticket triage"],
    endpoints: [{ id: "score-sentiment", title: "Score Sentiment", url: "/v1/sentiment", method: "POST", group: "Analysis", params: [{ name: "text", type: "string", required: true }], response: '{ "score": 0.82, "label": "positive" }' }] },
  { id: "qr-01", name: "QRForge", provider: "Acme Labs", version: "1.0.7", status: "operational",
    description: "Generate styled QR codes and barcodes as SVG or PNG with custom logos.",
    price: 0.0004, latency: 60, uptime: 99.97, rating: 4.3, tags: ["qr", "barcode", "images"], category: "Utilities",
    calls: 402150, features: ["SVG and PNG output", "Logo embedding"], useCases: ["Ticketing", "Payments"],
    endpoints: [{ id: "generate-qr-code", title: "Generate QR Code", url: "/v1/qr", method: "POST", group: "Codes", params: [{ name: "data", type: "string", required: true }, { name: "format", type: "string", required: false }, { name: "size", type: "number", required: false }], response: '{ "url": "https://cdn.qrforge.dev/q/8f2a.svg" }' }] },
  { id: "ip-intel-01", name: "IPIntel", provider: "Sentinel Labs", version: "2.5.3", status: "operational",
    description: "IP geolocation, VPN and proxy detection with risk scoring for fraud prevention.",
    price: 0.001, latency: 85, uptime: 99.96, rating: 4.6, tags: ["ip", "fraud", "security"], category: "Security",
    calls: 1104500, features: ["VPN and proxy flags", "ASN lookup"], useCases: ["Fraud screening", "Geo-gating"],
    endpoints: [{ id: "lookup-ip", title: "Lookup IP", url: "/v1/ip/{ip}", method: "GET", group: "Intelligence", params: [{ name: "ip", type: "string", required: true }], response: '{ "country": "DE", "asn": 3320, "vpn": false, "risk": 12 }' }] },
  { id: "pdf-01", name: "PDFBuilder", provider: "Pixelforge", version: "1.6.0", status: "operational",
    description: "Render HTML or Markdown to print-ready PDFs with headers, footers and fonts.",
    price: 0.006, latency: 410, uptime: 99.85, rating: 4.1, tags: ["pdf", "documents", "rendering"], category: "Utilities",
    calls: 188340, features: ["HTML to PDF", "Custom page templates"], useCases: ["Invoices", "Reports"],
    endpoints: [{ id: "render-pdf", title: "Render PDF", url: "/v1/render", method: "POST", group: "Rendering", params: [{ name: "html", type: "string", required: true }, { name: "page_size", type: "string", required: false }], response: '{ "pdf_url": "https://files.pdfbuilder.dev/r/91c.pdf", "pages": 3 }' }] },
];

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
    sparklineValues: [15, 17, 16, 19, 21, 20, 24, 25, 23, 26, 28, 27],
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
    sparklineValues: [30, 28, 35, 32, 40, 38, 45, 42, 50, 48, 55, 52],
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
    sparklineValues: [8, 10, 9, 12, 14, 13, 16, 17, 15, 18, 20, 19],
  },
  ...SAMPLE_APIS.map((x, i) => {
    const health = (n: number) =>
      Array.from({ length: 24 }, (_, h) =>
        x.status === "degraded" && h >= 14 && h < 17 ? "degraded" : x.status === "maintenance" && h >= 20 && h < 22 ? "down" : h === n ? "degraded" : "operational",
      ) as ("operational" | "degraded" | "down")[];
    return {
      id: x.id,
      name: x.name,
      provider: { name: x.provider, url: "#" },
      version: x.version,
      status: x.status,
      description: x.description,
      pricePerRequest: x.price,
      pricePerCall: x.price,
      avgLatencyMs: x.latency,
      uptimePercent: x.uptime,
      rating: x.rating,
      tags: x.tags,
      category: x.category,
      createdAt: new Date(Date.UTC(2026, 8, 30 - i * 4)).toISOString(),
      usageCount: x.calls,
      features: x.features,
      useCases: x.useCases,
      endpoints: x.endpoints,
      stats: { totalCalls: x.calls, avgResponseMs: x.latency, uptimePct: x.uptime },
      hourlyHealth: health(-1),
      sparklineValues: [10 + i, 12 + i, 11 + i, 14 + i, 16 + i, 15 + i, 18 + i, 19 + i, 17 + i, 21 + i, 22 + i, 24 + i],
      sla: x.sla,
    } satisfies APIItem;
  }),
];

export function findApiById(id: string | undefined) {
  if (!id) return undefined;
  let decoded: string;
  try {
    decoded = decodeURIComponent(id);
  } catch {
    return undefined;
  }
  return MOCK_APIS.find((a) => a.id === id || a.id === decoded);
}

export default MOCK_APIS;
