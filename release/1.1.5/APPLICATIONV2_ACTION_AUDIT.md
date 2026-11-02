# Runyth Garb & Grime 1.1.5 — ApplicationV2 Action Audit

## Reported failure

`CleanlinessManager.onBulkActorAction` called `this.#selectedModifiableActors()`. The helper was declared `static async #selectedModifiableActors()`, while Foundry ApplicationV2 calls configured actions with the application instance as `this`. JavaScript private-static brand checking therefore rejected the instance receiver and threw `TypeError: Receiver must be class CleanlinessManager`.

## Corrections

- Removed the private static selected-Actor helper from `CleanlinessManager`.
- Added a receiver-independent module helper `selectedModifiableActors()` shared by `bulkActorAdjust` and `bulkActorAction`.
- Kept `this` only for legitimate Application instance state such as rendering, element access, and the per-instance operation queue.
- Wrapped Actor-browser mutation/selection actions with `runActorManagerOperation()`.
- Serialized rapid repeated Actor-browser operations per open Manager instance to avoid racing settings/document writes while preserving every click in order.
- Added a contained error boundary that logs one `[runyth-garb-and-grime] Actor dashboard action failed.` error and shows a localized Foundry notification instead of leaking an unhandled promise rejection.
- Clears the per-instance operation queue reference when the Manager closes.

## Handler audit

All handlers registered in `CleanlinessManager.DEFAULT_OPTIONS.actions` were reviewed for class/instance receiver misuse. No remaining Manager action handler accesses a private static member through `this`. Existing `this.element`, `this.render(...)`, and `scheduleApplicationRender(this)` usage intentionally targets the Application instance.

## Behaviour retained

- Persistent Actor selection remains stored in the existing client-scoped UI state.
- Filtered-out and off-page selected Actors remain eligible for bulk operations.
- Permission checks still run through `canModifyActor`.
- Bounded concurrency remains at the existing resolver/document-operation limits.
- Existing cleanliness state, Actor flags, filters, pagination, global Actor scope, image safeguards, and public API are unchanged.
