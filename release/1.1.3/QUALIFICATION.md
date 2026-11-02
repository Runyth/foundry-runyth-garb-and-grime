# Garb & Grime 1.1.3 — Qualification

- Automated tests from working source: 81/81 passed.
- Automated tests from a freshly extracted source ZIP: 81/81 passed.
- Production JavaScript syntax validation: passed through `tools/check.mjs`.
- German/English localization parity: passed.
- Global Actor scope defaults: empty/nonrestrictive for backward compatibility.
- Folder scope: searchable hierarchical selection with optional descendants.
- Regex scope: Unicode/case-insensitive, matches Actor name/type/full folder path.
- Scope ordering: applied before directory state summaries and Actor index construction.
- Stale folder IDs: ignored safely.
- Invalid regex: rejected on save and contained at runtime.
- Public API: unchanged at 1.3.0.
- State schema: unchanged at 1.
- World data migration: none.
