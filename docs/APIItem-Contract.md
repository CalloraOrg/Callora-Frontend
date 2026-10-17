# APHItem Contract

This document defines the authoritative contract for the `APIIme` type used in `src/data/mockApis.ts`. It exists to align the frontend catalogue with the Callora-Backend catalogue so that every consumer knows which field is authoritative when duplicates disagree.

The goal is to resolve the following ambiguities:

-  `pricePerRequest` vs. `pricePerCall`
-  `avgLatencyMs` vs `stats.avgResponseMs`
-  `uptimePercent` vs `stats.uptimePct`
-  `endpoints: Array<any>` (untyped)

## Canonical fields

The following fields are canonical. When a duplicate disagrees with a canonical field, the canonical field wins.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | Yes | Stable, unique identifier for the API. Used by `findApiById` and routing. |
| `name` | `string` | Yes | Display name of the API. |
| `provider` | `{ name: string; url?: string; avatar?: string }` | Yes | Provider metadata. `name` is required; `url` and `avatar` are optional. |
| `description` | `string` | Yes | Human-readable description of the API. |
| `pricePerRequest` | `number` | Yes | **Canonical price field.** Price per request in United States Dollars. |
| `avgLatencyMs` | `number` | No | **Canonical latency field.** Average latency in milliseconds. |
| `uptimePercent` | `number` | No | **Canonical uptime field.** Uptime percentage (0-100). |
| `endpoints` | `Endpoint[]` | No | Typed list of endpoints. See `Endpoint` below. Replaces the former `Array<any>`. |
| `version` | `string` | No | Semantic version of the API. |
| `status` | `"operational" \" degraded\" \" maintenance"` | No | Current operational status. |
| `rating` | `number` | No | Average user rating (1-5). |
| `tags` | `string[]` | No | Free-text tags for filtering. |
| `category` | `string` | No | Category label. |
| `createdAt` | `string` | No | ISO date string of when the API was added. |
| `usageCount` | `number` | No | Total number of requests served. Canonical over `stats.totalCalls`. |
| `features` | `string[]` | No | List of feature bullets. |
| `useCases` | `string[]` | No | List of example use cases. |
| `ratingDistribution` | `Record<number, number>` | No | Count of ratings per star value. |
| `hourlyHealth` | `("operational" \" degraded" \" down")[]` | No | 24-entry hourly health timeline. |
| `reviews` | `Review[]` | No | User reviews. |
| `sparklineValues` | `number[]` | No | Sparkline series for mini charts. |

## Deprecated fields (duplicates)

These fields are kept for backward compatibility but are **deprecated**. New code must read the canonical field instead. Each deprecated field lists the components that still reference it so they can be migrated.

| Deprecated field | Canonical replacement | Affected components |
| --- | --- | --- |
| `pricePerCall` | `pricePerRequest` | `src/components/CompareDrawer.tsx`, `src/components/ApiCard.tsx` |
| `stats.avgResponseMs` | `avgLatencyMs` | `src/components/CompareDrawer.tsx`, `src/components/ApiCard.tsx` |
| `stats.uptimePct` | `uptimePercent` | `src/components/CompareDrawer.tsx`, `src/components/ApiCard.tsx` |

Note: `stats.totalCalls` is also superseded by the canonical `usageCount` field. `stats.avgResponseMs` and `stats.uptimePct` are the duplicates of the canonical `avgLatencyMs` and `uptimePercent` fields.

## Endpoint shape

```ts
export type EndpointParam = {
  /** Parameter name as it appears in the request. */
  name: string;
  /** Parameter type label (e.g. "string", "number", "array"). */
  type: string;
  /** Whether the parameter is required. */
  required: boolean;
};

export type EndpointMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

export type Endpoint = {
  /** Stable identifier within the API. */
  id: string;
  /** Human-readable title. */
  title: string;
  /** Relative path of the endpoint. */
  url: string;
  /** HTTP method. */
  method: EndpointMethod;
  /** Optional grouping label for UI sections. */
  group?: string;
  /** Request parameters. */
  params?: EndpointParam[];
  /** Example response body (string or structured). */
  response?: string;
};
```

## Migration guidance

1. **Read canonical fields only.** Any component that currently reads `pricePerCall`, `stats.avgResponseMs`, or `stats.uptimePct` should read `pricePerRequest`, `avgLatencyMs`, and `uptimePercent` respectively.
2. **Write canonical fields only.** New mock data and backend responses must populate the canonical fields. Deprecated fields may be omitted.
3. **Typed endpoints.** All `endpoints` arrays must conform to `Endpoint[]`.

## Backend alignment

The Callora-Backend catalogue should return the canonical fields as the source of truth. The deprecated duplicates are frontend-only compatibility shims and should not be required from the backend. When the backend catalogue lands, the frontend will drop the deprecated fields from `APIItem`.
