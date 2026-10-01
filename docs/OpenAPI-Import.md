# OpenAPI Import

The Callora OpenAPI importer uses a lightweight parser designed to extract endpoint stubs (paths, HTTP methods, and summaries) from the `paths` block of an OpenAPI document. It does not perform full schema validation.

## Supported Versions
* **OpenAPI 3.x** is supported.
* OpenAPI 2.x (Swagger) is not supported.

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
The parser does not resolve `$ref` pointers.
* It only extracts stubs directly defined in the `paths` block.
* If an endpoint's operations or summaries are defined externally via `$ref`, they will not be automatically resolved or included in the import preview.

## Error Reporting
The importer captures errors and displays them inline:
* **Unsupported file extension**: Emits an error if the file is not `.json`, `.yaml`, or `.yml`.
* **JSON Syntax Errors**: Displays the native syntax error message, including the 1-based line number if the runtime provides position information (e.g. V8 or SpiderMonkey).
* **YAML Structural Errors**: Displays an error with the 1-based line number of the first problem the custom parser detects.
* **Validation Errors**: Missing or incorrect `openapi` version fields will produce a validation error. A missing `paths` block is considered valid per spec but results in 0 endpoints.
