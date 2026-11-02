# Runyth Garb & Grime 1.1.1 — Incremental Best-Practice Changelog

- Treat external Document image paths as untrusted display inputs rather than guaranteed module assets.
- Prevent predictable network failures before DOM insertion when the owning Foundry package is unavailable.
- Keep world Documents authoritative and unchanged; fallback behavior is presentation-only.
- Prefer a valid prototype-Token texture before generic fallback artwork.
- Use one bundled module-owned fallback asset with deterministic packaging validation.
- Cache runtime image failures for the browser session to prevent repeated failing network work.
- Group and deduplicate diagnostics by root cause rather than logging once per Actor/render.
- Prefix diagnostics with `[runyth-garb-and-grime]` for immediate package attribution.
- Use native DOM capture-phase `error` handling; no jQuery compatibility shim was introduced.
- Preserve all existing 1.1.0 APIs, state, permissions, bulk workflows, Tidy integration, and Scene-guide behavior.
