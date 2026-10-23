# Add default code sample language pref

## Summary

Adds a dedicated `src/state/userPrefs.ts` module that pins the user's preferred code sample
language and applies it as the default across every `CodeExample` instance on the site, so
picking a language once (e.g. Python) "sticks" the next time a code sample is shown — even for
a different endpoint or a fresh page load.

## Changes

### `src/state/userPrefs.ts` (new)
- `getDefaultCodeLanguage(): string | null` — reads the pinned language from localStorage.
- `setDefaultCodeLanguage(language: string): void` — persists the pinned language.
- SSR-safe (`typeof window` guard) and fails silently on parse errors / unavailable storage,
  matching the pattern used by `usePersistedState` and `src/state/uiPrefs.ts`.
- Storage key: `callora:codeExample:language` (unchanged from the previous implementation, so
  existing users' preferences carry over without migration).

### `src/components/CodeExample.tsx`
- Replaced the generic `usePersistedState` call with `getDefaultCodeLanguage` /
  `setDefaultCodeLanguage`, so the default-language behavior has one documented, testable,
  directly-importable API instead of being embedded inline in the component.
- Resolution order on mount: pinned preference (if valid for this snippet set) → this instance's
  own `defaultLanguage` prop → first available language.
- No change to component props or visible behavior.

### Test Files
- `src/state/userPrefs.test.ts` (new) — covers get/set, malformed JSON, and overwrite behavior.
- `src/components/CodeExample.test.tsx` — unchanged, still passing (19/19), confirming the
  refactor preserved existing behavior (persistence on selection, restoration on remount,
  fallback when the pinned language isn't available in a given snippet set).

## API/Visible Changes

No breaking changes. `CodeExample`'s props are unchanged. The only new public API is
`src/state/userPrefs.ts`'s two exported functions.

## Accessibility

No accessibility-relevant changes — tab roving/ARIA behavior in `CodeExample` is untouched.

## Test Output

```
✓ src/state/userPrefs.test.ts (6 tests)
✓ src/components/CodeExample.test.tsx (19 tests)
```

closes #398
