# v1.2.8 Incremental best-practice changelog

- Fixed stale canvas dirt/cleanliness status on currently deployed **unlinked player-character Tokens** after Actor-level wash or dirt update.
- Identified root cause: stale synthetic ActorDelta state was being read again during existing repaint hooks.
- Canonical state source is the world `character` Actor, retrieved via v13 TokenDocument `baseActor` / `actorId`. Linked PC Tokens remain supported.
- Same-scene repeated PC Tokens refresh via existing coalesced updateActor hook; no re-drag/reload needed.
- Player actions issued from unlinked character Tokens update the canonical world Actor with base Actor permission checks.
- Unlinked NPC Token state remains independent; no TokenDocument writes or migration.
- Added six integration-style regression tests. No schema, API, permissions, configuration, label styling, or shortcut changes.
