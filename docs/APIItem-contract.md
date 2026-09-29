# APIItem Contract

This document defines the canonical shape of `APIItem` and its nested types, as implemented in [`../src/data/mockApis.ts`](../src/data/mockApis.ts). It exists to align the Callora Frontend with the upcoming Callora Backend catalogue and resolve duplicate field ambiguity before the backend lands.

## Summary

`APJItem` describes a single API listed in the catalogue. Several fields have duplicates that different components read differently. This contract marks the canonical field for each duplicate and lists the components that still read the deprecated ones.

## Canonical vs deprecated fields

| Concept | Canonical field | Deprecated field | Components reading the deprecated field |
| --- | --- | --- | --- |
| Price per request | `pricePerRequest` | `pricePerCall` | `src/components/CompareDrawer.tsx`, `src/components/ApiCard.ts` |
| Average response time | `stats.avgResponseMs` | `avgLatencyMs` | `src/components/CompareDrawer.tsx`, `src/components/ApiCard.ts` |
| Uptime percentage | `stats.uptimePct` | `uptimePercent` | `src/components/CompareDrawer.tsx`, `src/components/ApiCard.ts` |
| Endpoints | `Endpoint[]` | `Array<any>` replaced by `Endpoint[]` | n/a |

## APIItem fields (every field documented)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `string` | yes | Stable unique identifier. |
| `name` | `string` | yes | Display name. |
| `provider` | `{ url?: string; avatar?: string; name: string }` | yes | Provider metadata. |
| `version` | string | no | Semantic version. |
| `status` | `"operational" | "degraded" | "maintenance"` | no | Current operational status. |
| `description` | string | yes | Human-readable description. |
| `pricePerRequest` | number | yes | CANONICAL price per request in USD. |
| `pricePerCall` | number | no | DEPRECATED. Use `pricePerRequest`. |
| `avgLatencyMs` | number | no | DEPRECATED. Use `stats.avgResponseMs`. |
| `uptimePercent` | number | no | DEPRECATED. Use `stats.uptimePct`. |
| `rating` | number | no | Aggregate rating (1-5). |
| `tags` | string[] | no | Search/taxonomy tags. |
| `category` | string | no | Primary category label. |
| `createdAt` | string | no | ISO date added to the catalogue. |
| `usageCount` | number | no | Total calls across consumers. |
| `features` | string[] | no | Notable features. |
| `useCases` | string[] | no | Typical use cases. |
| `endpoints` | `Endpoint[]` | no | Typed endpoint list (replaces `Array<any>`). |
| `stats` | `APIStats` | no | Canonical statistics block. |
| `ratingDistribution` | `Record<number, number>` | no | Star rating -> count. |
| `hourlyHealth` | `("operational" | "degraded" | "down")[]` | no | 24-hour health timeline. |
| `reviews` | `Review[]` | no | Customer reviews. |
| `sparklineValues` | number[] | no | Sparkline values for trend charts. |

## Endpoint type

The following types replace the old `Array<any>` endpoints shape:

```ts
export type EndpointParam = {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  required: boolean;
};

export type EndpointMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type Endpoint = {
  id: string;
  title: string;
  url: string;
  method: EndpointMethod;
  group?: string;
  params?: EndpointParam[];
  response?: string;
};
```

## APIStats type

```ts
export type APIStats = {
  totalCalls?: number;
  avgResponseMs?: number;
  uptimePct?: number;
};
```

## Migration guidance

- New code must read the canonical fields only: `pricePerRequest`, `stats.avgResponseMs`, `stats.uptimePct`, and `Endpoint[]`.
- Existing components that still read `pricePerCall`, `avgLatencyMs`, or `uptimePercent` should be migrated in a follow-up; the deprecated fields remain optional for backward compatibility and are marked in the type with `@deprecated` JSDoc tags.
- When the backend catalogue lands, it should emit the canonical fields and may omit the deprecated duplicates.
- The `Endpoint` type is the shared contract to be communicated to Callora-Backend maintainers.
