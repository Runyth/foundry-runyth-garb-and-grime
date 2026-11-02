# Runyth Garb & Grime v1.2.0 — Feature and compatibility audit

## Scope

v1.2.0 adds granular GM control over persistent Token cleanliness visibility while preserving the existing Token-label renderer, per-Token overrides, state schema, public API, Actor state, Scene state, dashboard behavior, Tidy 5e integration, Token HUD, chat, automation, and bulk actions.

## Persistent-status authorization model

Visibility is evaluated in layers:

1. The Token-label feature must be enabled and the Token must be visible.
2. The Actor must satisfy the configured Actor scope (`supported` or `characters`).
3. A non-GM viewer must have the new `viewTokenLabels` permission.
4. A non-GM viewer must satisfy player scope (`disabled`, `owned`, `characters`, or `all`).
5. Per-Token `hide` suppresses the label; per-Token `show` may force display behavior but cannot bypass steps 1–4.
6. In inherited mode, visibility follows `manual`, `always`, `controlled`, `hovered`, or `controlled-or-hovered`.

GMs bypass the player authorization layer. New/default worlds deny `viewTokenLabels` to all non-GMs. The settings hub exposes per-player inherit/allow/deny controls beside Token-label settings and retains the full permission matrix in its Permissions tab.

## Backward compatibility

Legacy `tokenLabels.audience` remains readable for compatibility but is no longer the primary UI. The one-time token-label settings migration maps legacy intent as follows:

- `gm` → Manual + PC player scope + non-GM permission disabled.
- `owners` → Manual + owned-Actor player scope + player permission enabled at the legacy role level.
- `everyone` → Manual + all eligible Token Actors + player permission enabled at the legacy role level.

The migration writes world settings only. It does not modify Actor, Token, or Scene Documents. Existing `flags.runyth-garb-and-grime.tokenLabelMode` and `tokenLabelPosition` remain valid.

## Display policies

- **Manual** — existing client visibility toggle and registered keybinding.
- **Always** — continuously visible for eligible Tokens.
- **Controlled** — visible while the Token is controlled.
- **Hovered** — visible while the Token is hovered.
- **Controlled or Hovered** — either interaction state.

The implementation uses Foundry Token control/hover hooks to schedule the existing frame-coalesced refresh path. It does not register raw browser listeners per Token and does not recreate labels unnecessarily.

## Correctness/performance audit findings

During the feature audit the following existing or potential issues were addressed:

- Player-viewer form fields are excluded from the generic configuration-property writer and saved only to the permissions setting.
- Saving unrelated settings no longer schedules a canvas-wide Token-label refresh.
- Saving the Sheets/Token-label category no longer reconciles every Actor Active Effect unless the effect configuration actually changed.
- Manual label Scene Controls are shown only when the configured display policy is Manual.
- The manual keybinding can be used by an authorized player but performs an explicit module permission check; automatic policies reject the manual toggle with a localized warning.
- Actor-panel and Item-integration caught errors now consistently identify `[runyth-garb-and-grime]` in the console.

## Interference/deprecation audit

The production tree was scanned for broad/deprecated patterns previously responsible for Foundry/module interference. The scan found no Runyth Garb & Grime production usage of:

- deprecated `renderChatMessage`;
- broad `renderApplicationV2`/generic Application augmentation;
- jQuery `html.find` or `$()` assumptions;
- array-style `controls.push` Scene Control registration;
- deprecated global `FilePicker`, `JournalSheet`, `InteractionLayer`, `PrimarySpriteMesh`, or `TextureLoader` references.

Existing sheet integrations remain limited to semantic Actor/Item/Tidy hooks. Existing canvas labels remain module-owned, non-interactive, idempotent objects in the interface canvas group.

## Compatibility result

- Module: 1.2.0
- Public API: 1.3.0 (unchanged)
- State schema: 1 (unchanged)
- Actor/Token/Scene document migration: none
- Settings migration: token-label display/permission model only
- Automated tests: 95/95 passed before packaging
