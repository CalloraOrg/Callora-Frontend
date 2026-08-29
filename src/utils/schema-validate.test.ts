/**
 * Tests for src/utils/schema-validate.ts
 *
 * Coverage goals
 * ──────────────
 * • Happy-path pass for every supported constraint type.
 * • Failure case for every constraint that produces an error message.
 * • Edge cases: null values, nullable flag, empty objects, empty arrays,
 *   unknown type keywords, invalid regex patterns, array items recursion,
 *   object properties recursion, enum deep-equality.
 * • Return shape: { valid, errors } contract.
 */

import { describe, it, expect } from 'vitest';
import { validateAgainstSchema } from './schema-validate';
import type { JsonSchema } from './schema-validate';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Assert the result is valid and has no errors. */
function assertValid(value: unknown, schema: JsonSchema) {
  const result = validateAgainstSchema(value, schema);
  expect(result.valid, `Expected valid but got errors: ${result.errors.join('; ')}`).toBe(true);
  expect(result.errors).toHaveLength(0);
}

/** Assert the result is invalid and that at least one error contains `fragment`. */
function assertInvalid(value: unknown, schema: JsonSchema, fragment?: string) {
  const result = validateAgainstSchema(value, schema);
  expect(result.valid).toBe(false);
  expect(result.errors.length).toBeGreaterThan(0);
  if (fragment !== undefined) {
    expect(result.errors.some((e) => e.includes(fragment))).toBe(true);
  }
}

// ---------------------------------------------------------------------------
// Return shape
// ---------------------------------------------------------------------------

describe('validateAgainstSchema — return shape', () => {
  it('returns { valid: true, errors: [] } for a passing value', () => {
    const result = validateAgainstSchema('hello', { type: 'string' });
    expect(result).toMatchObject({ valid: true, errors: [] });
  });

  it('returns { valid: false, errors: [...] } for a failing value', () => {
    const result = validateAgainstSchema(42, { type: 'string' });
    expect(result.valid).toBe(false);
    expect(Array.isArray(result.errors)).toBe(true);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('uses "$" as the root path in error messages by default', () => {
    const result = validateAgainstSchema(42, { type: 'string' });
    expect(result.errors[0]).toMatch(/^\$/);
  });

  it('uses the custom path when provided', () => {
    const result = validateAgainstSchema(42, { type: 'string' }, '$.body.field');
    expect(result.errors[0]).toMatch(/^\$\.body\.field/);
  });
});

// ---------------------------------------------------------------------------
// Type checking
// ---------------------------------------------------------------------------

describe('validateAgainstSchema — type', () => {
  const cases: Array<[string, unknown, boolean]> = [
    ['string ✓', 'hello', true],
    ['string ✗ (number)', 42, false],
    ['number ✓', 3.14, true],
    ['number ✗ (string)', 'pi', false],
    ['integer ✓', 7, true],
    ['integer ✗ (float)', 1.5, false],
    ['boolean ✓', true, true],
    ['boolean ✗', 'true', false],
    ['array ✓', [], true],
    ['array ✗ (object)', {}, false],
    ['object ✓', {}, true],
    ['object ✗ (array)', [], false],
    ['null ✓', null, true],
    ['null ✗ (undefined-like string)', '', false],
  ];

  it.each(cases)('%s', (label, value, shouldBeValid) => {
    // Derive the schema type from the test-case label (format: "type ✓/✗ …")
    const typeName = label.split(' ')[0] as string;
    const schema: JsonSchema = { type: typeName };
    const result = validateAgainstSchema(value, schema);
    expect(result.valid).toBe(shouldBeValid);
  });

  it('accepts a union type array (e.g. ["string","null"])', () => {
    const schema: JsonSchema = { type: ['string', 'null'] };
    assertValid('hello', schema);
    assertValid(null, schema);
    assertInvalid(42, schema);
  });

  it('passes when no type is specified (any value)', () => {
    assertValid(42, {});
    assertValid('x', {});
    assertValid(null, {});
  });

  it('includes the actual type in the error message', () => {
    const result = validateAgainstSchema(42, { type: 'string' });
    expect(result.errors[0]).toMatch(/number/);
    expect(result.errors[0]).toMatch(/string/);
  });
});

// ---------------------------------------------------------------------------
// null & nullable
// ---------------------------------------------------------------------------

describe('validateAgainstSchema — null / nullable', () => {
  it('rejects null for a non-nullable typed schema', () => {
    assertInvalid(null, { type: 'string' }, 'must not be null');
  });

  it('accepts null when nullable: true', () => {
    assertValid(null, { type: 'string', nullable: true });
  });

  it('accepts null when type is "null"', () => {
    assertValid(null, { type: 'null' });
  });

  it('does not run further constraints when value is null and nullable', () => {
    // minLength would normally fail, but null short-circuits
    assertValid(null, { type: 'string', nullable: true, minLength: 100 });
  });
});

// ---------------------------------------------------------------------------
// enum
// ---------------------------------------------------------------------------

describe('validateAgainstSchema — enum', () => {
  const schema: JsonSchema = { enum: ['USD', 'EUR', 'GBP'] };

  it('passes when value is in enum', () => {
    assertValid('USD', schema);
    assertValid('EUR', schema);
  });

  it('fails when value is not in enum', () => {
    assertInvalid('JPY', schema);
  });

  it('lists allowed values in the error message', () => {
    const result = validateAgainstSchema('JPY', schema);
    expect(result.errors[0]).toContain('USD');
    expect(result.errors[0]).toContain('EUR');
    expect(result.errors[0]).toContain('GBP');
  });

  it('handles numeric enum values', () => {
    const numSchema: JsonSchema = { type: 'integer', enum: [1, 2, 3] };
    assertValid(2, numSchema);
    assertInvalid(4, numSchema);
  });

  it('uses deep equality for object enum values', () => {
    const objSchema: JsonSchema = { enum: [{ a: 1 }, { b: 2 }] };
    assertValid({ a: 1 }, objSchema);
    assertInvalid({ a: 2 }, objSchema);
  });
});

// ---------------------------------------------------------------------------
// String constraints
// ---------------------------------------------------------------------------

describe('validateAgainstSchema — string constraints', () => {
  it('passes minLength when string is long enough', () => {
    assertValid('hello', { type: 'string', minLength: 3 });
    assertValid('abc', { type: 'string', minLength: 3 });
  });

  it('fails minLength when string is too short', () => {
    assertInvalid('hi', { type: 'string', minLength: 3 }, 'at least 3');
  });

  it('passes maxLength when string is short enough', () => {
    assertValid('hi', { type: 'string', maxLength: 5 });
  });

  it('fails maxLength when string is too long', () => {
    assertInvalid('toolong', { type: 'string', maxLength: 4 }, 'at most 4');
  });

  it('passes a valid pattern', () => {
    assertValid('abc123', { type: 'string', pattern: '^[a-z0-9]+$' });
  });

  it('fails an invalid pattern', () => {
    assertInvalid('ABC', { type: 'string', pattern: '^[a-z]+$' }, 'pattern');
  });

  it('does not crash on an invalid regex in schema', () => {
    // Should report an error, never throw
    const result = validateAgainstSchema('test', { type: 'string', pattern: '[invalid(' });
    expect(() => result).not.toThrow();
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toMatch(/invalid pattern/i);
  });
});

// ---------------------------------------------------------------------------
// Number constraints
// ---------------------------------------------------------------------------

describe('validateAgainstSchema — number constraints', () => {
  it('passes minimum (inclusive)', () => {
    assertValid(0, { type: 'number', minimum: 0 });
    assertValid(5, { type: 'number', minimum: 0 });
  });

  it('fails below minimum', () => {
    assertInvalid(-1, { type: 'number', minimum: 0 }, '>= 0');
  });

  it('passes maximum (inclusive)', () => {
    assertValid(100, { type: 'number', maximum: 100 });
  });

  it('fails above maximum', () => {
    assertInvalid(101, { type: 'number', maximum: 100 }, '<= 100');
  });

  it('passes exclusiveMinimum (draft-07 numeric)', () => {
    assertValid(0.01, { type: 'number', exclusiveMinimum: 0 });
  });

  it('fails exclusiveMinimum (value equals boundary)', () => {
    assertInvalid(0, { type: 'number', exclusiveMinimum: 0 }, '> 0');
  });

  it('passes exclusiveMaximum (draft-07 numeric)', () => {
    assertValid(99.99, { type: 'number', exclusiveMaximum: 100 });
  });

  it('fails exclusiveMaximum (value equals boundary)', () => {
    assertInvalid(100, { type: 'number', exclusiveMaximum: 100 }, '< 100');
  });

  it('validates integer type correctly', () => {
    assertValid(5, { type: 'integer', minimum: 1 });
    assertInvalid(5.5, { type: 'integer' }, 'integer');
  });
});

// ---------------------------------------------------------------------------
// Array constraints
// ---------------------------------------------------------------------------

describe('validateAgainstSchema — array constraints', () => {
  it('passes minItems', () => {
    assertValid([1, 2], { type: 'array', minItems: 2 });
  });

  it('fails below minItems', () => {
    assertInvalid([1], { type: 'array', minItems: 2 }, 'at least 2');
  });

  it('passes maxItems', () => {
    assertValid([1, 2, 3], { type: 'array', maxItems: 3 });
  });

  it('fails above maxItems', () => {
    assertInvalid([1, 2, 3, 4], { type: 'array', maxItems: 3 }, 'at most 3');
  });

  it('validates items sub-schema', () => {
    assertValid([1, 2, 3], { type: 'array', items: { type: 'number' } });
    assertInvalid(['a', 'b'], { type: 'array', items: { type: 'number' } }, 'number');
  });

  it('includes array index in the error path for items', () => {
    const result = validateAgainstSchema(
      [1, 'bad', 3],
      { type: 'array', items: { type: 'number' } },
    );
    expect(result.errors[0]).toMatch(/\[1\]/);
  });

  it('passes an empty array regardless of items schema', () => {
    assertValid([], { type: 'array', items: { type: 'string' } });
  });
});

// ---------------------------------------------------------------------------
// Object constraints
// ---------------------------------------------------------------------------

describe('validateAgainstSchema — object constraints', () => {
  const schema: JsonSchema = {
    type: 'object',
    required: ['name', 'age'],
    properties: {
      name: { type: 'string', minLength: 1 },
      age:  { type: 'integer', minimum: 0 },
      bio:  { type: 'string', maxLength: 500 },
    },
  };

  it('passes a fully valid object', () => {
    assertValid({ name: 'Alice', age: 30, bio: 'Developer' }, schema);
  });

  it('passes when optional properties are absent', () => {
    assertValid({ name: 'Bob', age: 25 }, schema);
  });

  it('fails when a required property is missing', () => {
    assertInvalid({ name: 'Charlie' }, schema, 'missing required property "age"');
  });

  it('fails when multiple required properties are missing', () => {
    const result = validateAgainstSchema({}, schema);
    expect(result.errors).toHaveLength(2);
  });

  it('validates property sub-schemas', () => {
    assertInvalid(
      { name: '', age: 25 },
      schema,
      'at least 1',
    );
  });

  it('includes the property name in the error path', () => {
    const result = validateAgainstSchema({ name: 42, age: 25 }, schema);
    expect(result.errors[0]).toMatch(/\$\.name/);
  });

  it('does not error on extra properties not in schema', () => {
    // JSON Schema allows additional properties by default
    assertValid({ name: 'Dave', age: 40, extra: true }, schema);
  });

  it('passes an empty object when no required properties', () => {
    assertValid({}, { type: 'object' });
  });
});

// ---------------------------------------------------------------------------
// Nested schemas
// ---------------------------------------------------------------------------

describe('validateAgainstSchema — nested schemas', () => {
  const schema: JsonSchema = {
    type: 'object',
    required: ['transaction'],
    properties: {
      transaction: {
        type: 'object',
        required: ['amount', 'currency'],
        properties: {
          amount:   { type: 'number', minimum: 0.01 },
          currency: { type: 'string', enum: ['USD', 'EUR'] },
          tags:     { type: 'array', items: { type: 'string' } },
        },
      },
    },
  };

  it('passes a deeply nested valid object', () => {
    assertValid(
      { transaction: { amount: 10, currency: 'USD', tags: ['fast', 'direct'] } },
      schema,
    );
  });

  it('reports a nested required violation with full path', () => {
    const result = validateAgainstSchema(
      { transaction: { amount: 10 } },
      schema,
    );
    expect(result.errors[0]).toMatch(/\$\.transaction/);
    expect(result.errors[0]).toContain('currency');
  });

  it('reports a deeply nested type violation with full path', () => {
    const result = validateAgainstSchema(
      { transaction: { amount: 'ten', currency: 'USD' } },
      schema,
    );
    expect(result.errors[0]).toMatch(/\$\.transaction\.amount/);
  });

  it('reports a nested array item violation with index in path', () => {
    const result = validateAgainstSchema(
      { transaction: { amount: 5, currency: 'EUR', tags: ['ok', 42] } },
      schema,
    );
    expect(result.errors[0]).toMatch(/\$\.transaction\.tags\[1\]/);
  });
});

// ---------------------------------------------------------------------------
// Real-world endpoint schema (matching MOCK_ENDPOINTS in ApiUsage.tsx)
// ---------------------------------------------------------------------------

describe('validateAgainstSchema — Create Transaction schema', () => {
  const transactionSchema: JsonSchema = {
    type: 'object',
    required: ['amount', 'currency'],
    properties: {
      amount:    { type: 'number', minimum: 0.01 },
      currency:  { type: 'string', enum: ['USD', 'EUR', 'GBP', 'USDC'] },
      recipient: { type: 'string', minLength: 1, maxLength: 100 },
      note:      { type: 'string', maxLength: 255 },
    },
  };

  it('passes a minimal valid body', () => {
    assertValid({ amount: 50, currency: 'USD' }, transactionSchema);
  });

  it('passes a full valid body', () => {
    assertValid(
      { amount: 99.99, currency: 'USDC', recipient: 'alice', note: 'lunch' },
      transactionSchema,
    );
  });

  it('fails when amount is zero', () => {
    assertInvalid({ amount: 0, currency: 'USD' }, transactionSchema, '>= 0.01');
  });

  it('fails when amount is negative', () => {
    assertInvalid({ amount: -10, currency: 'USD' }, transactionSchema, '>= 0.01');
  });

  it('fails when currency is not in the enum', () => {
    assertInvalid({ amount: 10, currency: 'JPY' }, transactionSchema, 'must be one of');
  });

  it('fails when a required field is missing', () => {
    assertInvalid({ amount: 10 }, transactionSchema, '"currency"');
  });

  it('fails when note exceeds maxLength', () => {
    assertInvalid(
      { amount: 10, currency: 'USD', note: 'x'.repeat(256) },
      transactionSchema,
      'at most 255',
    );
  });
});
