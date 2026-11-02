# Garb & Grime v1.2.2 — Build report

## Baseline

- Source baseline: accepted Garb & Grime v1.2.1 source archive.
- Release type: patch.
- Module version: 1.2.2.
- Public API: 1.3.0 unchanged.
- Actor-state schema: 1 unchanged.

## Root-cause correction

- Added player-linked Character detection from Foundry User character assignment and non-GM OWNER permission.
- Player-linked `character` Actors bypass only the manual global folder/regex dashboard scope.
- NPCs and other Actor types remain governed by the manual scope.
- Added User create/update/delete Manager invalidation so roster and selected-character changes are reflected immediately.
- Existing Actor ownership updates continue to invalidate through the existing `updateActor` path.

## Validation

- Working-tree automated suite: 102/102 passed.
- Freshly extracted provisional source ZIP: 102/102 passed.
- All production `.mjs` files passed `node --check`.
- English/German localization parity is covered by the automated suite.
- Targeted deprecated/broad integration scan found no regression.
- Install, source and documentation ZIP integrity tests passed.

## Packaging

The repository packaging tool creates deterministic ZIP archives using sorted entries, fixed timestamps and fixed compression settings. Final reproducibility is verified by building into two independent output directories and byte-comparing all three artifacts.
