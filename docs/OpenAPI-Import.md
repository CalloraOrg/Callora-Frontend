# OpenAPI Import

The Callora OpenAPI importer uses a lightweight parser designed to extract endpoint stubs (paths, HTTP methods, and summaries) from the `paths` block of an OpenAPI document. It does not perform full schema validation.

Parsing runs in a **Web Worker** (issue #1394) so that large specifications never block the main thread or freeze animations. A progress indicator is shown while parsing; a **Cancel** button aborts the parse at any time and returns to the idle state.

## File Size Limit

Files larger than **5 MB** are rejected before posting to the worker. The error message shows the file's actual size and the limit.

## Import Methods

### File Upload
Drag and drop a file onto the drop zone, or click **Browse files** to open the file picker. Accepted extensions: `.json`, `.yaml`, `.yml`. Keyboard users can press `Enter` or `Space` on the drop zone to open the picker.

### Import from URL
Type or paste a URL into the **Or import from a URL** field and press `Enter` or click **Fetch**. While the request is in progress, a **Cancel** button aborts the fetch.

**URL rules:**
- Only `https://` URLs are accepted. `http://localhost` (and `http://127.0.0.1`) is also permitted for local development.
- `http://` URLs pointing to non-localhost hosts are rejected without a network request.
- `javascript:`, `file:`, and all other non-HTTP schemes are rejected without a network request.
- URLs must not contain a username or password (embedded credentials are rejected).

**Limits:**
- Timeout: 10 seconds. If the server does not respond in time, the fetch is aborted and an error is shown.
- Size cap: 2 MiB. Enforced by both the `Content-Length` response header and by reading the body incrementally. Responses that exceed the limit are rejected mid-stream.

**CORS failures:** When a `TypeError` is thrown (the most common symptom of a browser CORS block), the error message reads: *"The server may not allow cross-origin requests; download the file and upload it instead."* In that case, save the file locally and use the file-upload path.

**Filename derivation:** The importer derives a filename (`.json` / `.yaml` / `.yml`) from the URL path. When the URL path carries no recognised extension, the `Content-Type` response header is used as a fallback. This filename is passed to the parser so it can select the correct JSON or YAML path.

## Supported Versions
* **OpenAPI 3.x** is supported.
* **Swagger 2.0** is supported and converted into the same endpoint stubs (issue #1075):
  * `basePath` is prefixed to every path.
  * `query`, `path` and `body` parameters are imported (operation-level declarations override path-item ones).
  * Features the stubs cannot represent — `consumes` / `produces` media types, `header` / `formData` parameters, unresolved `$ref`s — are listed as non-fatal warnings in the preview instead of failing the import.
  * The preview shows a "Converted from Swagger 2.0" notice.
* Other Swagger versions (e.g. 1.2) are rejected.

## YAML Subset
To ensure fast and reliable extraction in the browser without large dependencies, the parser supports a specific subset of YAML. 

**Supported Features:**
* Block mappings (`key: value`) at any indentation depth
* Quoted mapping keys (single and double quotes)
* Quoted scalar values
* Inline comments (`# comment`)
* Document separators (`---` / `...`)
* Block scalar markers (`|` and `>`) — content is skipped
* YAML directives (`%YAML`, `%TAG`) — silently skipped

**Unsupported Features (will cause parsing errors or empty results):**
* YAML anchors and aliases (`&anchor` / `*alias`)
* Flow sequences and mappings (`[...]` / `{...}`)
* Multi-document streams
* Path keys with bare colons (e.g. `/foo:bar` must be quoted as `"/foo:bar"`)

## $ref Handling
Local `$ref` pointers (`#/...`) are resolved for path items, parameters and request bodies (issue #1074).
* Cyclic refs, refs nested deeper than 32 levels and refs whose target does not exist are reported as non-fatal problems; the endpoints that did parse are still shown, with the problems listed as warnings.
* Remote or external refs (anything not starting with `#/`) are never fetched and are reported the same way.

## Cancellation
Clicking **Cancel** while the spinner is showing aborts the in-flight parse and terminates the Web Worker immediately. The UI returns to the idle (drop-zone) state without displaying an error. Choosing a second file before the first parse completes automatically cancels the first parse; the stale result is discarded.

## Error Reporting
The importer captures errors and displays them inline:
* **File too large**: Emits an error when the file exceeds 5 MB.
* **Unsupported file extension**: Emits an error if the file is not `.json`, `.yaml`, or `.yml`.
* **JSON Syntax Errors**: Displays the native syntax error message, including the 1-based line number if the runtime provides position information (e.g. V8 or SpiderMonkey).
* **YAML Structural Errors**: Displays an error with the 1-based line number of the first problem the custom parser detects.
* **Validation Errors**: Missing or incorrect `openapi` version fields will produce a validation error. A missing `paths` block is considered valid per spec but results in 0 endpoints.
* **Worker errors**: If the parser throws an unexpected exception inside the worker, a safe generic error is shown without exposing the stack trace.
* **URL Fetch Errors**: Invalid URL, unsupported scheme, embedded credentials, timeout, oversized response, HTTP error status, or CORS/network failure — each produces a specific inline message.
