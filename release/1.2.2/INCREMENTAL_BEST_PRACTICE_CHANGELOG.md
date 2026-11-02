# Garb & Grime v1.2.2 — Incremental changelog

- Fixed newly added player-linked PC Actors being hidden by an older manual dashboard Actor scope.
- Recognizes Foundry selected-character links and non-GM OWNER assignment for `character` Actors.
- Keeps player-owned NPCs/pets subject to the normal manual scope.
- Added User create/update/delete invalidation for an already-open Manager.
- Preserved global scope, pagination, lightweight indexing, portrait hardening, permissions, chat, transactions, sheets, Token HUD and Token labels.
- Public API remains 1.3.0; Actor-state schema remains 1; no data migration.
