# Runyth Garb & Grime 1.1.5 — Build Report

- Module ID: `runyth-garb-and-grime`
- Version: `1.1.5`
- Public API: `1.3.0` (unchanged)
- State schema: `1` (unchanged)
- Primary target: Foundry VTT 13+
- Baseline: accepted Runyth Garb & Grime 1.1.4

This patch repairs the Cleanliness Manager's ApplicationV2 bulk Actor action receiver failure. Foundry invokes configured action functions with the application instance as `this`; the 1.1.4 handler incorrectly used that instance to access a private static helper, causing `TypeError: Receiver must be class CleanlinessManager`. Version 1.1.5 removes the static-private receiver dependency, centralizes selected/modifiable Actor resolution, serializes rapid Actor-browser mutations, and contains asynchronous failures inside a module-owned rejection boundary.
