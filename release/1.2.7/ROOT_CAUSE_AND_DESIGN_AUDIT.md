# Garb & Grime 1.2.7 — Scoped Shortcut Design & Compatibility Audit

## Existing behavior before patch

- `toggleTokenCleanlinessLabels` was already a configurable Foundry V13 keybinding (Shift+Alt+G) but forwarded to `toggleGlobalVisibility`, which toggled a single client setting and refused to work outside Manual display mode.
- No selection model existed for this shortcut, so selecting a subset of Tokens could not constrain it.
- Token flag overrides were GM/world state and could not safely be used for a purely local viewer shortcut.

## Implementation

- The same existing native editable keybinding is retained without registering a duplicate hotkey.
- A world configuration option `tokenLabels.shortcutEnabled` (true by default) and `tokenLabels.shortcutScope` (scene-pcs by default) are editable in Sheets & HUD. No new authoritative permissions appear there.
- Target group choices: all player-linked PC Tokens, selected linked PC Tokens, all eligible Tokens, selected eligible Tokens. PC linkage is resolved through actual non-GM `User.character` relationships or OWNER permission on character Actors, via the existing actor-scope helper.
- Per-client transient Map keyed by Token document UUID controls visible/hidden only for targeted Tokens. The Map is cleared when the active Scene ID changes and on an explicit viewer-mode preference change. This supports Token redraws on the same Scene without writing flags or settings.
- Visibility always checks world-level enablement, Actor scope, viewer permissions, player scope, Token visibility, GM per-Token Always-hide flag, and personal Always-hide **before** considering any shortcut override.
- Group toggling uses a single `all shown -> hide; otherwise show` decision to avoid inconsistent mixed-state inversions.
- Existing API/manual visibility global setting retained. Automatic modes remain normal outside the locally overridden Token set.

## Risk and interference audit

- No new Foundry hooks, broad Application hooks, chat listeners, keydown listeners, module sockets, timers, Actor updates, Scene flags, or Token flag writes.
- Native keybinding callback now catches synchronous errors without using `.catch()` on a non-Promise result.
- Keybinding may be reassigned in Configure Controls by each client, and is disabled safely through configuration.
- New default key combination intentionally unchanged (Shift+Alt+G), avoiding collision/regression from replacing an existing registered action.
- Non-player-owned and non-linked Character Actors do not enter the default PC target set. Users with viewer authorization still see only tokens allowed by their world and per-user scope.
- No system-specific dependencies; retains Foundry 13.351 / dnd5e 5.3.3 primary target and original API/state versions.

## Testing limitations

The suite uses Node tests and Foundry v13-compatible mocks for keyboard/canvas behavior; a live GM+player Foundry deployment test is still recommended and is provided in the manual checklist.
