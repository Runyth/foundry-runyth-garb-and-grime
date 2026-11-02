# Runyth Garb & Grime 1.1.0 build report

## Release identity

- Display name: Runyth Garb & Grime
- Module ID: `runyth-garb-and-grime`
- Module version: `1.1.0`
- Public API version: `1.3.0`
- Actor state schema: `1`
- Primary Foundry target: V13
- Dependencies: none

## Source review

The 1.0.10 source release was used as the implementation baseline. Existing behavior was preserved while dashboard discovery, scalable Actor management, and advisory Scene classifications were added.

## Static validation

- Manifest identity and compatibility checked.
- Every manifest path checked.
- Every production JavaScript module syntax checked.
- German and English localization key parity checked.
- Literal localization references checked.
- Module-relative assets and templates checked.
- Deprecated Application/chat/socket dependencies checked.
- CSS and sheet-integration isolation regressions retained.

## Automated validation

The complete automated suite includes state, cleaning, payment, upkeep, permissions, registry, roll, chat, effects, lifecycle, localization, package, tabs, sheets, Token labels, performance, bulk UI, feature discovery, scalable Actor selection, and Scene classification coverage.

The exact test transcript is bundled as `TEST_RESULTS.txt`.

## Runtime limitation

A live Foundry V13 server with separate GM/player clients was not available in the build environment. The expanded manual checklist remains required for final visual and multi-client confirmation in the target world.

## Final result

- Automated tests: **71/71 passed**.
- Production JavaScript syntax checks: passed.
- Handlebars structural balance checks: passed.
- German/English localization parity: passed.
- Install ZIP integrity and runtime-only layout: passed.
- Source ZIP integrity and extracted-source validation: passed.
- Documentation ZIP integrity and required-content inspection: passed.
- Independent deterministic build comparison: byte-identical.
