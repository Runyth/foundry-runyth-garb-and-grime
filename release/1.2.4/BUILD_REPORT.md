# Garb & Grime v1.2.4 — Build report

## Baseline
- Source baseline: accepted Garb & Grime v1.2.3 source archive.
- Release type: patch.
- Module version: 1.2.4.
- Public API: 1.3.0 unchanged.
- Actor-state schema: 1 unchanged.

## Root-cause correction
- Foundry V13 `PreciseText` no longer receives a PIXI-v8-style object as its text constructor argument.
- Player authorization and player presentation preferences are separated: Permissions grants access; client-local viewer settings only change presentation.
- Legacy `playerScope: disabled` is normalized to Character-only eligibility so it cannot contradict an explicit permission grant.

## Validation
- Working-tree automated suite: 110/110 passed.
- Freshly extracted source ZIP: 110/110 passed.
- English/German localization parity and production syntax checks are included in the validator.
- Final archives are built twice and compared byte-for-byte.
