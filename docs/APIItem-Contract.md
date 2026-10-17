# APIItem Contract

This document defines the canonical shape of the catalogue entity consumed by the Callora frontend. It exists to resolve ambiguity in `src/data/mockApis.ts`, where duplicate fields have drifted apart and components disagree on which value is authoritative.

The goal is that when the Callora-Backend catalogue API lands, there is a single written contract to align against.

## Terminology

- "APIItem" — the canonical entity type for a catalogue entry. Exported from `src/data/mockApis.ts`.
- "Endpoint" — the typed representation of a single HTTP endpoint on an API. Replaces the previous `Array<any>`.
- "canonical" — the field that components and backend must read and write. Any duplicate is deprecated.
- "deprecated" — a legacy field kept only for backward compatibility. It must not be written by new code and is scheduled for removal.

## Canonical `APIItem` shape

```ts
interface EndpointParam {
  /** Parameter name as it appears in the request (query, path, or body). */
  name: string;
  /** Primitive type of the parameter value. */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  /** Whether the parameter must be supplied by the client. */
  required: boolean;
}

interface Endpoint {
  /** Stable identifier unique within an API's endpoint list. */
  id: string;
  /** Human-readable title for the endpoint. */
  title: string;
  /** Relative path of the endpoint, e.g. '/v1/forecast'. */
  url: string;
  /** HTTP method used to invoke the endpoint. */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Optional logical grouping (resource area) for UI display. */
  group?: string;
  /** Request parameters accepted by the endpoint. */
  params?: EndpointParam[];
  /** Example JSON response body (serialized string). */
  response?: string;
}

interface APIStats {
  /** Total number of calls recorded for this API. */
  totalCalls?: number;
  /** Average response latency in milliseconds. Canonical source for latency. */
  avgResponseMs?: number;
  /** Uptime percentage (0–100). Canonical source for uptime. */
  uptimePct?: number;
}

interface APIItem {
  /** Stable unique identifier for the API. */
  id: string;
  /** Display name of the API. */
  name: string;
  /** Provider metadata (name required; url and avatar optional). */
  provider: { name: string; url?: string; avatar?: string };
  /** Semantic version of the API (optional). */
  version?: string;
  /** Current operational status. */
  status?: 'operational' | 'degraded' | 'maintenance';
  /** Human-readable description of the API. */
  description: string;
  /** CANONICAL: price charged per request (in the catalogue's currency). */
  pricePerRequest: number;
  /** DEPRECATED: duplicate of `pricePerRequest`. */
  pricePerCall?: number;
  /** DEPRECATED: duplicate of `stats.avgResponseMs`. */
  avgLatencyMs?: number;
  /** DEPRECATED: duplicate of `stats.uptimePct`. */
  uptimePercent?: number;
  /** Average user rating (1–5). */
  rating?: number;
  /** Search/filter tags. */
  tags?: string[];
  /** Category label for grouping. */
  category?: string;
  /** ISO date string when the API was added to the catalogue. */
  createdAt?: string;
  /** Aggregate usage count across all consumers. */
  usageCount?: number;
  /** Marketing feature bullets. */
  features?: string[];
  /** Suggested use cases. */
  useCases?: string[];
  /** Typed endpoint descriptors (replaces Array<any>). */
  endpoints?: Endpoint[];
  /** Canonical aggregate stats. */
  stats?: APIStats;
  /** Map of star rating (1-5) to count of reviews. */
  ratingDistribution?: Record<number, number>;
  /** Per-hour health buckets (24 entries, oldest → newest). */
  hourlyHealth?: ('operational' | 'degraded' | 'down')[];
  /** User reviews. */
  reviews?: Review[];
  /** Sparkline sample values for trend charts. */
  sparklineValues?: number[];
}
```

## Field documentation

| Field | Type | Required | Description | Status |
| --- | --- | --- | --- | --- |
| `id` | `string` | yes | Stable unique identifier for the API. Must be unique across the catalogue. | canonical |
| `name` | `string` | yes | Display name of the API. | canonical |
| `provider` | `{ name; url?; avatar? }` | yes | Provider metadata. | canonical |
| `version` | `string` | no | Semantic version of the API. | canonical |
| `status` | `'operational' | 'degraded' | 'maintenance'` | no | Current operational status. | canonical |
| `description` | `string` | yes | Human-readable description. | canonical |
| `pricePerRequest` | `number` | yes | Price charged per request. | canonical |
| `pricePerCall` | `number` | no | Duplicate of `pricePerRequest`. | deprecated |
| `avgLatencyMs` | `number` | no | Duplicate of `stats.avgResponseMs`. | deprecated |
| `uptimePercent` | `number` | no | Duplicate of `stats.uptimePct`. | deprecated |
| `rating` | `number` | no | Average user rating (1–5). | canonical |
| `tags` | `string[]` | no | Search/filter tags. | canonical |
| `category` | `string` | no | Category label for grouping. | canonical |
| `createdAt` | `string` | no | ISO date string when the API was added. | canonical |
| `usageCount` | `number` | no | Aggregate usage count. | canonical |
| `features` | `string[]` | no | Marketing feature bullets. | canonical |
| `useCases` | `string[]` | no | Suggested use cases. | canonical |
| `endpoints` | `Endpoint[]` | no | Typed endpoint descriptors (replaces Array<any>). | canonical |
| `stats` | `APIStats` | no | Canonical aggregate stats. | canonical |
| `ratingDistribution` | `Record<number, number>$ | no | Star rating to count map. | canonical |
| `hourlyHealth` | `('operational' | 'degraded' | 'down')[]` | no | 24 per-hour health buckets. | canonical |
| `reviews` | `Review[]` | no | User reviews. | canonical |
| `sparklineValues` | `number[]` | no | Sparkline sample values. | canonical |

## Duplicate fields and canonical choices

Each duplicate below has a single authoritative field. The deprecated field is retained only until consumers are migrated and must not be written by new code.

| Duplicate group | Canonical field | Deprecated field | Notes |
| --- | --- | --- | --- |
| Price per call | `pricePerRequest` | `pricePerCall` (optional) | Same unit and currency as `pricePerRequest`. |
| Average latency | `stats.avgResponseMs` | `avgLatencyMs` (optional) | Same unit (ms). |
| Uptime | `stats.uptimePct` | `uptimePercent` (optional) | Same unit (percentage 0-100). |

When both fields are present and disagree, the canonical field wins. The deprecated field is ignored by new code.

## Components affected by each deprecated field

### Deprecated: `pricePerCall`

- `src/components/CompareDrawer.tsx` — must read `pricePerRequest` instead of `pricePerCall`.
- `src/components/ApiCard.tsx` — must read `pricePerRequest` instead of `pricePerCall`.

### Deprecated: `avgLatencyMs`

- `src/components/CompareDrawer.tsx` — must read `stats.avgResponseMs` instead of `avgLatencyMs`.
- `src/components/ApiCard.tsx` — must read `stats.avgResponseMs` instead of `avgLatencyMs`.

### Deprecated: `uptimePercent`

- `src/components/CompareDrawer.tsx` — must read `stats.uptimePct` instead of `uptimePercent`.
- `src/components/ApiCard.tsx` — must read `stats.uptimePct` instead of `uptimePercent`.

## Deprecated: `endpoints: Array<any>`

The previous `endpoints` field was typed as `Array<any>`. It is replaced by `Endpoint[]`. Any consumer that indexed into endpoints without a type must be updated to the `Endpoint` shape.

- `src/components/CompareDrawer.tsx` — if it renders endpoints, it must use `Endpoint[]`.
- `src/components/ApiCard.tsx` — if it renders endpoints, it must use `Endpoint[]`.

## Invariants

- `APIItem.id` is unique across the catalogue.
- `pricePerRequest` and `stats.avgResponseMs` are non-negative.
- `stats.uptimePct` is between 0 and 100 inclusive.
- `rating`, when present, is between 0 and 5 inclusive.
- Every entry in `endpoints` conforms to `Endpoint`.
- Deprecated fields are never written by new code.

## Backend alignment notes for Callora-Backend

- The catalogue API should return fields matching the canonical names above.
- Duplicate fields (`pricePerCall`, `avgLatencyMs`, `uptimePercent`) must not be emitted in new responses.
- Endpoints should be returned as an array of objects with `id`, `title`, `url`, and `method`, optionally including `group`, `params`, and `response`.
- Units are fixed: latency in milliseconds, uptime in percentage (0-100), price in the catalogue's currency.

## Migration steps

1. Update `src/data/mockApis.ts` to export the `APIItem` and `Endpoint` types and to use only canonical fields in the mock data.
2. Update `src/components/CompareDrawer.tsx` and `src/components/ApiCard.tsx` to read only the canonical fields listed above.
3. Remove reads of deprecated fields from components before removing the fields from the type.
4. Confirm the build passes with `npm run build`.

## Validation

- `npm run build` must pass after the types and components are aligned.
- TypeScript must reject access to deprecated fields once they are removed from the interface.
