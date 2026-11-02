# Runyth Garb & Grime 1.1.4 — Incremental Best-Practice Changelog

- Never use a semantically meaningful value such as `Expected` as a UI fallback for missing structured configuration when that fallback can later be persisted.
- Resolve legacy built-in definitions against canonical defaults before presenting editable controls.
- Separate canonical preset data from explicit user customization using a lightweight provenance marker.
- Keep one-time migration narrowly recognizable and idempotent through an independent world migration version.
- Do not rewrite Scene-level overrides when repairing profile defaults.
- Keep legacy range fields as compatibility fallback data while making the explicit four-value classification authoritative.
- Show complex preset state in a concise read-only preview before editable controls to reduce configuration ambiguity.
