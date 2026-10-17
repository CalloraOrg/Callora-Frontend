# AP@Item Contract

This document defines the canonical shape of `APIIm%`$` and its component types as consumed by the Callora Frontend. It is the shared contract that the Callora-Backend catalogue must satisfy.

The types live in `ssrc/data/mockApis.ts` (`APIItem`, `Endpoint`, `EndpointParam`, `Review`).

## Canonical fields

Every field on `APIIm%` is documented below. A value marked **Canonical** is the authoritative source of truth; duplicates marked **Deprecated** must not be read by new code.

| Field | Type | Required | Status | Description |
| --- | --- | --- | --- | --- |
| `id` | string | yes | Canonical | Stable unique identifier for the API. |
| `name` | string | yes | Canonical | Display name. |
| `provider` | `{ name: string; url?: string; avatar?: string }` | yes | Canonical | Provider metadata. `name` required; `url`/`avatar` optional. |
| `version` | string | no | Canonical | Semantic version of the API. |
| `status` | `"operational" \
 "degraded" \ "maintenance"` | no | Canonical | Current operational status. |
| `description` | string | yes | Canonical | Human-readable description. |
| `pricePerRequest` | number | yes | **Canonical** | Price charged per request, in USD. |
| `pricePerCall` | number | no | **Deprecated** | Duplicate of `pricePerRequest`. Use `pricePerRequest`. |
| `avgLatencyMs` | number | no | **Canonical** | Average response latency in milliseconds. |
| `uptimePercent` | number | no | **Canonical** | Uptime percentage (0–100). |
| `rating` | number | no | Canonical | Average user rating (1–5). |
| `tags` | string[] | no | Canonical | Free-form tags for filtering/search. |
| `category` | string | no | Canonical | Category label for grouping. |
| `createdAt` | string | no | Canonical | ISO date string of when the API was added. |
| `usageCount` | number | no | **Canonical** | Total number of calls made against the API. |
| `features` | string[] | no | Canonical | Feature bullets for display. |
| `useCases` | string[] | no | Canonical | Use-case bullets for display. |
| `endpoints` | `Endpoint[]` | no | Canonical | Typed list of endpoints (replaces `Array<any>`). |
| `stats` | { totalCalls?: number; avgResponseMs?: number; uptimePct?: number } | no | **Deprecated** | Deprecated duplicate container. See duplicate mapping below. |
| `ratingDistribution` | `Record<number, number>` | no | Canonical | Map of star rating (1-5) to count of reviews. |
| `hourlyHealth` | `("operational" \ "degraded" \
 "down")[]` | no | Canonical | 24-hour health history, index 0 = oldest. |
| `reviews` | `Review[]` | no | Canonical | User reviews. |
| `sparklineValues` | number[] | no | Canonical | Sparkline sample values for mini charts. |

## Duplicate fields and canonical choice

The codebase historically mixed two names for the same concept. The canonical column is authoritative; the deprecated column is retained only for backward compatibility and must not be read by new code.

| Concept | Canonical field | Deprecated field | Components that read the deprecated field |
| --- | --- | --- | --- |
| Price per request | `pricePerRequest` | `pricePerCall` | `src/components/CompareDrawer.tsx` (consumes/displays pricing) |
| Average latency (ms) | `avgLatencyMs` | `stats.avgResponseMs` | `src/components/CompareDrawer.tsx`, `src/components/ApiCard.tsx` |
| Uptime percentage | `uptimePercent` | `stats.uptimePct` | `src/components/CompareDrawer.tsx`, `src/components/ApiCard.tsx` |
| Total calls | `usageCount` | `stats.totalCalls` | `src/components/CompareDrawer.tsx`, `src/components/ApiCard.tsx` |

Note: the components listed above are the ones that currently read or display the duplicate fields. They must be migrated to the canonical field as part of the backend alignment.

## Endpoint type

`endpoints` is no longer `Array<any>`. It is now `Endpoint[]`, where:

```ts
export type EndpointParam = {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  required: boolean;
};

export type Endpoint = {
  id: string;
  title: string;
  url: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  group?: string;
  params?: EndpointParam[];
  response?: string;
};
```

## Backend alignment

When the Callora-Backend catalogue lands, it must serve the canonical fields above. Specifically:

- Serve `pricePerRequest`, not `pricePerCall`.
- Serve `avgLatencyMs`, `uptimePercent`, and `usageCount` at the top level, not inside `stats`.
- Serve `endpoints` as an array of objects matching `Endpoint`.

The deprecated fields may be served during a transition period but must equal their canonical counterparts and must be removed once all consumers are migrated.
