# Garb & Grime 1.1.4 — Build Report

- Module ID: `garb-and-grime`
- Version: `1.1.4`
- Public API: `1.3.0` (unchanged)
- State schema: `1` (unchanged)
- Primary target: Foundry VTT 13+
- Baseline: accepted Garb & Grime 1.1.3

This patch repairs the Scene cleanliness preset-classification workflow. The underlying bundled presets were not universally identical, but the settings editor incorrectly substituted `Expected` for every missing legacy rating. Saving that UI could persist the false all-Expected matrix. Version 1.1.4 removes that fallback, repairs affected bundled presets once, makes the bundled patterns intentionally distinct, and adds an at-a-glance preview in Global Module Settings → Contexts.
