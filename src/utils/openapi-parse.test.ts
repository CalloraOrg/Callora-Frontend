import { describe, it, expect } from 'vitest';
import { parseOpenApiSpec } from './openapi-parse';
import type { ParsedEndpoint } from './openapi-parse';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_JSON = JSON.stringify({
  openapi: '3.0.3',
  info: { title: 'Test API', version: '1.0.0' },
  paths: {
    '/users': {
      get: { summary: 'List users' },
      post: { summary: 'Create user' },
    },
    '/users/{id}': {
      get: { summary: 'Get user' },
      delete: {},
    },
  },
});

const VALID_YAML = `
openapi: 3.1.0
info:
  title: Test API
  version: 1.0.0
paths:
  /items:
    get:
      summary: List items
    post:
      summary: Create item
  /items/{id}:
    put:
      summary: Update item
    patch: {}
    delete:
      summary: Delete item
`;

const YAML_NO_SUMMARY = `
openapi: 3.0.0
paths:
  /ping:
    get: {}
`;

const YAML_QUOTED_PATH = `
openapi: 3.0.0
paths:
  '/api/v1/resource:search':
    post:
      summary: Search resources
`;

const YAML_EMPTY_PATHS = `
openapi: 3.0.0
paths: {}
`;

const YAML_NO_PATHS = `
openapi: 3.0.0
info:
  title: Minimal API
`;

const MALFORMED_JSON = '{ "openapi": "3.0.0", "paths": { broken }';

const MALFORMED_YAML_BAD_INDENT = `
openapi: 3.0.0
paths:
  /users:
  get:
      summary: List users
`;

// A JSON string that is just not an object.
const JSON_ARRAY = JSON.stringify([1, 2, 3]);

// A Swagger 2.0 document exercising basePath, parameters, and unsupported
// features (`consumes` / `produces` / `formData`).
const SWAGGER2_JSON = JSON.stringify({
  swagger: '2.0',
  info: { title: 'Legacy API', version: '1.0.0' },
  basePath: '/api/v1',
  consumes: ['application/json'],
  produces: ['application/json'],
  paths: {
    '/users': {
      get: { summary: 'List users' },
      post: {
        summary: 'Create user',
        parameters: [{ name: 'payload', in: 'body', required: true }],
      },
    },
    '/users/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, type: 'string' }],
      get: { summary: 'Get user' },
      delete: {
        summary: 'Delete user',
        parameters: [
          { name: 'id', in: 'path', required: true, type: 'string' },
          { name: 'verbose', in: 'query', type: 'boolean' },
          { name: 'upload', in: 'formData', type: 'file' },
        ],
      },
    },
  },
});

const SWAGGER2_YAML = `
swagger: '2.0'
info:
  title: Legacy YAML
  version: 1.0.0
basePath: /v2
paths:
  /ping:
    get:
      summary: Ping
`;

// ---------------------------------------------------------------------------
// Unsupported file types
// ---------------------------------------------------------------------------

describe('parseOpenApiSpec — unsupported file types', () => {
  it('rejects a .txt file', () => {
    const result = parseOpenApiSpec('openapi: 3.0.0', 'spec.txt');
    expect(result.endpoints).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Unsupported file type');
    expect(result.errors[0].message).toContain('spec.txt');
  });

  it('rejects a .xml file', () => {
    const result = parseOpenApiSpec('<root/>', 'api.xml');
    expect(result.endpoints).toHaveLength(0);
    expect(result.errors[0].message).toContain('Unsupported file type');
  });

  it('rejects a file with no extension', () => {
    const result = parseOpenApiSpec('{}', 'specfile');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Unsupported file type');
  });

  it('is case-insensitive for the extension', () => {
    // .JSON / .YAML should be accepted.
    const jsonResult = parseOpenApiSpec(VALID_JSON, 'Spec.JSON');
    expect(jsonResult.errors).toHaveLength(0);
    expect(jsonResult.endpoints.length).toBeGreaterThan(0);

    const yamlResult = parseOpenApiSpec(VALID_YAML, 'Spec.YAML');
    expect(yamlResult.errors).toHaveLength(0);
    expect(yamlResult.endpoints.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// JSON parsing
// ---------------------------------------------------------------------------

describe('parseOpenApiSpec — JSON', () => {
  it('parses a valid JSON spec and returns all endpoints', () => {
    const result = parseOpenApiSpec(VALID_JSON, 'api.json');
    expect(result.errors).toHaveLength(0);

    const methods = result.endpoints.map((e) => e.method);
    expect(methods).toContain('GET');
    expect(methods).toContain('POST');
    expect(methods).toContain('DELETE');
    expect(result.endpoints).toHaveLength(4);
  });

  it('includes path and summary in each endpoint', () => {
    const result = parseOpenApiSpec(VALID_JSON, 'api.json');
    const listUsers = result.endpoints.find(
      (e) => e.path === '/users' && e.method === 'GET',
    );
    expect(listUsers).toBeTruthy();
    expect(listUsers?.summary).toBe('List users');
  });

  it('omits summary when the operation has none', () => {
    const result = parseOpenApiSpec(VALID_JSON, 'api.json');
    const deleteUser = result.endpoints.find(
      (e) => e.path === '/users/{id}' && e.method === 'DELETE',
    );
    expect(deleteUser).toBeTruthy();
    expect(deleteUser?.summary).toBeUndefined();
  });

  it('returns an error for malformed JSON', () => {
    const result = parseOpenApiSpec(MALFORMED_JSON, 'broken.json');
    expect(result.endpoints).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toMatch(/JSON parse error/i);
  });

  it('returns an error when the root value is an array, not an object', () => {
    const result = parseOpenApiSpec(JSON_ARRAY, 'array.json');
    expect(result.endpoints).toHaveLength(0);
    expect(result.errors[0].message).toContain('valid OpenAPI object');
  });

  it('provides a line number for JSON errors when available', () => {
    // We cannot guarantee the runtime includes position info, so we assert
    // the field is either a number or undefined — never null.
    const result = parseOpenApiSpec(MALFORMED_JSON, 'broken.json');
    const line = result.errors[0].line;
    expect(line === undefined || typeof line === 'number').toBe(true);
    if (line !== undefined) {
      expect(line).toBeGreaterThanOrEqual(1);
    }
  });

  it('returns an error for an empty JSON string', () => {
    const result = parseOpenApiSpec('', 'empty.json');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toMatch(/JSON parse error/i);
  });
});

// ---------------------------------------------------------------------------
// YAML parsing
// ---------------------------------------------------------------------------

describe('parseOpenApiSpec — YAML', () => {
  it('parses a valid YAML spec and returns all endpoints', () => {
    const result = parseOpenApiSpec(VALID_YAML, 'api.yaml');
    expect(result.errors).toHaveLength(0);
    expect(result.endpoints).toHaveLength(5);
  });

  it('returns correct method, path, and summary for each endpoint', () => {
    const result = parseOpenApiSpec(VALID_YAML, 'api.yaml');

    const getItems = result.endpoints.find(
      (e) => e.path === '/items' && e.method === 'GET',
    );
    expect(getItems?.summary).toBe('List items');

    const putItem = result.endpoints.find(
      (e) => e.path === '/items/{id}' && e.method === 'PUT',
    );
    expect(putItem?.summary).toBe('Update item');
  });

  it('accepts .yml extension', () => {
    const result = parseOpenApiSpec(VALID_YAML, 'api.yml');
    expect(result.errors).toHaveLength(0);
    expect(result.endpoints.length).toBeGreaterThan(0);
  });

  it('omits summary when the operation has none', () => {
    const result = parseOpenApiSpec(YAML_NO_SUMMARY, 'ping.yaml');
    expect(result.errors).toHaveLength(0);
    expect(result.endpoints).toHaveLength(1);
    expect(result.endpoints[0].summary).toBeUndefined();
  });

  it('handles an empty paths block', () => {
    const result = parseOpenApiSpec(YAML_EMPTY_PATHS, 'empty.yaml');
    expect(result.errors).toHaveLength(0);
    expect(result.endpoints).toHaveLength(0);
  });

  it('handles a spec with no paths block at all', () => {
    const result = parseOpenApiSpec(YAML_NO_PATHS, 'nopaths.yaml');
    expect(result.errors).toHaveLength(0);
    expect(result.endpoints).toHaveLength(0);
  });

  it('handles quoted path keys containing colons', () => {
    const result = parseOpenApiSpec(YAML_QUOTED_PATH, 'quoted.yaml');
    expect(result.errors).toHaveLength(0);
    expect(result.endpoints).toHaveLength(1);
    expect(result.endpoints[0].path).toBe('/api/v1/resource:search');
  });

  it('returns an error for a YAML spec that is not an object at root', () => {
    const result = parseOpenApiSpec('- one\n- two\n', 'list.yaml');
    expect(result.errors).toHaveLength(1);
  });

  it('handles malformed YAML gracefully and does not throw', () => {
    // parseOpenApiSpec must never throw regardless of input.
    expect(() =>
      parseOpenApiSpec(MALFORMED_YAML_BAD_INDENT, 'bad.yaml'),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Version validation
// ---------------------------------------------------------------------------

describe('parseOpenApiSpec — version validation', () => {
  it('accepts a Swagger 2.0 document instead of rejecting it (issue #1075)', () => {
    const swagger2 = JSON.stringify({ swagger: '2.0', paths: {} });
    const result = parseOpenApiSpec(swagger2, 'swagger.json');
    expect(result.errors).toHaveLength(0);
    expect(result.source).toBe('swagger2');
  });

  it('rejects a Swagger version other than 2.0', () => {
    const spec = JSON.stringify({ swagger: '1.2', paths: {} });
    const result = parseOpenApiSpec(spec, 'old-swagger.json');
    expect(result.endpoints).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Only Swagger 2.0 is supported');
  });

  it('reports source: openapi3 for 3.x documents', () => {
    const spec = JSON.stringify({ openapi: '3.0.0', paths: {} });
    const result = parseOpenApiSpec(spec, 'spec.json');
    expect(result.source).toBe('openapi3');
    expect(result.warnings).toHaveLength(0);
  });

  it('rejects a spec with openapi: "2.0"', () => {
    const spec = JSON.stringify({ openapi: '2.0', paths: {} });
    const result = parseOpenApiSpec(spec, 'old.json');
    expect(result.errors[0].message).toContain('Unsupported OpenAPI version');
    expect(result.errors[0].message).toContain('2.0');
  });

  it('accepts openapi: "3.0.0"', () => {
    const spec = JSON.stringify({ openapi: '3.0.0', paths: {} });
    const result = parseOpenApiSpec(spec, 'spec.json');
    expect(result.errors).toHaveLength(0);
  });

  it('accepts openapi: "3.1.0"', () => {
    const spec = JSON.stringify({ openapi: '3.1.0', paths: {} });
    const result = parseOpenApiSpec(spec, 'spec.json');
    expect(result.errors).toHaveLength(0);
  });

  it('returns an error when the openapi field is missing entirely', () => {
    const spec = JSON.stringify({ paths: {} });
    const result = parseOpenApiSpec(spec, 'spec.json');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toMatch(/missing.*openapi|openapi.*field/i);
  });

  it('returns an error when the openapi field is a number', () => {
    const spec = JSON.stringify({ openapi: 3, paths: {} });
    const result = parseOpenApiSpec(spec, 'spec.json');
    expect(result.errors).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Swagger 2.0 conversion (issue #1075)
// ---------------------------------------------------------------------------

describe('parseOpenApiSpec — Swagger 2.0', () => {
  it('extracts every endpoint from a 2.0 document', () => {
    const result = parseOpenApiSpec(SWAGGER2_JSON, 'legacy.json');

    expect(result.errors).toHaveLength(0);
    expect(result.source).toBe('swagger2');
    expect(result.endpoints.map((e) => `${e.method} ${e.path}`)).toEqual([
      'GET /api/v1/users',
      'POST /api/v1/users',
      'GET /api/v1/users/{id}',
      'DELETE /api/v1/users/{id}',
    ]);
  });

  it('prefixes basePath onto every path', () => {
    const result = parseOpenApiSpec(SWAGGER2_JSON, 'legacy.json');
    expect(result.endpoints.every((e) => e.path.startsWith('/api/v1'))).toBe(true);
  });

  it('leaves paths untouched when basePath is "/" or absent', () => {
    const rootBase = JSON.stringify({
      swagger: '2.0',
      basePath: '/',
      paths: { '/ping': { get: {} } },
    });
    expect(parseOpenApiSpec(rootBase, 'a.json').endpoints[0].path).toBe('/ping');

    const noBase = JSON.stringify({
      swagger: '2.0',
      paths: { '/ping': { get: {} } },
    });
    expect(parseOpenApiSpec(noBase, 'b.json').endpoints[0].path).toBe('/ping');
  });

  it('maps query / path / body parameters onto the endpoint', () => {
    const result = parseOpenApiSpec(SWAGGER2_JSON, 'legacy.json');
    const del = result.endpoints.find((e) => e.method === 'DELETE');

    expect(del?.parameters).toEqual([
      { name: 'id', in: 'path', required: true },
      { name: 'verbose', in: 'query', required: false },
    ]);

    const post = result.endpoints.find((e) => e.method === 'POST');
    expect(post?.parameters).toEqual([{ name: 'payload', in: 'body', required: true }]);
  });

  it('lets operation-level parameters override path-item ones', () => {
    const spec = JSON.stringify({
      swagger: '2.0',
      paths: {
        '/things': {
          parameters: [{ name: 'limit', in: 'query', required: true }],
          get: { parameters: [{ name: 'limit', in: 'query', required: false }] },
        },
      },
    });
    const result = parseOpenApiSpec(spec, 'override.json');
    expect(result.endpoints[0].parameters).toEqual([
      { name: 'limit', in: 'query', required: false },
    ]);
  });

  it('warns about unsupported 2.0 features instead of failing', () => {
    const result = parseOpenApiSpec(SWAGGER2_JSON, 'legacy.json');
    expect(result.errors).toHaveLength(0);
    expect(result.endpoints.length).toBeGreaterThan(0);

    const messages = result.warnings.map((w) => w.message).join('\n');
    expect(messages).toContain('"consumes"');
    expect(messages).toContain('"produces"');
    expect(messages).toContain('"formData"');
  });

  it('de-duplicates repeated warnings across operations', () => {
    const spec = JSON.stringify({
      swagger: '2.0',
      paths: {
        '/a': { get: { parameters: [{ name: 'x', in: 'formData' }] } },
        '/b': { get: { parameters: [{ name: 'y', in: 'formData' }] } },
      },
    });
    const result = parseOpenApiSpec(spec, 'formdata.json');
    const formDataWarnings = result.warnings.filter((w) => w.message.includes('"formData"'));
    expect(formDataWarnings).toHaveLength(1);
  });

  it('warns about unresolved $ref parameters', () => {
    const spec = JSON.stringify({
      swagger: '2.0',
      paths: {
        '/a': { get: { parameters: [{ $ref: '#/parameters/PageSize' }] } },
      },
    });
    const result = parseOpenApiSpec(spec, 'ref.json');
    expect(result.errors).toHaveLength(0);
    expect(result.warnings.some((w) => w.message.includes('$ref'))).toBe(true);
  });

  it('converts a Swagger 2.0 YAML document', () => {
    const result = parseOpenApiSpec(SWAGGER2_YAML, 'legacy.yaml');
    expect(result.errors).toHaveLength(0);
    expect(result.source).toBe('swagger2');
    expect(result.endpoints).toHaveLength(1);
    expect(result.endpoints[0].path).toBe('/v2/ping');
  });

  it('reports no warnings for a clean 2.0 document', () => {
    const spec = JSON.stringify({
      swagger: '2.0',
      paths: { '/ping': { get: { summary: 'Ping' } } },
    });
    const result = parseOpenApiSpec(spec, 'clean.json');
    expect(result.warnings).toHaveLength(0);
    expect(result.endpoints[0].summary).toBe('Ping');
  });
});

// ---------------------------------------------------------------------------
// Endpoint extraction edge cases
// ---------------------------------------------------------------------------

describe('parseOpenApiSpec — endpoint extraction', () => {
  it('ignores non-HTTP-method keys in a path item (e.g. summary, servers)', () => {
    const spec = JSON.stringify({
      openapi: '3.0.0',
      paths: {
        '/things': {
          summary: 'Things endpoint',
          get: { summary: 'List things' },
        },
      },
    });
    const result = parseOpenApiSpec(spec, 'spec.json');
    expect(result.endpoints).toHaveLength(1);
    expect(result.endpoints[0].method).toBe('GET');
  });

  it('returns endpoints in the order keys appear in paths', () => {
    const spec = JSON.stringify({
      openapi: '3.0.0',
      paths: {
        '/a': { get: { summary: 'A' } },
        '/b': { post: { summary: 'B' } },
      },
    });
    const result = parseOpenApiSpec(spec, 'spec.json');
    const paths = result.endpoints.map((e) => e.path);
    expect(paths).toEqual(['/a', '/b']);
  });

  it('uppercases the method', () => {
    const result = parseOpenApiSpec(VALID_JSON, 'api.json');
    const methods = result.endpoints.map((e) => e.method);
    methods.forEach((m) => {
      expect(m).toBe(m.toUpperCase());
    });
  });

  it('satisfies the ParsedEndpoint type shape', () => {
    const result = parseOpenApiSpec(VALID_JSON, 'api.json');
    result.endpoints.forEach((ep: ParsedEndpoint) => {
      expect(typeof ep.path).toBe('string');
      expect(typeof ep.method).toBe('string');
      expect(ep.summary === undefined || typeof ep.summary === 'string').toBe(true);
    });
  });
});
