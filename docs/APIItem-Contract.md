# AP@Item Contract

This document defines the canonical shape of `APIIntem` as consumed by the Callora Frontend and the contract the Callora-Backend catalogue must fulfill. It exists to resolve duplicate fields that currently disagree between components and to replace the untyped `endpoints: Array<any>`.

Source of truth: `src/data/mockApis.ts` (`APIItem`, `Endpoint`, `EndpointParam`).

## Canonical vs deprecated fields

Where two fields describe the same concept, the canonical field is authoritative. Deprecated fields are retained only for backward compatibility and must not be written by the backend catalogue.

| Concept | Canonical field | Deprecated field | Components reading the deprecated field |
| --- | --- | --- | --- |
| Price per request | `pricePerRequest` | `pricePerCall` | `src/components/CompareDrawer.tsx` |
| Average latency (ms) | `avgLatencyMs` | `stats.avgResponseMs` | `src/components/ApiCard.tsx` |
| Uptime percentage | `uptimePercent` | `stats.uptimePct` | `src/components/ApiCard.tsx` |

Rules:

1. When both fields are present and disagree, the canonical field wins.
2. New code must read only the canonical field. Deprecated fields exist only until the listed components are migrated.
3. The backend catalogue should not emit deprecated fields. If it must during a transition, it must set them equal to the canonical value.

## `APIItem` field reference

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | yes | Unique identifier for the API. |
| `name` | `string` | yes | Display name of the API. |
| `provider` | `{ name: string; url?: string; avatar?: string }` | yes | Provider metadata. |
| `version` | `string` | no | Semantic version of the API. |
| `status` | `"operational" \\| "degraded" \\| "maintenance"` | no | Current operational status. |
| `description` | `string` | yes | Short description of the API. |
| `pricePerRequest` | `number` | yes | **Canonical** price per request in USD. |
| `pricePerCall` | `number` | no | *Deprecated* — use `pricePerRequest`. Read by `CompareDrawer.tsx`. |
| `avgLatencyMs` | `number` | no | **Canonical** average latency in milliseconds. |
| `uptimePercent` | `number` | no | **Canonical** uptime percentage (0–100). |
| `rating` | `number` | no | Average user rating (1–5). |
| `tags` | `string[]` | no | Search/taxonomy tags. |
| `category` | `string` | no | Category label. |
| `createdAt` | `string` | no | ISO date the API was added to the catalogue. |
| `usageCount` | `number` | no | Total number of requests served. |
| `features` | `string[]` | no | Feature bullet points. |
| `useCases` | `string[]` | no | Suggested use cases. |
| `endpoints` | `Endpoint[]` | no | Typed endpoint list (replaces `Array<any>`). |
| `stats` | `{ totalCalls?: number; avgResponseMs?: number; uptimePct?: number }` | no | Aggregated stats. `avgResponseMs` and `uptimePct` are deprecated. |
| `ratingDistribution` | `Record<number, number>` | no | Map of star rating (1–5) to count. |
| `hourlyHealth` | `("operational" \\| "degraded" \\| "down")[]` | no | 24-hour rolling health status. |
| `reviews` | `Review[]` | no | User reviews. |
| `sparklineValues` | `number[]` | no | Sparkline data points for trend charts. |

## `Endpoint` shape

Replaces the previous `endpoints?: Array<any>`.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | yes | Stable identifier unique within an API. |
| `title` | `string` | yes | Human-readable title for the endpoint. |
| `url` | `string` | yes | Path or absolute URL of the endpoint. |
| `method` | `"GET" \\| "POST" \\| "PUT" \\| "PATCH" \\| "DELETE"”` | yes | HTTP method used to call the endpoint. |
| `group` | `string` | no | Logical grouping used to organize endpoints in the UI. |
| `params` | `EndpointParam[]` | no | Query or body parameters accepted by the endpoint. |
| `response` | `string` | no | Example response payload (JSON string). |

## `EndpointParam` shape

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | `string` | yes | Parameter name as sent on the wire. |
| `type` | `"string" \\| "number" \\| "boolean" \\| "array" \\| "object"` | yes | Primitive type of the parameter value. |
| `required` | `boolean` | yes | Whether the parameter must be supplied. |
| `description` | `string` | no | Optional human-readable description. |

## Backend alignment notes for Callora-Backend

- **Price**: emit `pricePerRequest`. Do not emit `pricePerCall`.
- **Latency**: emit `avgLatencyMs`. Do not emit `stats.avgResponseMs`.
- **Uptime**: emit `uptimePercent`. Do not emit `stats.uptimePct`.
- **Endpoints**: emit an array of `Endpoint` objects matching the shape above. `method` must be one of the allowed HTTP verbs.
- Fields marked optional may be omitted or `null`-free; prefer omission over sending `undefined` in JSON.

## Migration status

The deprecated fields remain in the type only because the components listed above still read them. Once those components are migrated to the canonical fields, the deprecated fields will be removed from `APIItem` in a separate change.
