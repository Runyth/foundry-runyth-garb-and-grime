# Garb & Grime v1.2.2 — Actor eligibility root-cause audit

## Reported symptom

A world began with five players and five PC Actors visible in Garb & Grime. After a sixth user and PC Actor were added, the dashboard continued to show only the original five. Assigning the sixth PC to an additional existing player did not make it appear, and dashboard directory filters did not recover it.

## Root cause

The dashboard eligibility pipeline in v1.2.1 was:

1. world Actors;
2. supported Actor type and current-user visibility;
3. global dashboard folder/regex scope;
4. dashboard filters, indexing, pagination and hydration.

Foundry's player-character relationship was absent from that pipeline. In Foundry, selecting a user's character updates the User's `character` relationship; sharing control is expressed through Actor ownership. Neither relationship could override the Garb & Grime global folder/regex scope. Consequently, a Character Actor excluded at stage 3 stayed excluded no matter which dashboard filters were changed, and a User-character assignment did not invalidate the Manager because no User hooks were registered.

There was no hard-coded five-Actor limit and the v1.1.2 pagination/index cache was not the cause.

## Fix

- Added a lightweight `playerLinkedCharacterActorIds` resolver.
- A supported Actor of type `character` is player-linked when either:
  - a non-GM User selects it as their Foundry character; or
  - a non-GM User has OWNER permission for it.
- Player-linked Character Actors now bypass the manual global folder/regex scope.
- NPCs and other Actor types do not receive this bypass, even if player-owned.
- Added `createUser`, relevant `updateUser`, and `deleteUser` hooks to invalidate and rerender an open Manager when player-character relationships change.
- Existing Actor `ownership` updates continue to use the existing Actor invalidation hook.
- The Manager scope summary explicitly reports how many linked PCs were included from outside the manual scope.

## Compatibility and performance

The global scope remains before cleanliness-summary reads, detailed Actor index work, portrait resolution, pagination hydration and DOM creation. Player-link resolution is only evaluated when the manual global scope is active. No Actor, User, Token, Scene or setting data is migrated or rewritten.
