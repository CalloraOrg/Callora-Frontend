# State Management

This guide describes the state and persistence patterns currently used under `src/state`. It is an inventory of current behavior; the stores do not all have the same persistence or synchronization guarantees.

## Current State Modules

| Module | API and purpose | Storage | Cross-tab behavior |
| --- | --- | --- | --- |
| `compareStore.ts` | `compareStore` exposes `addApi`, `removeApi`, `setOpen`, `clear`, `subscribe`, and `getSnapshot`; `useCompareStore()` subscribes React components through `useSyncExternalStore`. The comparison list is capped at three unique APIs. | `localStorage` key `callora_compare_state` stores the APIs and open state. | A subscribed store listens for `storage` events for this key and applies non-empty values. Removing the key is not applied by this handler. |
| `collectionsStore.tsx` | `CollectionsProvider` owns collection state with `useReducer`; `useCollections()` exposes state, collection actions, and derived queries. It must be called below the provider. | `localStorage` key `callora_collections`; the provider loads on initialization and persists on state changes. | No cross-tab listener or synchronization. |
| `accountStore.ts` | Exposes `getCurrentAccount`, `getCurrentAccountId`, `getKnownAccounts`, `switchAccount`, `addAccount`, and `subscribe`. `_reset` and `_load` support tests. | `callora_current_account` stores the selected account ID; `callora_known_accounts` stores the account list, including each account's `apiKey`. | Subscribers are notified for changes made through this module in the same tab. It does not listen for cross-tab `storage` events. |
| `pinnedApis.ts` | `pinnedApisStore` exposes `pin`, `unpin`, `toggle`, `isPinned`, `subscribe`, and `getSnapshot`; `usePinnedApis()` uses `useSyncExternalStore`. | `localStorage` key `callora_pinned_apis` stores an array of API IDs. | A subscribed store listens for `storage` events for this key and applies valid non-empty arrays. Removing the key is not applied by this handler. |
| `quotaStore.ts` | `quotaStore` is a singleton `QuotaStore`. Its public actions are `selectAccount`, `refresh`, `update`, `retry`, and `getSlice`; consumers can use its `subscribe`/`getSnapshot` interface. Values are authoritative only after server confirmation. | Quota records are not persisted to localStorage. The default channel name is `callora-quota`; when `BroadcastChannel` is unavailable, that key is used temporarily to signal changes and is immediately removed. | Successful server updates are broadcast through `BroadcastChannel`, with a storage-event fallback. Other tabs accept only newer versions and surface conflicts with local pending updates. |
| `uiPrefs.ts` | Getter/setter functions for density, plus collapsed-filter-section getters and setters. These functions read the current value when called; they are not a subscribed React store. | `callora.density` stores density; `callora.filters.collapsed` stores collapsed section IDs. | No cross-tab subscription. Another tab's stored value is visible on the next getter call, but this module does not notify or update React automatically. |
| `userPrefs.ts` | `getDefaultCodeLanguage` and `setDefaultCodeLanguage` read and write the shared code-example language preference. | `callora:codeExample:language` stores a JSON-encoded language string. | No cross-tab subscription or notification. |
| `testCallHistory.ts` | `loadHistory`, `saveEntry`, and `clearHistory` manage the bounded test-call history. This is a persistence helper, not a reactive store. | `callora_test_call_history` stores up to 50 entries. | No cross-tab subscription or notification. |

## Choosing a Pattern

For new state owned by the React UI, use **Context + `useReducer`** as the default: define the state and actions near their provider, expose them through a hook, and add persistence in that owner only when the state should survive reloads. Keep storage access behind the state API rather than adding independent localStorage reads and writes in components.

Use `useSyncExternalStore` when state genuinely needs to live outside React (for example, a framework-independent singleton or state shared with non-React code). Keep its `subscribe` and `getSnapshot` behavior stable, define its persistence and cross-tab semantics explicitly, and test those semantics. Do not introduce a second storage key for state already owned by an existing store.

Persistence alone does not provide cross-tab synchronization. A store must listen for `storage` events or use an explicit channel, and a React component must subscribe to changes if it needs to rerender. Document whether clearing a key is handled, not just writes.

## Testing

- Run the state tests with `npm test -- --run src/state`.
- `accountStore.test.ts`, `pinnedApis.test.ts`, `quotaStore.test.ts`, `uiPrefs.test.ts`, and `userPrefs.test.ts` cover existing state behavior. The `src/state` directory currently has no dedicated tests for `compareStore`, `collectionsStore`, or `testCallHistory`.
- `quotaTestUtils.ts` exports `makeFakeApi` for controlling fetch/update resolution and failure, `linkedChannels` for deterministic two-tab channel tests, and `tick` for flushing scheduled work. `quotaStore.test.ts` uses these helpers to cover request ordering, conflicts, and cross-tab synchronization.
- `pinnedApisStore._reset()` resets in-memory state for tests without clearing localStorage. `accountStore._reset()` resets state and subscribers; `_load()` reloads from localStorage. Tests should clear storage separately when needed.