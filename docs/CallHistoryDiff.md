# Call History Response Diff

Expanded call-history rows can compare the selected call response with the next older call in the filtered history list.

The comparison flattens JSON objects and arrays into stable paths, then marks each path as:

- `added` when it only exists in the selected call response
- `removed` when it only exists in the previous call response
- `changed` when both calls include the path but the value changed

The UI renders those entries below the response payload with accessible labels and kind-specific styling. When the previous and selected responses match, the row shows `No response changes detected.` instead of an empty list.
