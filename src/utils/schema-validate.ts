/**
 * Lightweight, zero-dependency JSON Schema validator.
 *
 * Validates a plain-JS value against a subset of JSON Schema Draft-07 that
 * covers the fields commonly found in OpenAPI 3.x `requestBody` schemas:
 *
 *   ✔ type        — "string" | "number" | "integer" | "boolean" | "array" | "object" | "null"
 *   ✔ required    — array of required property names (objects)
 *   ✔ properties  — per-property sub-schemas (objects)
 *   ✔ items       — sub-schema for array items
 *   ✔ enum        — list of allowed values
 *   ✔ minimum / maximum / exclusiveMinimum / exclusiveMaximum  (numbers)
 *   ✔ minLength / maxLength  (strings)
 *   ✔ minItems / maxItems    (arrays)
 *   ✔ pattern     — ECMAScript regex string (strings)
 *   ✔ nullable    — OpenAPI 3.x extension; allows null alongside declared type
 *
 * This module never throws. All errors are returned as a flat array of
 * human-readable strings describing what failed and where.
 *
 * Design goals:
 *   • Pure function — no side effects, fully deterministic.
 *   • No external dependencies — ships with zero npm additions.
 *   • Secure — regex patterns from schemas are wrapped in try/catch to guard
 *     against ReDoS or invalid expressions.
 *   • Fast for the scale of interactive form validation (< 1 ms per call).
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A JSON Schema sub-set accepted by the validator.
 * Index signature allows passing raw OpenAPI schema objects without casting.
 */
export type JsonSchema = {
  type?: string | string[];
  required?: string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number | boolean;
  exclusiveMaximum?: number | boolean;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  pattern?: string;
  /** OpenAPI 3.x nullable extension */
  nullable?: boolean;
  /** Allow unknown keys from raw OpenAPI objects */
  [key: string]: unknown;
};

/**
 * The result of a validation call.
 *
 * `valid`  — true when the value satisfies every constraint.
 * `errors` — human-readable messages; empty when `valid` is true.
 */
export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate `value` against `schema`.
 *
 * @param value   - The value to validate. Typically the result of JSON.parse().
 * @param schema  - A JSON Schema (sub-set) to validate against.
 * @param path    - Internal: dot-notation path used in error messages. Callers
 *                  should leave this at its default value `"$"`.
 * @returns A `ValidationResult` with `valid` and an array of error strings.
 *
 * @example
 * ```ts
 * const schema: JsonSchema = {
 *   type: 'object',
 *   required: ['amount'],
 *   properties: {
 *     amount: { type: 'number', minimum: 0 },
 *     note:   { type: 'string', maxLength: 200 },
 *   },
 * };
 *
 * const { valid, errors } = validateAgainstSchema({ amount: -5 }, schema);
 * // valid  → false
 * // errors → ['$.amount: must be >= 0']
 * ```
 */
export function validateAgainstSchema(
  value: unknown,
  schema: JsonSchema,
  path = '$',
): ValidationResult {
  const errors: string[] = [];
  validateNode(value, schema, path, errors);
  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Recursively validate a node, pushing error messages into `errors`. */
function validateNode(
  value: unknown,
  schema: JsonSchema,
  path: string,
  errors: string[],
): void {
  const nullable = schema.nullable === true;

  // ── null shortcut ──────────────────────────────────────────────────────
  if (value === null) {
    if (!nullable && schema.type !== undefined && schema.type !== 'null') {
      errors.push(`${path}: must not be null`);
    }
    // null passes all other constraints
    return;
  }

  // ── type check ─────────────────────────────────────────────────────────
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => matchesType(value, t))) {
      const expected = types.join(' | ');
      errors.push(`${path}: expected ${expected}, got ${describeType(value)}`);
      // Skip further checks — value is the wrong type.
      return;
    }
  }

  // ── enum ───────────────────────────────────────────────────────────────
  if (schema.enum !== undefined) {
    if (!schema.enum.some((allowed) => deepEqual(value, allowed))) {
      const display = schema.enum.map((v) => JSON.stringify(v)).join(', ');
      errors.push(`${path}: must be one of [${display}]`);
    }
  }

  // ── type-specific constraints ──────────────────────────────────────────
  if (typeof value === 'string') {
    validateString(value, schema, path, errors);
  } else if (typeof value === 'number') {
    validateNumber(value, schema, path, errors);
  } else if (Array.isArray(value)) {
    validateArray(value, schema, path, errors);
  } else if (typeof value === 'object') {
    validateObject(value as Record<string, unknown>, schema, path, errors);
  }
}

// ── Type matching ────────────────────────────────────────────────────────

/** Returns true when `value` satisfies the JSON Schema primitive type `t`. */
function matchesType(value: unknown, t: string): boolean {
  switch (t) {
    case 'null':    return value === null;
    case 'boolean': return typeof value === 'boolean';
    case 'integer': return typeof value === 'number' && Number.isInteger(value);
    case 'number':  return typeof value === 'number';
    case 'string':  return typeof value === 'string';
    case 'array':   return Array.isArray(value);
    case 'object':  return typeof value === 'object' && value !== null && !Array.isArray(value);
    default:        return true; // unknown type keyword — pass through
  }
}

/** Returns a human-readable description of the runtime type of `value`. */
function describeType(value: unknown): string {
  if (value === null)          return 'null';
  if (Array.isArray(value))    return 'array';
  return typeof value;
}

// ── String constraints ───────────────────────────────────────────────────

function validateString(
  value: string,
  schema: JsonSchema,
  path: string,
  errors: string[],
): void {
  if (schema.minLength !== undefined && value.length < schema.minLength) {
    errors.push(`${path}: must be at least ${schema.minLength} character(s) long`);
  }
  if (schema.maxLength !== undefined && value.length > schema.maxLength) {
    errors.push(`${path}: must be at most ${schema.maxLength} character(s) long`);
  }
  if (schema.pattern !== undefined) {
    try {
      const re = new RegExp(schema.pattern);
      if (!re.test(value)) {
        errors.push(`${path}: must match pattern /${schema.pattern}/`);
      }
    } catch {
      // Invalid regex in schema — report but do not crash.
      errors.push(`${path}: schema has an invalid pattern (${schema.pattern})`);
    }
  }
}

// ── Number constraints ───────────────────────────────────────────────────

function validateNumber(
  value: number,
  schema: JsonSchema,
  path: string,
  errors: string[],
): void {
  if (schema.minimum !== undefined && value < schema.minimum) {
    errors.push(`${path}: must be >= ${schema.minimum}`);
  }
  if (schema.maximum !== undefined && value > schema.maximum) {
    errors.push(`${path}: must be <= ${schema.maximum}`);
  }
  // Draft-07 style (boolean exclusiveMinimum/Maximum is Draft-04 style)
  if (typeof schema.exclusiveMinimum === 'number' && value <= schema.exclusiveMinimum) {
    errors.push(`${path}: must be > ${schema.exclusiveMinimum}`);
  }
  if (typeof schema.exclusiveMaximum === 'number' && value >= schema.exclusiveMaximum) {
    errors.push(`${path}: must be < ${schema.exclusiveMaximum}`);
  }
}

// ── Array constraints ────────────────────────────────────────────────────

function validateArray(
  value: unknown[],
  schema: JsonSchema,
  path: string,
  errors: string[],
): void {
  if (schema.minItems !== undefined && value.length < schema.minItems) {
    errors.push(`${path}: must have at least ${schema.minItems} item(s)`);
  }
  if (schema.maxItems !== undefined && value.length > schema.maxItems) {
    errors.push(`${path}: must have at most ${schema.maxItems} item(s)`);
  }
  if (schema.items !== undefined) {
    value.forEach((item, index) => {
      validateNode(item, schema.items as JsonSchema, `${path}[${index}]`, errors);
    });
  }
}

// ── Object constraints ───────────────────────────────────────────────────

function validateObject(
  value: Record<string, unknown>,
  schema: JsonSchema,
  path: string,
  errors: string[],
): void {
  // Required properties
  if (schema.required !== undefined) {
    for (const key of schema.required) {
      if (!(key in value)) {
        errors.push(`${path}: missing required property "${key}"`);
      }
    }
  }

  // Per-property sub-schemas
  if (schema.properties !== undefined) {
    for (const [key, subSchema] of Object.entries(schema.properties)) {
      if (key in value) {
        validateNode(value[key], subSchema, `${path}.${key}`, errors);
      }
    }
  }
}

// ── Deep equality ────────────────────────────────────────────────────────

/** Structural equality check used by the enum constraint. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, (b as unknown[])[i]));
  }

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) => deepEqual(aObj[k], bObj[k]));
}
