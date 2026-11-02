# Runyth Garb & Grime v1.2.0 — Test summary

The release validation suite currently contains 95 tests. All 95 pass.

New/expanded coverage includes:

- token-label migration preserving legacy audience intent;
- default non-GM denial of persistent labels;
- explicit per-user visibility allowance;
- manual and automatic display policies;
- controlled/hovered Token state;
- Actor and player scope enforcement;
- per-Token show not bypassing permission or owned scope;
- settings-form isolation for player viewer overrides;
- avoidance of unnecessary label refresh and Active Effect reconciliation;
- localization and package-path parity;
- existing ApplicationV2, chat, Actor-browser, performance, Tidy 5e, canvas, bulk action, Scene classification, and state regressions.

See `TEST_RESULTS.txt` for the complete TAP output and `STATIC_AUDIT.txt` for the source scan.
