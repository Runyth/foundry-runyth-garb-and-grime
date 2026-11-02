# Garb & Grime 1.1.2 — Qualification

- Automated tests from working source: 76/76 passed.
- Automated tests from freshly extracted source ZIP: 76/76 passed during qualification.
- Production JavaScript syntax validation: passed through `tools/check.mjs`.
- German/English localization parity: passed (613 keys).
- Actor browser: bounded to 20/40/80/120 rows per page; default 40.
- Detailed image/date hydration: current page only.
- Actor directory state indexing: lightweight summary path without full-state deep cloning.
- Actor directory cache: invalidated on relevant Actor/folder/definition changes and cleared on Manager close.
- Broken-image and diagnostic caches: bounded for the browser session.
- Install, source, and documentation ZIP integrity: passed.
- Independent deterministic builds: byte-identical.
- Public API: unchanged at 1.3.0.
- State schema: unchanged at 1.
- World data migration: none.
