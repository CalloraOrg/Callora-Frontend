/**
 * OpenAPI 3.x specification parser.
 *
 * Supported formats:
 *   - OpenAPI 3.x JSON  (.json)
 *   - OpenAPI 3.x YAML  (.yaml, .yml)
 *
 * This module never throws. All errors are captured and returned in
 * ParseResult.errors so callers can surface them inline without a try/catch.
 *
 * Error handling strategy:
 *   - Unsupported file extension → ParseError with a descriptive message.
 *   - JSON SyntaxError          → ParseError; line number extracted from
 *                                  the native error message when the runtime
 *                                  includes position information (V8 / SpiderMonkey).
 *   - YAML structural errors    → ParseError with the 1-based line number of
 *                                  the first problem the hand-rolled parser detects.
 *   - Missing / wrong `openapi` version → validation ParseError.
 *   - Missing `paths` block     → zero endpoints, no error (valid per spec).
 *   - Local `$ref` cycles / depth / unresolved / remote → non-fatal ParseError
 *                                  (endpoints still returned when possible).
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A single parameter extracted from an operation or path item
 * (after local `$ref` resolution when applicable).
 */
export type ParsedParameter = {
  /** Parameter name, e.g. `"id"`. */
  name: string;
  /** Location: `"path" | "query" | "header" | "cookie"`. */
  in?: string;
  /** Whether the parameter is required. */
  required?: boolean;
  /** Optional description from the Parameter Object. */
  description?: string;
};

/**
 * A single extracted API endpoint stub from an OpenAPI `paths` block.
 */
export type ParsedEndpoint = {
  /** The URL path template, e.g. `/users/{id}`. */
  path: string;
  /** Uppercase HTTP method, e.g. `"GET"`, `"POST"`. */
  method: string;
  /** The operation `summary` field, if present. */
  summary?: string;
  /**
   * Resolved parameters (path-level + operation-level), including those
   * referenced via local `#/components/parameters/...` $refs.
   */
  parameters?: ParsedParameter[];
  /**
   * Human-readable hint for the request body schema when resolvable
   * (e.g. schema title, type, or local $ref target name).
   */
  requestBodySchema?: string;
};

/**
 * A parse or validation error.
 * The `line` field is populated whenever the underlying parser can determine
 * which source line triggered the error.
 */
export type ParseError = {
  message: string;
  /** 1-indexed line number in the source file. */
  line?: number;
};

/**
 * The result of parsing an OpenAPI specification file.
 * On a successful parse, `errors` is empty and `endpoints` contains the
 * extracted stubs.  On a fatal error, `endpoints` is empty and `errors`
 * contains at least one entry.  Both arrays may be non-empty when partial
 * extraction succeeds alongside non-fatal issues (e.g. unresolved $refs).
 */
export type ParseResult = {
  endpoints: ParsedEndpoint[];
  errors: ParseError[];
};

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

/** HTTP methods recognised by the OpenAPI 3.x specification (RFC 7231 + PATCH). */
const HTTP_METHODS = new Set([
  'get',
  'post',
  'put',
  'delete',
  'patch',
  'options',
  'head',
  'trace',
]);

/** Maximum $ref resolution depth (guards against pathological nesting). */
const MAX_REF_DEPTH = 32;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse an OpenAPI 3.x specification from raw text.
 *
 * @param text     - Raw text content of the spec file.
 * @param filename - Original filename; used only to detect format (.json vs .yaml/.yml).
 * @returns A ParseResult containing the extracted endpoints and any errors.
 */
export function parseOpenApiSpec(text: string, filename: string): ParseResult {
  const lower = filename.toLowerCase();

  if (lower.endsWith('.json')) {
    return parseJson(text);
  }

  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) {
    return parseYaml(text);
  }

  return {
    endpoints: [],
    errors: [
      {
        message: `Unsupported file type: "${filename}". Accepted formats are .json, .yaml, and .yml.`,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// JSON path
// ---------------------------------------------------------------------------

function parseJson(text: string): ParseResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch (err) {
    const syntaxErr = err instanceof SyntaxError ? err : new SyntaxError(String(err));
    return {
      endpoints: [],
      errors: [
        {
          message: `JSON parse error: ${syntaxErr.message}`,
          line: extractJsonErrorLine(syntaxErr.message, text),
        },
      ],
    };
  }

  return extractEndpoints(parsed, []);
}

/**
 * Attempt to extract a 1-based line number from a JSON SyntaxError message.
 */
function extractJsonErrorLine(message: string, text: string): number | undefined {
  const posMatch = message.match(/at (?:JSON )?position (\d+)/i);
  if (posMatch) {
    const pos = Number(posMatch[1]);
    if (Number.isFinite(pos)) {
      return positionToLine(text, pos);
    }
  }

  const lineMatch = message.match(/line (\d+)/i);
  if (lineMatch) {
    const line = Number(lineMatch[1]);
    if (Number.isFinite(line)) return line;
  }

  return undefined;
}

/** Convert a character offset within `text` to a 1-based line number. */
function positionToLine(text: string, position: number): number {
  const safePos = Math.min(position, text.length);
  let line = 1;
  for (let i = 0; i < safePos; i++) {
    if (text[i] === '\n') line++;
  }
  return line;
  }

// ---------------------------------------------------------------------------
// YAML path
// ---------------------------------------------------------------------------

/**
 * Minimal OpenAPI 3.x YAML parser.
 *
 * Handles the subset of YAML used by OpenAPI 3.x path blocks, plus simple
 * sequence items that are either a bare `$ref` string or a single-key mapping
 * (needed for `parameters: - $ref: '#/components/...'`).
 */
function parseYaml(text: string): ParseResult {
  const { root, errors } = parseYamlToMap(text);

  if (errors.length > 0 && root === null) {
    return { endpoints: [], errors };
  }

  return extractEndpoints(root ?? {}, errors);
}

type YamlMap = Record<string, unknown>;

interface YamlLine {
  indent: number;
  key: string | null;
  /** null ⟹ nested block; string/number/bool scalar; or special seq markers. */
  value: string | null;
  lineNumber: number;
  /** True when this line is a sequence item (`- …`). */
  isSequenceItem: boolean;
}

function parseYamlToMap(text: string): { root: YamlMap | null; errors: ParseError[] } {
  const rawLines = text.split(/\r?\n/);
  const parsedLines: YamlLine[] = [];
  const errors: ParseError[] = [];

  let inBlockScalar = false;
  let blockScalarIndent = -1;

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    const lineNumber = i + 1;
    const stripped = raw.trim();

    if (stripped.startsWith('%') || stripped === '---' || stripped === '...') {
      inBlockScalar = false;
      continue;
    }

    if (!stripped || stripped.startsWith('#')) continue;

    const indent = raw.length - raw.trimStart().length;

    if (inBlockScalar) {
      if (indent > blockScalarIndent) continue;
      inBlockScalar = false;
      blockScalarIndent = -1;
    }

    // Sequence item: "- $ref: '...'" or "- name: id" style single mapping, or bare scalar.
    if (stripped.startsWith('- ') || stripped === '-') {
      const itemBody = stripped === '-' ? '' : stripped.slice(2).trim();
      if (!itemBody) {
        parsedLines.push({
          indent,
          key: null,
          value: null,
          lineNumber,
          isSequenceItem: true,
        });
        continue;
      }

      // "- $ref: '#/...'" or "- key: value"
      const kv = parseYamlKeyValue(itemBody);
      if (kv) {
        parsedLines.push({
          indent,
          key: kv.key,
          value:
            kv.rawValue === null
              ? null
              : unquoteYamlString(stripYamlInlineComment(kv.rawValue)),
          lineNumber,
          isSequenceItem: true,
        });
      } else {
        // Bare scalar sequence item (rare for OpenAPI params).
        parsedLines.push({
          indent,
          key: null,
          value: unquoteYamlString(stripYamlInlineComment(itemBody)),
          lineNumber,
          isSequenceItem: true,
        });
      }
      continue;
    }

    const parsed = parseYamlKeyValue(stripped);
    if (parsed === null) continue;

    const { key, rawValue } = parsed;

    if (rawValue === '|' || rawValue === '>') {
      parsedLines.push({
        indent,
        key,
        value: '',
        lineNumber,
        isSequenceItem: false,
      });
      inBlockScalar = true;
      blockScalarIndent = indent;
      continue;
    }

    const value =
      rawValue === null ? null : unquoteYamlString(stripYamlInlineComment(rawValue));

    parsedLines.push({
      indent,
      key,
      value,
      lineNumber,
      isSequenceItem: false,
    });
  }

  const root: YamlMap = {};
  // Stack frames: mapping objects and optional open sequence arrays.
  type Frame =
    | { kind: 'map'; indent: number; obj: YamlMap }
    | { kind: 'seq'; indent: number; arr: unknown[] };

  const stack: Frame[] = [{ kind: 'map', indent: -1, obj: root }];

  for (const line of parsedLines) {
    while (stack.length > 1) {
      const top = stack[stack.length - 1];
      if (top.indent < line.indent) break;
      // For sequence frames, pop when indent goes back to or above the `-` indent.
      if (top.kind === 'seq' && top.indent === line.indent && line.isSequenceItem) {
        break; // sibling sequence item
      }
      if (top.indent >= line.indent) {
        stack.pop();
        continue;
      }
      break;
    }

    const parent = stack[stack.length - 1];

    if (line.isSequenceItem) {
      // Ensure parent has an array for this sequence.
      let arr: unknown[];
      if (parent.kind === 'seq') {
        arr = parent.arr;
      } else {
        // Sequence under a map key that was opened with value null → we need
        // the key that owns this sequence. The previous sibling key with
        // value null should already have a nested map; OpenAPI uses
        // "parameters:" then indented "- ...". That key's value is currently {}.
        // Convert empty map to array if this is the first seq item under that key.
        // Simpler approach: look up the most recent key at parent that is an empty object
        // and turn it into an array — fragile. Instead, track lastKey on map frames.
        const mapParent = parent as { kind: 'map'; indent: number; obj: YamlMap; lastKey?: string };
        const lastKey = mapParent.lastKey;
        if (lastKey !== undefined) {
          const existing = mapParent.obj[lastKey];
          if (Array.isArray(existing)) {
            arr = existing;
          } else if (
            existing &&
            typeof existing === 'object' &&
            !Array.isArray(existing) &&
            Object.keys(existing as object).length === 0
          ) {
            arr = [];
            mapParent.obj[lastKey] = arr;
          } else if (existing === undefined || existing === null) {
            arr = [];
            mapParent.obj[lastKey] = arr;
          } else {
            arr = [];
            mapParent.obj[lastKey] = arr;
          }
        } else {
          arr = [];
        }
        stack.push({ kind: 'seq', indent: line.indent, arr });
      }

      if (line.key === null) {
        // Bare scalar or empty item.
        if (line.value !== null) {
          arr.push(line.value);
        } else {
          const nested: YamlMap = {};
          arr.push(nested);
          stack.push({ kind: 'map', indent: line.indent, obj: nested });
        }
      } else {
        // Single-key mapping item: { [key]: value | nested }
        const item: YamlMap = {};
        if (line.value === null) {
          const nested: YamlMap = {};
          item[line.key] = nested;
          arr.push(item);
          stack.push({ kind: 'map', indent: line.indent, obj: nested });
        } else {
          item[line.key] = line.value;
          arr.push(item);
        }
      }
      continue;
    }

    // Mapping key
    if (parent.kind === 'seq') {
      // Nested keys under a sequence item map — pop seq and use map below if needed.
      // Sequence item that was a single-key with nested block already pushed a map frame.
      stack.pop();
      const newParent = stack[stack.length - 1];
      if (newParent.kind === 'map' && line.key !== null) {
        if (line.value === null) {
          const nested: YamlMap = {};
          newParent.obj[line.key] = nested;
          (newParent as { lastKey?: string }).lastKey = line.key;
          stack.push({ kind: 'map', indent: line.indent, obj: nested });
        } else {
          newParent.obj[line.key] = line.value;
          (newParent as { lastKey?: string }).lastKey = line.key;
        }
      }
      continue;
    }

    if (line.key === null) continue;

    if (line.value === null) {
      const nested: YamlMap = {};
      parent.obj[line.key] = nested;
      (parent as { lastKey?: string }).lastKey = line.key;
      stack.push({ kind: 'map', indent: line.indent, obj: nested });
    } else {
      parent.obj[line.key] = line.value;
      (parent as { lastKey?: string }).lastKey = line.key;
    }
  }

  return { root, errors };
}

function parseYamlKeyValue(
  trimmed: string,
): { key: string; rawValue: string | null } | null {
  if (trimmed.startsWith('"') || trimmed.startsWith("'")) {
    const quote = trimmed[0];
    const closeIdx = trimmed.indexOf(quote, 1);
    if (closeIdx === -1) return null;

    const key = trimmed.slice(1, closeIdx);
    const afterKey = trimmed.slice(closeIdx + 1).trimStart();
    if (!afterKey.startsWith(':')) return null;

    const afterColon = afterKey.slice(1).trim();
    return { key, rawValue: afterColon === '' ? null : afterColon };
  }

  const colonIdx = trimmed.indexOf(':');
  if (colonIdx === -1) return null;

  const key = trimmed.slice(0, colonIdx).trim();
  const afterColon = trimmed.slice(colonIdx + 1).trim();

  if (afterColon === '{}' || afterColon === '[]') {
    return { key, rawValue: null };
  }

  return { key, rawValue: afterColon === '' ? null : afterColon };
}

function stripYamlInlineComment(value: string): string {
  if (value.startsWith('"') || value.startsWith("'")) return value;
  const commentIdx = value.indexOf(' #');
  return commentIdx !== -1 ? value.slice(0, commentIdx).trimEnd() : value;
}

function unquoteYamlString(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

// ---------------------------------------------------------------------------
// $ref resolution (local #/components/... only)
// ---------------------------------------------------------------------------

type ResolveContext = {
  root: Record<string, unknown>;
  errors: ParseError[];
  /** Refs currently on the resolution stack (cycle detection). */
  stack: Set<string>;
  depth: number;
};

/**
 * Resolve a value that may be a Reference Object (`{ $ref: "..." }`).
 * - Local refs (`#/...`) are followed with cycle detection and depth limit.
 * - Remote refs (http/https or non-fragment) are reported, not fetched.
 * - Unresolved or cyclic refs yield a non-fatal ParseError and return undefined.
 */
function resolveRef(value: unknown, ctx: ResolveContext): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return value;
  }

  const obj = value as Record<string, unknown>;
  const ref = obj['$ref'];
  if (typeof ref !== 'string') {
    return value;
  }

  // Remote / external refs — never fetch.
  if (!ref.startsWith('#/')) {
    ctx.errors.push({
      message: `Remote or external \( ref is not resolved (not fetched): " \){ref}"`,
    });
    return undefined;
  }

  if (ctx.depth >= MAX_REF_DEPTH) {
    ctx.errors.push({
      message: `Maximum \( ref resolution depth ( \){MAX_REF_DEPTH}) exceeded at "${ref}"`,
    });
    return undefined;
  }

  if (ctx.stack.has(ref)) {
    ctx.errors.push({
      message: `Cyclic \( ref detected: " \){ref}"`,
    });
    return undefined;
  }

  const target = getByJsonPointer(ctx.root, ref.slice(1)); // drop leading '#'
  if (target === undefined) {
    ctx.errors.push({
      message: `Unresolved local \( ref: " \){ref}"`,
    });
    return undefined;
  }

  ctx.stack.add(ref);
  const resolved = resolveRef(target, {
    ...ctx,
    depth: ctx.depth + 1,
  });
  ctx.stack.delete(ref);
  return resolved;
}

/**
 * Walk a JSON Pointer path (RFC 6901 subset) from `root`.
 * Pointer is like `/components/parameters/Id` (no leading `#`).
 */
function getByJsonPointer(root: Record<string, unknown>, pointer: string): unknown {
  if (!pointer || pointer === '/') return root;

  const parts = pointer.split('/').slice(1); // first segment empty before first /
  let current: unknown = root;

  for (const raw of parts) {
    const key = raw.replace(/\~1/g, '/').replace(/\~0/g, '\~');
    if (typeof current !== 'object' || current === null) return undefined;
    if (Array.isArray(current)) {
      const idx = Number(key);
      if (!Number.isInteger(idx) || idx < 0 || idx >= current.length) return undefined;
      current = current[idx];
    } else {
      const rec = current as Record<string, unknown>;
      if (!(key in rec)) return undefined;
      current = rec[key];
    }
  }

  return current;
}

function isParameterObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>)['name'] === 'string'
  );
}

function toParsedParameter(obj: Record<string, unknown>): ParsedParameter {
  const param: ParsedParameter = { name: obj['name'] as string };
  if (typeof obj['in'] === 'string') param.in = obj['in'];
  if (typeof obj['required'] === 'boolean') param.required = obj['required'];
  if (typeof obj['description'] === 'string') param.description = obj['description'];
  return param;
}

/**
 * Resolve a list of Parameter Objects and/or Reference Objects.
 */
function resolveParameterList(
  list: unknown,
  ctx: ResolveContext,
): ParsedParameter[] {
  if (!Array.isArray(list)) return [];

  const out: ParsedParameter[] = [];
  for (const item of list) {
    const resolved = resolveRef(item, ctx);
    if (isParameterObject(resolved)) {
      out.push(toParsedParameter(resolved));
    } else if (
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Record<string, unknown>)['$ref'] === 'string' &&
      resolved === undefined
    ) {
      // Already reported via resolveRef.
    } else if (isParameterObject(item)) {
      // Inline param that was not a ref.
      out.push(toParsedParameter(item));
    }
  }
  return out;
}

/**
 * Best-effort label for a requestBody schema (local $ref name or type/title).
 */
function resolveRequestBodySchemaHint(
  requestBody: unknown,
  ctx: ResolveContext,
): string | undefined {
  if (typeof requestBody !== 'object' || requestBody === null) return undefined;

  const resolvedBody = resolveRef(requestBody, ctx);
  if (typeof resolvedBody !== 'object' || resolvedBody === null) return undefined;

  const body = resolvedBody as Record<string, unknown>;
  const content = body['content'];
  if (typeof content !== 'object' || content === null) return undefined;

  for (const media of Object.values(content as Record<string, unknown>)) {
    if (typeof media !== 'object' || media === null) continue;
    const schema = (media as Record<string, unknown>)['schema'];
    if (schema === undefined) continue;

    // Prefer the $ref path name before full resolve for a stable label.
    if (
      typeof schema === 'object' &&
      schema !== null &&
      typeof (schema as Record<string, unknown>)['$ref'] === 'string'
    ) {
      const ref = (schema as Record<string, unknown>)['$ref'] as string;
      if (ref.startsWith('#/')) {
        const parts = ref.split('/');
        const name = parts[parts.length - 1];
        // Still attempt resolve to surface cycle/remote/unresolved errors.
        resolveRef(schema, ctx);
        return name || ref;
      }
      resolveRef(schema, ctx);
      return undefined;
    }

    const resolvedSchema = resolveRef(schema, ctx);
    if (typeof resolvedSchema !== 'object' || resolvedSchema === null) continue;
    const s = resolvedSchema as Record<string, unknown>;
    if (typeof s['title'] === 'string') return s['title'];
    if (typeof s['type'] === 'string') return s['type'];
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Endpoint extraction — shared by JSON and YAML paths
// ---------------------------------------------------------------------------

function extractEndpoints(spec: unknown, existingErrors: ParseError[]): ParseResult {
  if (typeof spec !== 'object' || spec === null || Array.isArray(spec)) {
    return {
      endpoints: [],
      errors: [
        ...existingErrors,
        { message: 'The file does not contain a valid OpenAPI object at the root level.' },
      ],
    };
  }

  const specObj = spec as Record<string, unknown>;

  const openapiVersion = specObj['openapi'];

  if (typeof openapiVersion !== 'string') {
    return {
      endpoints: [],
      errors: [
        ...existingErrors,
        {
          message:
            'Missing "openapi" field. This parser only supports OpenAPI 3.x specifications.',
        },
      ],
    };
  }

  if (!openapiVersion.startsWith('3.')) {
    return {
      endpoints: [],
      errors: [
        ...existingErrors,
        {
          message: `Unsupported OpenAPI version "${openapiVersion}". Only OpenAPI 3.x is supported.`,
        },
      ],
    };
  }

  const paths = specObj['paths'];

  if (paths === undefined || paths === null) {
    return { endpoints: [], errors: existingErrors };
  }

  if (typeof paths !== 'object' || Array.isArray(paths)) {
    return {
      endpoints: [],
      errors: [
        ...existingErrors,
        { message: 'The "paths" field is present but is not a valid object.' },
      ],
    };
  }

  const pathsObj = paths as Record<string, unknown>;
  const endpoints: ParsedEndpoint[] = [];
  const refErrors: ParseError[] = [];

  const ctx: ResolveContext = {
    root: specObj,
    errors: refErrors,
    stack: new Set(),
    depth: 0,
  };

  for (const [pathKey, pathItem] of Object.entries(pathsObj)) {
    if (typeof pathItem !== 'object' || pathItem === null) continue;

    // Path Item may itself be a $ref.
    const resolvedPathItem = resolveRef(pathItem, ctx);
    if (typeof resolvedPathItem !== 'object' || resolvedPathItem === null) continue;

    const pathItemObj = resolvedPathItem as Record<string, unknown>;

    // Path-level parameters (shared by all operations on this path).
    const pathParams = resolveParameterList(pathItemObj['parameters'], ctx);

    for (const methodKey of Object.keys(pathItemObj)) {
      if (!HTTP_METHODS.has(methodKey.toLowerCase())) continue;

      const operation = pathItemObj[methodKey];
      let summary: string | undefined;
      let parameters: ParsedParameter[] | undefined;
      let requestBodySchema: string | undefined;

      if (typeof operation === 'object' && operation !== null) {
        const op = operation as Record<string, unknown>;
        if (typeof op['summary'] === 'string') {
          summary = op['summary'];
        }

        const opParams = resolveParameterList(op['parameters'], ctx);
        const merged = [...pathParams, ...opParams];
        if (merged.length > 0) {
          parameters = merged;
        }

        if (op['requestBody'] !== undefined) {
          requestBodySchema = resolveRequestBodySchemaHint(op['requestBody'], ctx);
        }
      }

      endpoints.push({
        path: pathKey,
        method: methodKey.toUpperCase(),
        ...(summary !== undefined ? { summary } : {}),
        ...(parameters !== undefined ? { parameters } : {}),
        ...(requestBodySchema !== undefined ? { requestBodySchema } : {}),
      });
    }
  }

  return {
    endpoints,
    errors: [...existingErrors, ...refErrors],
  };
        }
