# Runyth Garb & Grime v1.2.6 — Release qualification

## Environment

- Source baseline: v1.2.5 complete source archive supplied in conversation.
- Toolchain: Node.js 22.16.0, Python 3.13.5.
- Target platform: Foundry VTT v13.351 / D&D5e v5.3.3 (declared compatibility, not a live GUI test).
- Runtime manifest version: 1.2.6. Public API: 1.3.0. Actor schema: 1.

## Automated qualification

- Working source: `npm run check` passed 118/118 tests; all production `.mjs` files passed `node --check`.
- Provisional generated source: clean unzip followed by `npm run check` passed 118/118 tests.
- Final generated source: clean unzip followed by `npm run check` passed 118/118 tests (final archive qualification).
- Included `validation.txt`: complete working-source test transcript.
- Localized module dictionaries: same flattened English/German keys.
- Legacy/deprecated integration scan: no use of jQuery `$()`, deprecated `renderChatMessage`, global `renderApplicationV2` augmentation, array-style `controls.push` or global `FilePicker`/`JournalSheet` constructors in the module production code.
- Deterministic source/install/docs archives: two independent final builds byte-for-byte identical.
- Every final ZIP: passed `unzip -t` archive-integrity verification.
- Final install ZIP excludes source tests, build scripts, READMEs, changelogs, and documentation.

## Important scope statement

Foundry v13's `PreciseText` and related PIXI-style handling are exercised through test doubles and static API audits. No live Foundry browser/server instance or D&D5e world is accessible to this validator. A manual 13.351/5.3.3 checklist is provided under `docs/MANUAL_TEST_CHECKLIST.md`; results of these manual GUI checks are **not** claimed.

## Artifact checklist

1. Install-only module ZIP.
2. Full editable source, tests, packaging workflow, README/docs, and release-evidence ZIP.
3. Release documentation/audit, incremental changelog, build and qualification reports, and test transcript ZIP.

SHA256SUMS.txt in the output directory records all three archive checksums.
