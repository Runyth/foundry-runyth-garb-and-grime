# Incremental best-practice changelog — 1.0.10 to 1.1.0

- Added redundant, high-visibility dashboard entry points without removing existing launchers.
- Added a dedicated V13 Scene Control group rather than overloading unrelated controls.
- Added scalable Actor discovery through hierarchical folders, recursion control, regex search, type/level filters, sorting, and persistent selections.
- Kept selection metadata client-scoped and Actor state untouched.
- Used bounded asynchronous bulk operations already established in 1.0.10.
- Added one Scene flag extension that remains backward compatible with older context data.
- Used profile inheritance to avoid unnecessary per-Scene writes.
- Added a GM-only ApplicationV2 guide with persistent position and size.
- Kept Scene classifications advisory and free of hidden mechanical changes.
- Localized every new interface, validation, notification, rating, and settings string in German and English.
- Added public API methods without changing existing signatures.
- Added focused regression tests for launcher discovery, Actor scalability, classification validation, persistence, advisory-only behavior, and API exposure.
