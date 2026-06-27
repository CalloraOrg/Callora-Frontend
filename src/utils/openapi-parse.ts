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
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

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
 * extraction succeeds alongside non-fatal issues.
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
    return { endpoints: [], errors };
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

/**
 * Validate a parsed spec object and extract endpoint stubs from its `paths` block.
 *
 * @param spec           - Raw parsed value (from JSON.parse or the YAML parser).
 * @param existingErrors - Errors already accumulated during parsing.
 */
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

  // ── Version validation ──────────────────────────────────────────────────
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

  // ── Paths block ─────────────────────────────────────────────────────────
  const paths = specObj['paths'];

  if (paths === undefined || paths === null) {
    // A spec with no paths block is valid per the OpenAPI 3.x spec.
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

  for (const [pathKey, pathItem] of Object.entries(pathsObj)) {
    if (typeof pathItem !== 'object' || pathItem === null) continue;

    const pathItemObj = pathItem as Record<string, unknown>;

    for (const methodKey of Object.keys(pathItemObj)) {
      if (!HTTP_METHODS.has(methodKey.toLowerCase())) continue;

      const operation = pathItemObj[methodKey];
      let summary: string | undefined;

      if (typeof operation === 'object' && operation !== null) {
        const op = operation as Record<string, unknown>;
        if (typeof op['summary'] === 'string') {
          summary = op['summary'];
        }
      }

      endpoints.push({
        path: pathKey,
        method: methodKey.toUpperCase(),
        ...(summary !== undefined ? { summary } : {}),
      });
    }
  }

  return { endpoints, errors: existingErrors };
}
