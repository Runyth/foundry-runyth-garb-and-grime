# Garb & Grime v1.2.3 — Build report

## Baseline

- Source baseline: accepted Garb & Grime v1.2.2 source archive.
- Release type: patch.
- Module version: 1.2.3.
- Public API: 1.3.0 unchanged.
- Actor-state schema: 1 unchanged.

## Root-cause correction

- Corrected DialogV2 form ownership in the Scene Context workflow.
- Added explicit stale-profile status without automatic Scene migration.
- Hardened ContextService Scene/profile/persistence validation.
- Preserved unrelated Scene Context flag fields during explicit profile replacement.

## Validation

- Working-tree automated suite: 107/107 passed.
- Freshly extracted provisional source ZIP: 107/107 passed.
- All production `.mjs` files passed syntax validation.
- English/German localization parity is covered by the automated suite.
- Install, source and documentation ZIP integrity is verified during packaging qualification.
- Deterministic reproducibility is verified by two independent final package builds.
