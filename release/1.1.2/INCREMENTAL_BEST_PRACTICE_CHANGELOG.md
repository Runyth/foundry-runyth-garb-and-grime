# Runyth Garb & Grime 1.1.2 — Incremental Best-Practice Changelog

- Bound large directory UIs by page size instead of rendering every matching Document.
- Separate cheap indexing from expensive presentation hydration.
- Avoid computing data a view does not display.
- Add a read-only lightweight state summary for directory/search use instead of cloning full persistent state.
- Reuse stable Actor summary data across rerenders and invalidate narrowly on Actor updates.
- Invalidate directory caches on folder mutations and definition reloads.
- Release Manager-owned caches/listeners/timers on close.
- Bound session-long error caches.
- Keep image work restricted to currently displayed rows.
- Preserve all existing permissions, bulk workflows, state storage, public API, and Foundry V13 integration behavior.
