# Performance audit — Runyth Garb & Grime 1.0.10

## Scope

The complete production source tree was reviewed for synchronous bottlenecks, unbounded asynchronous work, repeated Foundry document operations, unnecessary cloning and serialization, repeated event binding, redundant ApplicationV2 rendering, and avoidable canvas work.

The patch does not change the Actor-state schema, public API signatures, permissions, automation rules, chat visibility, or default behavior.

## Findings and corrections

### Bulk and world-wide operations

Several Actor and Token workflows awaited each independent document operation sequentially. Replacing these with unrestricted `Promise.all` would risk flooding Foundry's document and socket pipelines.

A shared bounded mapper now processes independent work with a conservative default concurrency of four while preserving input order. It is used by:

- Manager Actor and selected-Token actions;
- Actors-sidebar bulk changes;
- Scene Control bulk changes;
- automatic activity, context, combat-end, and world-day processing;
- party maintenance changes;
- Actor migrations;
- module-owned Active Effect refreshes;
- selected-Token label overrides.

Operations affecting the same Actor remain sequential where ordering is semantically important.

### Application rendering

Actor updates, Scene context changes, definition reloads, and rapid action sequences could request the same ApplicationV2 render repeatedly.

Reactive renders are now coalesced into one browser animation frame. Explicit tab changes continue to render immediately so navigation remains deterministic and responsive.

### Manager preparation

The Cleanliness Manager previously prepared Actor rows, scent evaluations, transaction dates, profile choices, and rules markup on every tab.

Version 1.0.10 prepares only the active tab's data:

- Actor rows are omitted from Rules, Transactions, and Settings tabs.
- Full Actor-row details are prepared only on the Actors tab.
- Overview rows use a reduced representation.
- Scent evaluation runs only where the overview displays it.
- One prepared Scene profile and one contamination-definition map are reused across overview rows.
- Transaction dates and rules markup are generated only on their respective tabs.

### Global Module Settings preparation

The settings application previously formatted all cleaning methods, profiles, contaminations, user permission matrices, localization status, Token-label state, and currency adapters on every tab render.

Each category now loads and formats only its own data. Large custom definition lists and user permission matrices therefore do not affect unrelated tabs.

### Settings retrieval

Merged configuration and permission objects were repeatedly deep-cloned and merged in hot paths such as Token rendering and roll evaluation.

The merged values are cached and invalidated through the registered Foundry setting `onChange` handlers. A mutation-safe fingerprint fallback remains for tests and nonstandard settings implementations that do not expose Foundry's registered settings collection.

### Token cleanliness labels

Token movement and refresh hooks previously repeated state normalization, text formatting, style calculation, and display-object work more often than required.

The label service now:

- coalesces canvas events into one animation frame;
- distinguishes full refreshes from position-only refreshes;
- reads configuration and global visibility once per frame;
- coalesces multiple requests for the same Token;
- refreshes an Actor only when Runyth Garb & Grime Actor flags change;
- avoids a redundant controlled-Token hook;
- invalidates pending frame work safely during canvas teardown;
- reuses one display object per Token.

### Event listeners

The Manager previously attached listeners to individual controls after every render. It now uses two delegated listeners on its own root and an `AbortController` to remove the previous render's listeners before rebinding. Closing the Manager aborts listeners and pending filter timers.

Existing sheet, sidebar, Item, and Token HUD integrations already guard their injected roots and remain idempotent.

### Active Effects

Every state update previously invoked Active Effect reconciliation, including changes to GM notes, upkeep debt, automatic-maintenance preference, and other fields that cannot alter a module effect.

Reconciliation now runs only when dirt level, body/clothing clean status, groomed expiry, or visible contamination membership changes. Existing idempotent create/update/delete reconciliation remains intact.

### Transactions and Item consumption

Concurrent actions could each rewrite the complete transaction-log setting. Entries produced in the same task are now queued and flushed together, while arrivals during a write are handled by the same serialized flush loop.

When one action consumes multiple embedded Items from the same Actor, quantities are updated through one `updateEmbeddedDocuments` call. Single-item and compatibility fallbacks retain the established Item update path.

### Registry reads and rule evaluation

Internal read-only consumers now request registry definitions without defensive cloning. Public registry and API calls still clone by default.

Contamination lookup during effective-dirt evaluation accepts a prepared map, avoiding repeated linear searches when the Manager evaluates several Actors.

### Window persistence

Window position writes are debounced, skipped when values are unchanged, and serialized across module windows. This prevents overlapping client-setting writes from losing another window's saved position.

### Small allocation reductions

The audit also removed avoidable intermediate arrays and repeated calls in Actor deduplication, primary-GM selection, Item alias matching, cleaning timestamps, masking timestamps, Actor-row naming, and configuration retrieval.

## Intentionally unchanged

- Foundry hooks remain synchronous wrappers around contained asynchronous work because Foundry does not await Hook callbacks.
- State changes for one Actor are not parallelized internally.
- Active Effect delete, update, and create phases remain ordered to avoid conflicting embedded-document operations.
- Explicit user navigation renders immediately.
- Public API return values retain defensive cloning by default.
- No Web Worker was introduced because the module's work is primarily Foundry document I/O and small UI transformations rather than large CPU-bound computation.

## Validation

Automated coverage includes:

- bounded concurrency and stable result ordering;
- frame-coalesced Application rendering;
- merged-setting cache reuse and invalidation;
- delegated Manager listener lifecycle;
- Token-label frame coalescing and teardown invalidation;
- transaction-log write batching;
- skipped Active Effect reconciliation for non-visual state changes;
- multi-Item embedded-document updates;
- existing state, chat, permissions, localization, Tidy 5e, Token-label, and Foundry V13 compatibility tests.

Live profiling with a specific Foundry world and module stack remains environment-dependent. The manual checklist includes high-Actor-count, rapid movement, bulk action, multi-client, and repeated window-operation scenarios.
