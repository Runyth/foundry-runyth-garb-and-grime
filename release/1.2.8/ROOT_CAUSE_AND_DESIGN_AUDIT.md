# Garb & Grime v1.2.8 — Root cause and design audit

## Reproduced behavior

A world Character Actor can have multiple deployed **unlinked** Tokens. Foundry V13 represents those Tokens through synthetic Token Actors backed by ActorDelta. A previous cleanliness snapshot can remain in that ActorDelta after an Actor-level clean or dirt change. Garb & Grime v1.2.7 rendered `stateService.getState(token.actor)`, which could read the old synthetic Actor's `flags.garb-and-grime.state` instead of the updated world Actor. The `updateActor` canvas hook was already scheduling a repaint but the repaint re-read the old source, which is why it appeared to do nothing until Token replacement.

Foundry V13 documents `TokenDocument.actor` for unlinked Tokens as synthetic and `TokenDocument.baseActor` as the world Actor. This differs intentionally from NPC Token behavior, where per-instance state is appropriate.

## Implementation

- `src/actor-resolution.mjs`: strict resolvers for a synthetic character Actor or TokenDocument to its world `baseActor`, validating Actor type and `actorId`. Avoid name-based guessing and exclude NPC synthetic Actors.
- `src/state-service.mjs`: `getInternalState` and directory summaries read canonical state for synthetic Character Actors. Mutating a Character via unlinked Token redirects only Garb & Grime Actor-state persistence to the world Actor and performs an extra base-Actor permission check. Existing hooks, normalizations, chat, transaction and effect handling use the established service paths; no TokenDocument flag or ActorDelta writes are introduced.
- `src/integrations/token-labels.mjs`: canvas labels use their TokenDocument's world Character Actor even if the synthetic Actor itself lacks an exposed `.token` owner. The existing `updateActor` hook now matches TokenDocument `actorId` alongside the previous Actor UUID/ID checks and schedules full label refreshes through the frame-coalesced queue. Every matching live Token in the current Scene is repainted, including repeated instances of the same PC; Scene loading/drawing also reads canonical data.

## Safeguards and non-goals

- NPC unlinked Tokens remain independent. No copying all world Actor flags, no scene-wide Token delta migration, no global polling or always-running listeners, no mutation of core Token images/nameplates, no new world settings.
- Existing player/GM per-viewer label permissions, explicit hide, positions, keyboard shortcut, dashboard/Actor filtering and automated actions are unchanged.
- Actor-state schema `1`; public API `1.3.0`; Foundry V13.351 and D&D5e 5.3.3 compatibility targets unchanged.
- Active Effect mirrors on *synthetic Token Actors* are a separate concern from module cleanliness state and canvas labels; this patch deliberately does not clone or force-write Token embedded effects, as that can destroy intentionally independent Token modifications.

## Automated coverage

- Two existing synthetic PC Tokens display old level before the update and both display new values after a world Actor wash/dirty change through `updateActor` and scheduled frame refresh.
- A third Token spawned afterward starts with current world cleanliness, despite a stale synthetic snapshot.
- Player wash from an unlinked Token updates the base Actor and all live labels without synthetic Actor flag writes.
- Unlinked NPC remains independent, untrusted/mismatched base Actor resolution is rejected, and base Actor permissions are respected.
- TokenDocument-based resolution without synthetic `.token` also covered.

## Required live acceptance

Follow the v1.2.8 section of `docs/MANUAL_TEST_CHECKLIST.md`. Node tests use a Foundry-compatible hook and PIXI mock, not a running Foundry browser. Multiclient visual/embedded Active Effect checks must be conducted in the live world.
