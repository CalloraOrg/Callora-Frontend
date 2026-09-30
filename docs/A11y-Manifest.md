# Accessibility Manifest Guide

The Accessibility Audit board at `/a11y-audit` is driven entirely by
`src/data/a11y-manifest.json`. This guide documents the manifest's fields, the
precise meaning of each status, and who is responsible for keeping the board
current.

## Why this matters

`src/pages/A11yAudit.tsx` reads the manifest to render the board's cards and the
summary counters. A component that ships without a manifest entry is invisible
on the board, and the audited percentage silently under-reports coverage. The
board goes stale the moment a component is added or its audit state changes
without a matching manifest update.

## File

`src/data/a11y-manifest.json`

## Schema

The JSON object has a single required key, `components`, whose value is an array
of entries:

| Field    | Required | Type                                        | Description                                                                                                                                     |
| -------- | -------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`     | yes      | string                                      | Stable, unique identifier for the component. Used as the React list key and for de-duplication. Conventionally the component's name.            |
| `name`   | yes      | string                                      | Display label rendered on the card.                                                                                                             |
| `status` | yes      | `"audited"` \| `"needs-work"` \| `"n/a"`     | The component's current audit state. See [Status definitions](#status-definitions).                                                             |
| `docs`   | no       | string                                      | Path relative to `docs/`. When present, the board renders `name` as a link to `docs/<value>` (for example `"docs": "MethodChip.md"`).           |

Example entry:

```json
{ "id": "SearchBar", "name": "SearchBar", "status": "audited" }
```

## Status definitions

Each status has exactly one meaning. Use these definitions rather than a
best guess:

- **`audited`** — The component has been reviewed against WCAG 2.1 AA and every
  finding raised by that review has been resolved. "Reviewed" covers keyboard
  operability, screen-reader semantics, color contrast, focus visibility, and
  touch-target sizing. A component with an open finding is **not** `audited`,
  regardless of how small the finding is.
- **`needs-work`** — The component is user-facing and in scope for the audit,
  but one or more known accessibility findings are still open. Every
  user-facing component starts here until its audit is complete.
- **`n/a`** — The component is intentionally out of scope for the WCAG audit.
  Reserve this for components that users never interact with directly, such as
  internal-only views, demo scaffolding, or non-presentational plumbing. Do not
  use `n/a` to sidestep a real, unresolved finding on a user-facing component.

### How statuses affect the summary

The board counts every status and computes
`Audited (%) = round(audited / total × 100)`, where `total` is the number of
entries **including** `n/a`. A component moved to `n/a` therefore still counts
in the denominator. Keep this in mind before marking something `n/a`: it is an
exclusion from auditing, not from the board.

## When to update the manifest

- **Adding a user-facing component** — add an entry with `status: "needs-work"`
  (or `"audited"` if it has genuinely completed an audit).
- **Completing or re-opening an audit** — flip the `status` to match reality.
- **Removing a component** — remove its entry so the board does not advertise a
  component that no longer exists.
- **Marking a component `n/a`** — add a `docs` note explaining why, unless the
  reason is obvious from the component's name.

## Who updates it

The author of the pull request that adds, removes, or re-audits a component is
responsible for the matching manifest change in the same PR. Reviewers should
treat a missing or stale entry as a blocking review comment.

## Pull request checklist

- [ ] Every component added or changed by this PR has a manifest entry.
- [ ] Each entry's `status` reflects the component's actual, current audit state
      (see [Status definitions](#status-definitions)).
- [ ] Removed components have had their entries removed.
- [ ] Any non-obvious `n/a` entry carries a `docs` note explaining the exclusion.
- [ ] `npm test -- --run` still passes.
