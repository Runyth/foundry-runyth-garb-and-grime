# Garb & Grime v1.2.9 — qualification report

- Baseline: original full v1.2.8 source distribution.
- Manifest, package, runtime version and test assertions updated to 1.2.9.
- Working-tree validation: 148/148 automated tests passing.
- Initial generated source ZIP extracted to a clean directory and independently validated: 148/148 passing.
- All production `.mjs` files pass `node --check` through the standard validator.
- English/German locale key parity, manifest and release conventions passed the existing automated checks.
- Initial ZIPs pass unzip integrity checking.
- Archive builder uses fixed timestamps, sort order, permissions and compression configuration to produce reproducible release archives.
- Final release qualification: two byte-identical builds are required and checked after sealing this report. SHA-256 manifest is delivered separately.
- No live Foundry 13.351 or D&D5e 5.3.3 browser was available; live player/GM testing remains manual, and mock tests cannot substitute for it.

## Compatibility

Foundry V13-first, public API 1.3.0, Actor-state schema 1. All existing tokens, Actors, Scenes, permissions, chat events and transaction setting remain backward compatible. The new optional `configuration.cleaning` defaults merge with existing world configuration; no data migration required.
