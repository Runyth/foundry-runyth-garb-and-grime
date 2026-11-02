# Garb & Grime v1.2.3 — Scene Context root-cause audit

## Reported defect

Using the Garb & Grime Scene Context control could fail with `Unknown environment profile: undefined`, originating from `ContextService.setSceneContext`.

## Root cause

The v1.2.2 Scene Context dialog used Foundry V13 `DialogV2`, but inserted its own nested `<form class="gag-context-dialog">` inside DialogV2 content and then queried that inner form from `dialog.element`. DialogV2 already owns the submission form. Nested HTML forms are invalid and are not a reliable DOM structure. Foundry V13 exposes the actual owning form as the submitted button's native `button.form`.

As a result, the Scene Context callback could fail to obtain the selected `contextId`. Depending on DialogV2's submitted result path, the caller could then reach `setSceneContext()` without a valid profile ID, producing the observed `undefined` error.

A second defect masked stale data: `getSceneContext()` silently fell back to `ordinary` when a Scene stored a deleted/renamed profile ID. That made the Scene operational, but hid the stale reference from the GM and prevented explicit repair.

## Fix

- Removed the nested form from DialogV2 content.
- Reads Scene Context fields from `button.form.elements`, matching the Foundry V13 DialogV2 submission contract.
- Added `getSceneContextStatus()` to distinguish `unset`, `valid`, `stale`, and `no-scene` states without silently rewriting Scene data.
- Fresh Scenes use a deterministic effective `ordinary` default without writing any Scene flag until Save.
- Stale profile IDs remain visible as unavailable in both the Scene Context dialog and Manager Overview until the GM explicitly chooses a replacement.
- `setSceneContext()` now classifies missing selection, invalid Scene document, unavailable registry, unknown profile, and persistence failure separately.
- Scene writes preserve unrelated stored Scene Context fields.
- Known Scene Context failures are logged/notified once by the dialog; the outer Scene Control rejection boundary remains for unexpected failures only.

## Compatibility

Valid existing Scene Context flags remain unchanged. No Actor, Token, Scene, User, or settings migration is performed. The public API stays at 1.3.0 and Actor-state schema stays at 1.
