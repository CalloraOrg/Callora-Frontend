# Accessibility Audit Manifest — Upkeep Rules

`src/data/a11y-manifest.json` is the single source of truth for the
[Accessibility Audit Board](../src/pages/A11yAudit.tsx) (`/a11y-audit`). The board
renders exactly what the manifest contains, so the manifest must be kept in step
with the component library. This document explains every field, defines each
status precisely, and states when and by whom the manifest is updated.

## Manifest shape

```json
{
  "components": [
    { "id": "ApiCard", "name": "ApiCard", "status": "audited" }
  ]
}
```

Every entry is one line, ordered by `id`, and describes a single component.

## Fields

| Field    | Type   | Required | Description |
| :------- | :----- | :------- | :---------- |
| `id`     | string | Yes      | Stable, unique identifier for the component. Use the exact exported component name (e.g. `SearchBar`). Used as the React list key and for de-duplication — never reuse or rename an `id` for a different component. |
| `name`   | string | Yes      | Human-readable label shown on the audit card. Normally identical to `id`; only differs when the display name includes spaces or punctuation. |
| `status` | string | Yes      | Current audit state. Must be exactly one of `audited`, `needs-work`, or `n/a` (see below). Lowercase; `n/a` keeps the slash. |
| `docs`   | string | No       | Filename of the component's documentation, relative to `docs/` (e.g. `SearchBar.md`). When present, the board renders `name` as a link to `docs/<value>`. Omit when the component has no doc. |

## Status definitions

The three values are mutually exclusive and must be applied consistently.

- **`audited`** — The component has been reviewed against **WCAG 2.1 AA** and
  currently satisfies every applicable success criterion (keyboard access,
  visible focus, semantic roles/names, contrast, non-colour cues, reduced-motion
  handling, etc.). No known accessibility work is outstanding. Choose this only
  after an actual review of the rendered component in both light and dark themes.

- **`needs-work`** — The component has been reviewed but **one or more WCAG 2.1 AA
  issues are known to remain** (for example, a missing accessible name, an
  unreachable control, or insufficient contrast). The gap is understood and
  trackable; the component is not yet conformant. Pair the entry with a follow-up
  issue so the status can move to `audited` when fixed.

- **`n/a`** — A component-level audit does **not apply**. Use this for entries
  that are not a reusable, user-facing design-system component eligible for the
  audit — for example full-page error shells, page compositions, demos, or
  placeholders. `n/a` is a deliberate classification, not "not checked yet": if a
  component still needs reviewing, it is `needs-work`, not `n/a`. Entries remain
  listed (and are included in the board totals) so the board stays a complete
  inventory.

## When to add or update an entry

Update the manifest in the **same pull request** that changes the component
library:

- **Add** an entry when a new component is added to `src/components/` (or a new
  shared UI component is introduced anywhere in `src/`).
- **Re-classify** the entry when a component's audit state changes — e.g.
  `needs-work` → `audited` once a fix lands.
- **Remove** an entry only when the component itself is deleted.

Do not add entries for icons, hooks, utilities, or other non-visual modules.

## Who updates it

The **author of the pull request that adds or changes the component** is
responsible for updating the manifest. Maintainers verify the entry during PR
review (see the checklist in [`CONTRIBUTING.md`](../CONTRIBUTING.md)). If you are
unsure which status applies, record `needs-work` with a linked issue rather than
leaving the component off the board.

## Example

Adding a new `Toast` component and auditing it would append:

```json
{ "id": "Toast", "name": "Toast", "status": "audited" }
```

A component with a known, tracked gap:

```json
{ "id": "Toast", "name": "Toast", "status": "needs-work" }
```
