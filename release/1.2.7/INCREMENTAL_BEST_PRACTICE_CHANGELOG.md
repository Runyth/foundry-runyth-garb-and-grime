## 1.2.7 — 2026-10-19

### Added
- Reused the native editable Foundry `Shift+Alt+G` keybinding to toggle per-Scene cleanliness labels without modifying global visibility or Token flags. Players can customize the binding in Foundry's Configure Controls.
- GM **Sheets & HUD → Canvas Token Labels** setting to enable/disable this shortcut, plus four targeting scopes: **all player-linked character Tokens on this Scene** (default, selection not required); selected player-character Tokens; all otherwise eligible Tokens; selected otherwise eligible Tokens.
- Reconciled group-state semantics: if all targets are visible, hide all; otherwise show all. Works independently of Manual / Always / Controlled / Hovered visibility policies.
- Per-client session visibility overrides keyed by Token Document UUID, automatically discarded on Scene changes. Redrawn Tokens keep the local override as long as their UUID is stable.
- German/English explanations in the settings panel and keybinding help; friendly warnings for missing selection, no eligible Token, permission denial, disabled labels, and no active Scene.

### Correctness, safety, and compatibility
- Fixed original keybinding callback's async error-handler mismatch: the new synchronous toggle is enclosed in a local `try/catch` rather than calling `.catch()` on a numeric result.
- Permission checks happen before reading or modifying shortcut overrides; player access remains controlled exclusively from the Permissions tab. GM Always Hide, invisible Tokens, personal Always Hide, world Actor scope, and player scope cannot be bypassed.
- Uses native Foundry v13 `game.keybindings.register`; no global DOM keyboard listeners, sockets, world writes or chat spam.
- Retains the previous `toggleTokenLabels` and `setTokenLabelsVisible` public API semantics and the existing manual toggle UI.
- 129 automated tests, including new default and selected scopes, player permission isolation, GM hide, automatic modes, same-UUID redraw, scene reset, native callback, and static settings integration.
- API version remains `1.3.0`; schema remains `1`; no world-data migration needed.

