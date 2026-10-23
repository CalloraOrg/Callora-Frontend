# OpenAPI Import

The Callora OpenAPI importer uses a lightweight parser designed to extract endpoint stubs (paths, HTTP methods, and summaries) from the `paths` block of an OpenAPI document. It does not perform full schema validation.

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

## Error Reporting
The importer captures errors and displays them inline:
* **Unsupported file extension**: Emits an error if the file is not `.json`, `.yaml`, or `.yml`.
* **JSON Syntax Errors**: Displays the native syntax error message, including the 1-based line number if the runtime provides position information (e.g. V8 or SpiderMonkey).
* **YAML Structural Errors**: Displays an error with the 1-based line number of the first problem the custom parser detects.
* **Validation Errors**: Missing or incorrect `openapi` version fields will produce a validation error. A missing `paths` block is considered valid per spec but results in 0 endpoints.
