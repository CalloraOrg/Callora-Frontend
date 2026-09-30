/**
 * OpenAPI / Swagger specification parser.
 *
 * Supported formats:
 *   - OpenAPI 3.x JSON  (.json)
 *   - OpenAPI 3.x YAML  (.yaml, .yml)
 *   - Swagger 2.0 JSON / YAML — converted into the same ParsedEndpoint shape.
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
 *
 * Swagger 2.0 strategy (issue #1075):
 *   - A document carrying a string `swagger` field is parsed as 2.0.
 *   - `basePath` is prefixed to every extracted path.
 *   - `query` / `path` / `body` parameters (path-item and operation level,
 *     operation level wins) are mapped onto ParsedEndpoint.parameters.
 *   - Features that cannot be represented (custom `consumes` / `produces`
 *     media types, `header` / `formData` parameters, unresolved `$ref`s)
 *     produce non-fatal ParseResult.warnings instead of failing the import.
 *   - ParseResult.source reports which flavour produced the endpoints so the
 *     UI can tell the user the file was converted.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A request parameter attached to a {@link ParsedEndpoint}.
 *
 * Only locations that can be represented in the publish form are kept
 * (`query`, `path`, `body`). Swagger 2.0 `header` / `formData` parameters are
 * reported through `ParseResult.warnings` instead of silently creating stubs
 * that cannot be imported.
 */
export type ParsedEndpointParameter = {
  name: string;
  /** Parameter location: `query`, `path`, or `body`. */
  in: string;
  /** Swagger 2.0 `required` flag; `path` parameters are always required. */
  required: boolean;
};

/**
 * A single extracted API endpoint stub from an OpenAPI / Swagger `paths` block.
 */
export type ParsedEndpoint = {
  /** The URL path template, e.g. `/users/{id}` (already `basePath`-prefixed for 2.0). */
  path: string;
  /** Uppercase HTTP method, e.g. `"GET"`, `"POST"`. */
  method: string;
  /** The operation `summary` field, if present. */
  summary?: string;
  /** Query / path / body parameters declared for the operation. */
  parameters?: ParsedEndpointParameter[];
};

/** Which specification flavour produced the extracted endpoints. */
export type ParsedSpecSource = 'openapi3' | 'swagger2';

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
 * extraction succeeds alongside non-fatal issues.
 */
export type ParseResult = {
  endpoints: ParsedEndpoint[];
  errors: ParseError[];
  /**
   * Non-fatal diagnostics. Simpler specs never produce these; Swagger 2.0
   * documents do when they use features the endpoint stub cannot represent.
   */
  warnings: ParseError[];
  /** The specification flavour the endpoints came from. */
  source: ParsedSpecSource;
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

/**
 * Parameter locations that map onto a ParsedEndpoint stub. Swagger 2.0 also
 * defines `header` and `formData`; those are reported as warnings instead.
 */
const SUPPORTED_PARAM_LOCATIONS = new Set(['query', 'path', 'body']);

/** Shared output channels for {@link collectEndpoints}. */
type EndpointCollectionOptions = {
  /** Swagger 2.0 `basePath` prefixed to every path (`''` for OpenAPI 3.x). */
  basePath: string;
  /** Emit warnings for parameter locations that cannot be represented. */
  warnOnUnsupportedParameters: boolean;
  /** Warnings accumulated so far; new diagnostics are appended in place. */
  warnings: ParseError[];
  /** Errors accumulated so far; structural problems are appended in place. */
  errors: ParseError[];
  /** De-duplication set for warning messages (one entry per distinct text). */
  warnedMessages: Set<string>;
};

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
    warnings: [],
    source: 'openapi3',
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
      warnings: [],
      source: 'openapi3',
    };
  }

  return extractEndpoints(parsed, []);
}

/**
 * Attempt to extract a 1-based line number from a JSON SyntaxError message.
 *
 * - V8 (Chrome / Node): `"Unexpected token ... at JSON position N"`
 * - Some runtimes:      `"... at line N column M"`
 *
 * Returns `undefined` when no position information is available.
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
 * Handles the subset of YAML used by OpenAPI 3.x path blocks:
 *   ✔ Block mappings (key: value) at any indentation depth.
 *   ✔ Quoted mapping keys (single and double quotes).
 *   ✔ Quoted scalar values.
 *   ✔ Inline comments (# …).
 *   ✔ Document separators (--- / ...).
 *   ✔ Block scalar markers (| and >) — content is skipped; key maps to "".
 *   ✔ YAML directives (%YAML, %TAG) — silently skipped.
 *
 * Limitations (acceptable for OpenAPI extraction):
 *   ✘ YAML anchors / aliases (&anchor / *alias).
 *   ✘ Flow sequences / mappings ([…] / {…}).
 *   ✘ Multi-document streams.
 *   ✘ Path keys with bare colons (e.g. /foo:bar) — must be quoted in source.
 */
function parseYaml(text: string): ParseResult {
  const { root, errors } = parseYamlToMap(text);

  if (errors.length > 0 && root === null) {
    return { endpoints: [], errors, warnings: [], source: 'openapi3' };
  }

  return extractEndpoints(root ?? {}, errors);
}

// A plain JS object used as the YAML mapping representation.
type YamlMap = Record<string, unknown>;

interface YamlLine {
  indent: number;
  key: string;
  /** null ⟹ this is a mapping key whose value is a nested block. */
  value: string | null;
  lineNumber: number;
}

/**
 * Convert a YAML string into a nested `YamlMap` using a single-pass
 * indentation-stack algorithm.
 */
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

    // YAML directives and document markers
    if (stripped.startsWith('%') || stripped === '---' || stripped === '...') {
      inBlockScalar = false;
      continue;
    }

    // Empty lines and full-line comments
    if (!stripped || stripped.startsWith('#')) continue;

    const indent = raw.length - raw.trimStart().length;

    // Block scalar continuation: skip indented content lines.
    if (inBlockScalar) {
      if (indent > blockScalarIndent) continue;
      inBlockScalar = false;
      blockScalarIndent = -1;
    }

    // YAML sequence items — not needed for path/method extraction.
    if (stripped.startsWith('- ') || stripped === '-') continue;

    const parsed = parseYamlKeyValue(stripped);
    if (parsed === null) continue;

    const { key, rawValue } = parsed;

    // Block scalar markers
    if (rawValue === '|' || rawValue === '>') {
      parsedLines.push({ indent, key, value: '', lineNumber });
      inBlockScalar = true;
      blockScalarIndent = indent;
      continue;
    }

    const value =
      rawValue === null ? null : unquoteYamlString(stripYamlInlineComment(rawValue));

    parsedLines.push({ indent, key, value, lineNumber });
  }

  // Build nested object using an indent stack.
  // Each stack frame holds the object being populated and the indent level
  // of the key line that created it.
  const root: YamlMap = {};
  const stack: Array<{ indent: number; obj: YamlMap }> = [{ indent: -1, obj: root }];

  for (const line of parsedLines) {
    // Pop frames whose indent >= this line's indent (they are siblings/closed).
    while (stack.length > 1 && stack[stack.length - 1].indent >= line.indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].obj;

    if (line.value === null) {
      // Mapping key with a nested block as value.
      const nested: YamlMap = {};
      parent[line.key] = nested;
      stack.push({ indent: line.indent, obj: nested });
    } else {
      parent[line.key] = line.value;
    }
  }

  return { root, errors };
}

/**
 * Parse a single trimmed YAML line into its key and raw value (before
 * inline-comment stripping or unquoting).
 *
 * Returns `null` for lines that are not recognisable key: value pairs.
 */
function parseYamlKeyValue(
  trimmed: string,
): { key: string; rawValue: string | null } | null {
  // Quoted key: "key": value  or  'key': value
  if (trimmed.startsWith('"') || trimmed.startsWith("'")) {
    const quote = trimmed[0];
    const closeIdx = trimmed.indexOf(quote, 1);
    if (closeIdx === -1) return null; // unclosed quote — skip

    const key = trimmed.slice(1, closeIdx);
    const afterKey = trimmed.slice(closeIdx + 1).trimStart();
    if (!afterKey.startsWith(':')) return null;

    const afterColon = afterKey.slice(1).trim();
    return { key, rawValue: afterColon === '' ? null : afterColon };
  }

  // Unquoted key: find the first colon.
  const colonIdx = trimmed.indexOf(':');
  if (colonIdx === -1) return null;

  const key = trimmed.slice(0, colonIdx).trim();
  const afterColon = trimmed.slice(colonIdx + 1).trim();

  // Inline empty flow mapping {} or flow sequence [] — treat as empty nested object.
  // This handles the common OpenAPI pattern "paths: {}" and "operation: {}".
  if (afterColon === '{}' || afterColon === '[]') {
    return { key, rawValue: null }; // null → nested block (empty map) pushed onto stack
  }

  return { key, rawValue: afterColon === '' ? null : afterColon };
}


/**
 * Remove a trailing inline YAML comment from a scalar value string.
 * Quoted strings are left untouched (the comment character inside quotes
 * is part of the value).
 */
function stripYamlInlineComment(value: string): string {
  if (value.startsWith('"') || value.startsWith("'")) return value;
  const commentIdx = value.indexOf(' #');
  return commentIdx !== -1 ? value.slice(0, commentIdx).trimEnd() : value;
}

/**
 * Remove surrounding single or double quotes from a YAML scalar.
 * Does not handle escaped quotes inside the value (not needed for OpenAPI).
 */
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
// Endpoint extraction — shared by JSON and YAML paths
// ---------------------------------------------------------------------------

/** True for plain objects (not arrays, not `null`). */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Return `value` when it is an array, otherwise an empty array. */
function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Prefix a Swagger 2.0 `basePath` onto a path key, collapsing redundant
 * slashes. An empty or `/` basePath leaves the path untouched.
 */
function joinBasePath(basePath: string, pathKey: string): string {
  const base = basePath.replace(/^\/+/, '').replace(/\/+$/, '');
  if (!base) return pathKey;
  return `/${base}${pathKey.startsWith('/') ? pathKey : `/${pathKey}`}`;
}

/**
 * Validate a parsed spec object and extract endpoint stubs from its `paths` block.
 *
 * Dispatches to the Swagger 2.0 path when the document carries a string
 * `swagger` field; otherwise applies OpenAPI 3.x validation.
 *
 * @param spec             - Raw parsed value (from JSON.parse or the YAML parser).
 * @param existingErrors   - Errors already accumulated during parsing.
 * @param existingWarnings - Warnings already accumulated during parsing.
 */
function extractEndpoints(
  spec: unknown,
  existingErrors: ParseError[],
  existingWarnings: ParseError[] = [],
): ParseResult {
  if (!isRecord(spec)) {
    return {
      endpoints: [],
      errors: [
        ...existingErrors,
        { message: 'The file does not contain a valid OpenAPI object at the root level.' },
      ],
      warnings: existingWarnings,
      source: 'openapi3',
    };
  }

  // ── Swagger 2.0 ─────────────────────────────────────────────────────────
  if (typeof spec['swagger'] === 'string') {
    return extractSwagger2Endpoints(spec, existingErrors, existingWarnings);
  }

  // ── OpenAPI 3.x version validation ──────────────────────────────────────
  const openapiVersion = spec['openapi'];

  if (typeof openapiVersion !== 'string') {
    return {
      endpoints: [],
      errors: [
        ...existingErrors,
        {
          message:
            'Missing "openapi" field. This parser only supports OpenAPI 3.x and Swagger 2.0 specifications.',
        },
      ],
      warnings: existingWarnings,
      source: 'openapi3',
    };
  }

  if (!openapiVersion.startsWith('3.')) {
    return {
      endpoints: [],
      errors: [
        ...existingErrors,
        {
          message: `Unsupported OpenAPI version "${openapiVersion}". Only OpenAPI 3.x and Swagger 2.0 are supported.`,
        },
      ],
      warnings: existingWarnings,
      source: 'openapi3',
    };
  }

  return {
    endpoints: collectEndpoints(spec['paths'], {
      basePath: '',
      warnOnUnsupportedParameters: false,
      warnings: existingWarnings,
      errors: existingErrors,
      warnedMessages: new Set(),
    }),
    errors: existingErrors,
    warnings: existingWarnings,
    source: 'openapi3',
  };
}

/**
 * Extract endpoints from a Swagger 2.0 document.
 *
 * `basePath` is prefixed to every path, and query / path / body parameters are
 * mapped onto each stub. Anything the ParsedEndpoint shape cannot carry is
 * reported through `warnings` so the import still succeeds.
 */
function extractSwagger2Endpoints(
  spec: Record<string, unknown>,
  existingErrors: ParseError[],
  existingWarnings: ParseError[],
): ParseResult {
  const warnings = [...existingWarnings];
  const version = spec['swagger'];

  if (version !== '2.0') {
    return {
      endpoints: [],
      errors: [
        ...existingErrors,
        {
          message: `Unsupported Swagger version "${String(version)}". Only Swagger 2.0 is supported.`,
        },
      ],
      warnings,
      source: 'swagger2',
    };
  }

  // `consumes` / `produces` describe request/response media types, which the
  // ParsedEndpoint shape has no field for. Warn rather than fail so the
  // endpoints themselves still import.
  for (const feature of ['consumes', 'produces'] as const) {
    if (feature in spec) {
      warnings.push({
        message: `Swagger 2.0 "${feature}" media types cannot be represented in the imported endpoints and were ignored.`,
      });
    }
  }

  const basePath = typeof spec['basePath'] === 'string' ? spec['basePath'] : '';

  return {
    endpoints: collectEndpoints(spec['paths'], {
      basePath,
      warnOnUnsupportedParameters: true,
      warnings,
      errors: existingErrors,
      warnedMessages: new Set(),
    }),
    errors: existingErrors,
    warnings,
    source: 'swagger2',
  };
}

/**
 * Walk a `paths` block (2.0 or 3.x) and return one stub per HTTP operation.
 *
 * A missing / invalid `paths` value is not fatal: Swagger treats the block as
 * optional, so the caller simply receives no endpoints.
 */
function collectEndpoints(
  paths: unknown,
  options: EndpointCollectionOptions,
): ParsedEndpoint[] {
  if (paths === undefined || paths === null) return [];

  if (!isRecord(paths)) {
    options.errors.push({ message: 'The "paths" field is present but is not a valid object.' });
    return [];
  }

  const endpoints: ParsedEndpoint[] = [];

  for (const [pathKey, pathItem] of Object.entries(paths)) {
    if (!isRecord(pathItem)) continue;

    for (const methodKey of Object.keys(pathItem)) {
      if (!HTTP_METHODS.has(methodKey.toLowerCase())) continue;

      const operation = pathItem[methodKey];
      const op = isRecord(operation) ? operation : null;
      const summary = op && typeof op['summary'] === 'string' ? op['summary'] : undefined;
      const parameters = collectParameters(pathItem, op, options);

      endpoints.push({
        path: joinBasePath(options.basePath, pathKey),
        method: methodKey.toUpperCase(),
        ...(summary !== undefined ? { summary } : {}),
        ...(parameters.length > 0 ? { parameters } : {}),
      });
    }
  }

  return endpoints;
}

/**
 * Merge path-item and operation parameter declarations into a single list.
 *
 * Operation-level declarations win over path-item ones with the same
 * `in` + `name`, matching the Swagger 2.0 / OpenAPI 3.x override rules.
 * Locations that cannot be represented (`header`, `formData`, …) are skipped;
 * for 2.0 they additionally produce a warning.
 */
function collectParameters(
  pathItem: Record<string, unknown>,
  operation: Record<string, unknown> | null,
  options: EndpointCollectionOptions,
): ParsedEndpointParameter[] {
  const parameters: ParsedEndpointParameter[] = [];
  const seen = new Set<string>();

  const warn = (message: string) => {
    // Keep the warning list short and deterministic: at most one entry per
    // distinct message, regardless of how many operations trigger it.
    if (!options.warnedMessages.has(message)) {
      options.warnedMessages.add(message);
      options.warnings.push({ message });
    }
  };

  const declarations = [
    ...asArray(operation?.['parameters']),
    ...asArray(pathItem['parameters']),
  ];

  for (const declaration of declarations) {
    if (!isRecord(declaration)) {
      if (options.warnOnUnsupportedParameters) {
        warn('Skipped a Swagger 2.0 parameter that could not be resolved (unresolved $ref or malformed entry).');
      }
      continue;
    }

    const name = typeof declaration['name'] === 'string' ? declaration['name'] : undefined;
    const location = typeof declaration['in'] === 'string' ? declaration['in'] : undefined;

    if (!name || !location) {
      if (options.warnOnUnsupportedParameters) {
        warn('Skipped a Swagger 2.0 parameter that could not be resolved (unresolved $ref or malformed entry).');
      }
      continue;
    }

    if (!SUPPORTED_PARAM_LOCATIONS.has(location)) {
      if (options.warnOnUnsupportedParameters) {
        warn(`Swagger 2.0 parameter location "${location}" is not supported and was skipped.`);
      }
      continue;
    }

    const key = `${location}:${name}`;
    if (seen.has(key)) continue;
    seen.add(key);

    parameters.push({
      name,
      in: location,
      // `path` parameters are required by definition in both specifications.
      required: location === 'path' ? true : declaration['required'] === true,
    });
  }

  return parameters;
}
