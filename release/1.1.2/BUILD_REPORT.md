# Garb & Grime 1.1.2 — Build Report

- Module ID: `garb-and-grime`
- Version: `1.1.2`
- Public API: `1.3.0` (unchanged)
- State schema: `1` (unchanged)
- Primary target: Foundry VTT 13+
- Baseline: accepted Garb & Grime 1.1.1

This patch targets the Cleanliness Manager Actors-tab performance path. The directory is now indexed cheaply, cached while the Manager remains open, and hydrated/rendered in bounded pages. Browser-session failure caches are bounded and Manager resources are released on close.

No world data migration is required.
