# Garb & Grime 1.1.3 — Incremental Best-Practice Changelog

- Move coarse Actor eligibility filtering ahead of expensive state/index preparation.
- Keep global world scope separate from client-local dashboard filters.
- Use stable Folder IDs for persistence and full paths only for display/search.
- Provide a searchable hierarchical folder selector rather than an unbounded single dropdown.
- Make “Select visible” work with the folder search for large trees.
- Use native DOM listeners with AbortController lifecycle cleanup.
- Reject invalid regular expressions before persisting configuration.
- Treat stale deleted-folder IDs as nonrestrictive instead of failing closed.
- Preserve legacy behavior with empty default scope settings.
- Keep scope dashboard-only so gameplay integrations remain unaffected.
