/**
 * toCurl — build a copy-pasteable `curl` command from a structured HTTP request.
 *
 * The output is intentionally readable (one option per line via `\` line
 * continuations) and shell-safe: every dynamic value is single-quoted and any
 * embedded single quotes are escaped using the standard `'\''` trick.
 */

export type CurlRequest = {
  /** HTTP method. Defaults to "GET". */
  method?: string;
  /** Full request URL. */
  url: string;
  /** Header map. Order is preserved as provided. */
  headers?: Record<string, string>;
  /**
   * Optional request body. Objects are JSON-stringified; strings are sent
   * verbatim. Ignored for GET/HEAD.
   */
  body?: unknown;
};

const BODILESS_METHODS = new Set(["GET", "HEAD"]);

/** Single-quote a value for safe use in a POSIX shell. */
function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Serialize a request body to a string suitable for `--data`. */
function serializeBody(body: unknown): string {
  if (typeof body === "string") return body;
  return JSON.stringify(body);
}

/**
 * Convert a {@link CurlRequest} into a multi-line `curl` command string.
 */
export function toCurl(request: CurlRequest): string {
  const method = (request.method ?? "GET").toUpperCase();
  const lines: string[] = [`curl -X ${method} ${shellQuote(request.url)}`];

  for (const [name, value] of Object.entries(request.headers ?? {})) {
    if (!name) continue;
    lines.push(`-H ${shellQuote(`${name}: ${value}`)}`);
  }

  const hasBody =
    request.body !== undefined &&
    request.body !== null &&
    !BODILESS_METHODS.has(method);

  if (hasBody) {
    lines.push(`--data ${shellQuote(serializeBody(request.body))}`);
  }

  return lines.join(" \\\n  ");
}

export default toCurl;
