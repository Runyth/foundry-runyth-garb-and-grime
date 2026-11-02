# Garb & Grime v1.2.4 — Incremental best-practice changelog

- Fixed Token cleanliness labels rendering `[object Object]` by using Foundry V13 `PreciseText` with an unambiguous string-first constructor.
- Kept **View persistent cleanliness status** in the Permissions tab as the sole authorization gate for player label visibility.
- Removed the legacy `disabled` player-scope authorization duplicate; old worlds migrate it to Character-only eligibility.
- Added client-local viewer display preferences for authorized players: Follow GM, Manual, Always, Controlled, Hovered, Controlled or Hovered, and Always Hide.
- Added client-local label position preferences for authorized players.
- Added a discoverable Scene Control for personal cleanliness-label display preferences.
- Preserved GM per-Token Always Hide, world presentation, per-Token flags, and all unrelated Garb & Grime behavior.
- Added regressions for constructor type, authorization precedence, personal viewer modes, and legacy scope migration.
