# Garb & Grime 1.0.8 Compatibility and Interference Audit

## Scope

The complete 1.0.7 production tree, tests, templates, styles, manifest, localization, packaging workflow, and public API were reviewed for Foundry VTT V13 compatibility and interference risks. The existing Actor-state schema and public API remain unchanged.

## Issues found and corrected

### Deprecated global UUID helpers

**Files:** `src/util.mjs`, `src/action-service.mjs`

The module still called the legacy global `fromUuid` and `fromUuidSync` helpers. These calls now use `foundry.utils.fromUuid` and `foundry.utils.fromUuidSync`, matching the V13 namespace.

### Active Effect churn and stale effects

**Files:** `src/effects.mjs`, `src/state-service.mjs`, `src/apps/settings-hub.mjs`

Every cleanliness update previously deleted every Garb & Grime Active Effect and recreated the desired set. This could trigger unnecessary hooks in DAE, Midi-QOL, effect panels, and other modules. Disabling effect mirroring also left existing module effects behind.

The implementation now reconciles effects by their module-owned kind flag:

- unchanged effects remain untouched;
- changed effects update in place;
- obsolete or duplicate effects are deleted;
- missing effects are created;
- disabling mirroring removes stale Garb & Grime effects;
- the Actor flag remains authoritative.

### Hidden-contamination disclosure

**Files:** `src/state-service.mjs`, `src/effects.mjs`

A contamination with `hiddenByDefault` could store itself as hidden while its action-card options still treated it as public. Hidden contamination could also be mirrored into a player-visible Active Effect.

The effective hidden state is now resolved before the change, propagated to the chat card, preserved on reapplication, and excluded from Active Effect mirroring.

### Duplicate automation with multiple GMs

**File:** `src/automation.mjs`

Foundry broadcasts world-time and combat deletion hooks to connected clients. Every active GM could therefore process the same automation. Combat-end and world-day automation are now executed only by the deterministic primary active GM.

Long-rest handling remains local to the client receiving the D&D 5e rest hook so existing behavior is not changed unnecessarily.

### Unhandled asynchronous hook and interaction failures

**Files:** `src/automation.mjs`, `src/integrations/scene-controls.mjs`, `src/integrations/items.mjs`, `src/integrations/sidebar.mjs`, `src/integrations/token-labels.mjs`

Foundry hook callbacks and synchronous UI callback contracts do not necessarily await returned Promises. Async work now runs through explicit contained Promises with module-attributed console errors and Foundry notifications. This prevents rejected Promises from surfacing as unrelated global failures.

### Partial sheet render duplication

**Files:** `src/integrations/actor-sheets.mjs`, `src/integrations/items.mjs`

Tidy 5e and other modern sheets can render partial fragments. The hook fragment was previously preferred over the complete application root, allowing the duplicate guard to miss an existing control. The full `app.element` root is now preferred, with the hook HTML retained as a fallback.

### Manager sorting and search usability

**File:** `src/apps/manager.mjs`

The “last updated” sort compared localized display strings instead of timestamps. Debounced search rerendering could also drop keyboard focus and reset the caret.

Rows now carry a numeric timestamp for chronological sorting. Focus and selection are captured before the rerender and restored afterward. Delayed filter failures are caught and reported.

### Custom-definition deletion and ID collisions

**File:** `src/apps/settings-hub.mjs`

Custom definitions used `array.length + 1`, which could reuse an existing ID after deletion. Deletion also occurred immediately despite being consequential.

New IDs are selected by scanning for the first unused suffix. Custom definition removal now requires an explicit localized DialogV2 confirmation.

### Dialog form readability

**File:** `styles/garb-and-grime.css`

DialogV2 content does not inherit the module application's root class. A narrowly scoped `.gag-dialog-form` rule now provides spacing and field padding to module-owned dialog forms without changing Foundry or other modules' dialogs.

## Areas audited and intentionally unchanged

- Actor sheet integration remains restricted to `renderActorSheet`, `renderActorSheetV2`, and the supported Tidy 5e render hook.
- Item integration remains restricted to Item sheet hooks.
- No generic ApplicationV1/ApplicationV2 render hook was introduced.
- The module registers no deprecated chat-render hook and continues to create one passive card through `ChatMessage.create()`.
- Scene Controls continue to use the Foundry V13 record/tool structure rather than an array `push` contract.
- Token labels remain in a module-owned interface-layer container and do not modify Foundry nameplates.
- CSS remains scoped to Garb & Grime roots or uniquely named integration classes.
- No socket dependency, libWrapper dependency, or cross-module monkey patch was added.
- Actor, Token, Scene, setting, and transaction data formats remain compatible.
- Public API version remains `1.2.0`; state schema remains `1`.

## External errors

No workaround was added for errors attributed by Foundry stacks to other packages. Such packages must migrate their own hooks, DOM assumptions, assets, or Scene Control structures.

## Validation

The release adds behavioral and source-level regression coverage for:

- namespaced UUID helpers;
- full-root partial-render handling;
- idempotent Active Effect reconciliation;
- cleanup when effects are disabled;
- hidden contamination chat and effect privacy;
- deterministic primary-GM automation;
- synchronous hook registration with contained asynchronous failures;
- timestamp sorting and search-focus restoration;
- collision-free custom IDs and destructive-action confirmation.
