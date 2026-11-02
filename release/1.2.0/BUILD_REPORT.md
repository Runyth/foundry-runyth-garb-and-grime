# Runyth Garb & Grime v1.2.0 — Build report

## Baseline

- Accepted source release: v1.1.5
- Target release: v1.2.0
- Public API: 1.3.0
- State schema: 1

## Build policy

The project uses `tools/package.py` to create deterministic archives. Runtime packaging excludes README, CHANGELOG, docs, tests, and build-only material. The source archive contains the complete reproducible project. The documentation archive contains project documentation plus this release qualification bundle.

## Qualification status

- Working-tree validation: PASS (95/95)
- Production `.mjs` syntax validation: PASS
- Deprecated/broad integration source scan: PASS
- Localization parity: PASS through automated suite
- Fresh-source archive validation: PASS (95/95)
- Archive integrity: PASS (install/source/documentation)
- Independent-build reproducibility: PASS (all three archives byte-identical)

The final checksum file is generated after archive qualification.
