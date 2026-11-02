# Runyth Garb & Grime 1.1.1 — Build Report

- Module ID: `runyth-garb-and-grime`
- Version: `1.1.1`
- Public API: `1.3.0` (unchanged)
- State schema: `1` (unchanged)
- Primary target: Foundry VTT 13+
- Baseline: accepted Runyth Garb & Grime 1.1.0

This patch hardens Actor portrait rendering in Runyth Garb & Grime-owned applications. Predictably invalid package-owned image paths are removed before Handlebars output reaches the browser. Genuine failures that can only be discovered by loading are handled once, cached per session, and replaced with bundled fallback artwork on subsequent module renders.

No Actor or Token image field is migrated or rewritten.

## Validation

- 74/74 automated tests passed.
- All production `.mjs` files passed `node --check`.
- German/English localization parity passed.
- Runtime asset/path static audit passed.
- Fresh source extraction and reproducibility are verified during packaging qualification.
