import type { WebhookDelivery } from "../../hooks/useWebhookDeliveries";

export const DEMO_WEBHOOK_DELIVERIES: WebhookDelivery[] = [
  {
    id: "dlv_1",
    url: "https://hooks.acme-labs.dev/callora/events",
    status: "delivered",
    attempts: 1,
    lastAttemptAt: "2026-07-28T12:00:00Z",
    createdAt: "2026-07-28T12:00:00Z",
    requestBody: { event: "payment.succeeded", amount: 100 },
    responseStatus: 200,
    responseBody: { ok: true },
  },
  {
    id: "dlv_2",
    url: "https://hooks.acme-labs.dev/callora/events",
    status: "failed",
    attempts: 3,
    lastAttemptAt: "2026-07-28T12:30:00Z",
    createdAt: "2026-07-28T12:30:00Z",
    requestBody: { event: "payment.failed", amount: 50 },
    responseStatus: 500,
    responseBody: { error: "Internal Server Error" },
  },
  {
    id: "dlv_3",
    url: "https://hooks.acme-labs.dev/callora/events",
    status: "pending",
    attempts: 0,
    lastAttemptAt: "2026-07-28T13:00:00Z",
    createdAt: "2026-07-28T13:00:00Z",
    requestBody: { event: "invoice.created", invoiceId: "INV-2026-042" },
  },
];
