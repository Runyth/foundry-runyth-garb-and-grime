# Building and validation

Requirements:

- Node.js 22 or newer
- Python 3.10 or newer for deterministic ZIP packaging

Run all syntax and automated tests:

```text
npm run check
```

Create deterministic install, source, and documentation archives under `dist/`:

```text
npm run package
```

The packaging script fixes ZIP timestamps, sorts entries, and creates:

1. `runyth-garb-and-grime-v<version>.zip` with only Foundry runtime files under one `runyth-garb-and-grime/` root.
2. `runyth-garb-and-grime-source-v<version>.zip` with the complete editable source, tests, documentation, release evidence, and build workflow under one `runyth-garb-and-grime-source/` root.
3. `runyth-garb-and-grime-documentation-v<version>.zip` with README, documentation, audits, build report, incremental changelog, test transcript, manual checklist, and install/source checksums.

`SHA256SUMS.txt` records all three archive checksums. Independent builds from identical source are byte-reproducible.
