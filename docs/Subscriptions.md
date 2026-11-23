# Subscriptions

The subscriptions page uses the authenticated subscription endpoints:

- `GET /api/subscriptions` returns `{ "subscriptions": [...] }` (an array is also accepted). Each item includes `id`, `apiName`, `planId` (`free`, `pro`, or `enterprise`), `status` (`active`, `cancelling`, or `ended`), `renewalDate` (ISO date or `null`), `monthlyRequests`, and `pricePerRequest`.
- `PATCH /api/subscriptions/:id` accepts `{ "planId": "free" | "pro" }` and returns the updated subscription. Enterprise changes are handled by support.
- `POST /api/subscriptions/:id/cancel` schedules cancellation and returns the updated subscription, normally with `status: "cancelling"` and the period end in `renewalDate`.

Plan changes update the displayed row optimistically and restore its previous value if the request fails. A cancellation keeps access through the current billing period; the returned period end is shown as the access end date. Ended subscriptions remain visible as history and cannot be changed or cancelled again.
