# RequestBodyEditor — Inline Schema Validation

## Overview

The `RequestBodyEditor` component replaces the plain textarea in `ApiUsage` with a controlled JSON editor that validates its content against an API schema in real time.  Feedback is shown inline, immediately beneath the textarea — no submit required.

---

## Files changed

| File | Change |
|---|---|
| `src/utils/schema-validate.ts` | **New** — pure, zero-dependency JSON Schema validator (Draft-07 subset) |
| `src/utils/schema-validate.test.ts` | **New** — focused unit tests for the validator (60+ cases) |
| `src/components/RequestBodyEditor.tsx` | **New** — controlled textarea with inline validation UI |
| `src/ApiUsage.tsx` | **Updated** — imports `RequestBodyEditor`; `ApiEndpoint` type gains `requestBodySchema?`; mock endpoints include schemas; syntax-error guard on Make Test Call |

---

## `validateAgainstSchema` API

```ts
import { validateAgainstSchema } from './utils/schema-validate';
import type { JsonSchema, ValidationResult } from './utils/schema-validate';

const schema: JsonSchema = {
  type: 'object',
  required: ['amount', 'currency'],
  properties: {
    amount:   { type: 'number', minimum: 0.01 },
    currency: { type: 'string', enum: ['USD', 'EUR', 'USDC'] },
  },
};

const { valid, errors } = validateAgainstSchema(JSON.parse(rawBody), schema);
// valid  → boolean
// errors → string[] — human-readable, dot-notation paths e.g. "$.amount: must be >= 0.01"
```

### Supported constraints

| Keyword | Applies to |
|---|---|
| `type` | all (string, number, integer, boolean, array, object, null, union array) |
| `required` | object |
| `properties` | object |
| `items` | array |
| `enum` | all |
| `minimum` / `maximum` | number / integer |
| `exclusiveMinimum` / `exclusiveMaximum` (Draft-07 numeric) | number / integer |
| `minLength` / `maxLength` | string |
| `pattern` (ECMAScript regex) | string |
| `minItems` / `maxItems` | array |
| `nullable` (OpenAPI 3.x extension) | all |

### Security

- `pattern` values from schemas are wrapped in `try/catch` to prevent ReDoS or invalid-regex crashes.
- The validator is a pure function with no side effects and no external I/O.

---

## `RequestBodyEditor` props

```ts
type RequestBodyEditorProps = {
  value:       string;              // controlled textarea value
  onChange:    (v: string) => void; // called on every keystroke
  schema?:     JsonSchema;          // optional schema; syntax-only when absent
  id?:         string;              // forwarded to <textarea>
  placeholder?: string;
  rows?:       number;              // defaults to 6
  disabled?:   boolean;
  label?:      string;              // visible + ARIA label; defaults to "Request Body (JSON)"
};
```

### Validation states

| State | Trigger | UI |
|---|---|---|
| `idle` | empty / `{}` | schema hint shown if schema present |
| `ok` | valid JSON + passes schema | green ✓ banner |
| `syntax` | `JSON.parse` throws | red ✗ + error message |
| `invalid` | schema constraints fail | red ✗ list of all failing rules |

### Accessibility (WCAG 2.1 AA)

- `<label>` element tied to textarea via `htmlFor` / `id`.
- `aria-describedby` links textarea to the status region.
- `aria-invalid="true"` set on the textarea when there are errors.
- Status container uses `role="status"` and `aria-live="polite"` so screen readers announce changes without interrupting the user.
- All icon SVGs carry `aria-hidden="true"`.
- Focus ring uses the repo's `--focus-ring` CSS token.

### Dark / light mode

All colours come from CSS custom properties defined in `index.css`:
- Success: `var(--success)`
- Error: `var(--danger)`
- Border: `var(--line)` → `var(--accent)` on focus → `var(--success)` / `var(--danger)` per state.

No hardcoded colour values are used.

---

## Endpoint schema integration

Each `ApiEndpoint` in `ApiUsage.tsx` can now carry a `requestBodySchema` field:

```ts
type ApiEndpoint = {
  // …existing fields…
  requestBodySchema?: JsonSchema;
};
```

When an endpoint schema is present, it is passed directly to `RequestBodyEditor`.  When absent (e.g. GET endpoints that have no body), only JSON syntax checking is active.

### Current mock schemas

| Endpoint | Required fields | Constraints |
|---|---|---|
| POST `/api/v1/transactions` | `amount`, `currency` | amount ≥ 0.01; currency in `[USD, EUR, GBP, USDC]`; recipient 1–100 chars; note ≤ 255 chars |
| PUT `/api/v1/user/balance` | `balance` | balance ≥ 0; reason ≤ 200 chars |
| GET `/api/v1/user/profile` | — | No body; schema omitted |

---

## Make Test Call guard

`handleMakeTestCall` now parses the textarea value before initiating the simulated call.  If the JSON is malformed, it returns early — the textarea already displays the syntax error inline, so no separate toast or alert is needed.  Schema constraint violations are treated as warnings: the call is still allowed to proceed (useful for testing error handling on the API side).

---

## Running tests

```bash
npm test
# or for a single run:
npm test -- --run
```

Tests live in `src/utils/schema-validate.test.ts` and cover:
- Return shape contract
- Every type keyword
- null / nullable
- enum (primitives, objects, deep equality)
- All string constraints (minLength, maxLength, pattern, invalid regex)
- All number constraints (minimum, maximum, exclusiveMinimum/Maximum)
- All array constraints (minItems, maxItems, items recursion with path)
- Object required + properties recursion with path
- Nested schema paths
- Real-world transaction schema end-to-end
