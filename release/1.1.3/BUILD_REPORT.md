# Garb & Grime 1.1.3 — Build Report

- Module ID: `garb-and-grime`
- Version: `1.1.3`
- Public API: `1.3.0` (unchanged)
- State schema: `1` (unchanged)
- Primary target: Foundry VTT 13+
- Baseline: accepted Garb & Grime 1.1.2

This patch adds a world-level dashboard Actor scope under Global Module Settings → General. A GM can prefilter the dashboard Actor pool using a regular expression and/or a searchable hierarchical Actor-folder selection before Garb & Grime performs directory cleanliness-summary reads, row indexing, image work, pagination, or DOM preparation.

The default scope is empty and therefore preserves the exact previous all-supported-visible-Actors behavior. No world data migration is required.
