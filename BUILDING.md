# Building and validation

Requirements: Node.js 22.13 to 26.

Run the complete quality gate (manifest, URL and package validation, the full test suite, deterministic packaging, byte-identical rebuild verification and publication scans):

```text
npm ci --ignore-scripts
npm run check
```

The builder creates separate installation, source, and documentation archives under `dist/` with fixed timestamps plus per-arch checksums:

1. `runyth-garb-and-grime-v<version>-mod.zip` with only the Foundry runtime files under one `runyth-garb-and-grime/` root.
2. `runyth-garb-and-grime-v<version>-src.zip` with the complete editable source, tests, tools, documentation, release evidence, and build workflow under one `runyth-garb-and-grime-v<version>-src/` root.
3. `runyth-garb-and-grime-v<version>-doc.zip` with README, documentation, and the changelog.

`runyth-garb-and-grime-v<version>-SHA256SUMS.txt` records all archive checksums together with the raw `module.json`. Independent builds from identical source are byte-reproducible.

The focused development validator remains available: `node tools/validate.mjs`.
