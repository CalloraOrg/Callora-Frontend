# Endpoint Search

`ApiDetailPage` includes an endpoint search field in the Documentation tab.

The search filters endpoint cards by title, path, HTTP method, group, parameter
name, parameter type, and required/optional status. It is client-side only and
does not change API requests or persisted data.

Accessibility behavior:

- The input is labelled `Search endpoints`.
- The input uses combobox semantics and points to the filtered endpoint results.
- A polite status message announces the current result count.
- The no-results state includes a clear-filters action.
