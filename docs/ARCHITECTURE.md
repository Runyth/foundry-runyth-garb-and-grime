# Architecture

Runyth Garb & Grime separates pure domain logic from Foundry integration.

- `src/domain/`: normalization, state transitions, validation, and context evaluation.
- `src/state-service.mjs`: authoritative Actor flag mutations, permissions, hooks, chat, and effects.
- `src/action-service.mjs`: cleaning, payment, item consumption, upkeep debt, and transaction logging.
- `src/registry.mjs`: built-in, world, and complementary-module definitions.
- `src/apps/`: ApplicationV2 manager, Actor panel, settings hub, and per-user position persistence.
- `src/integrations/`: Actor sheets, Token HUD, canvas Token labels, Scene Controls, sidebar, and Items.
- `scripts/main.mjs`: lifecycle wiring and public API.

Persistent data is lazy and namespaced:

```text
Actor flags.runyth-garb-and-grime.state
Scene flags.runyth-garb-and-grime.context
Item  flags.runyth-garb-and-grime.itemIntegration
Token flags.runyth-garb-and-grime.tokenLabelMode
Token flags.runyth-garb-and-grime.tokenLabelPosition
```

World settings contain definitions, permissions, configuration, day state, and the bounded transaction log. Client settings contain UI and window state.

The module intentionally has no custom player-to-GM socket. Ordinary player updates rely on Foundry document ownership, while automation is performed on the GM client. This reduces the authorization surface and prevents a player from submitting arbitrary Actor UUID mutations through a module socket.

## D&D 5e roll integration

D&D 5e 5.2+ constructs skill rolls through `CONFIG.Dice.D20Roll.build` and emits `dnd5e.preRollSkillV2(config, dialog, message)`. Runyth Garb & Grime reads `config.subject` and `config.skill`, avoiding the obsolete Actor/config/skill callback assumption. Prompt mode vetoes only the pending local GM roll, obtains an explicit choice through `DialogV2`, and repeats the roll with a recursion marker. Player rolls remain advisory, so no custom authorization socket is required.

## Canvas Token labels

Token labels are presentation-only `PreciseText` plus `PIXI.Graphics` containers attached idempotently to one dedicated child of `canvas.interface`. Because the interface group renders above the Token layer, labels remain visible over overlapping Tokens without replacing or mutating Foundry's built-in Token nameplate. Actor state remains authoritative; Token flags store only display and position overrides, while a hidden client setting stores the global visibility toggle. Canvas, Token, Actor, configuration, and setting hooks refresh existing label objects instead of registering per-render DOM listeners or creating duplicates.

## Sheet integration isolation

Actor-sheet integration is intentionally limited to `renderActorSheet`, `renderActorSheetV2`, and Tidy 5e's documented `tidy5e-sheet.renderActorSheet` hook. Generic application and global header-control hooks are forbidden because advancement and level-up dialogs can expose an Actor without being Actor sheets. Tidy Modern and Classic insertion uses documented `data-tidy-sheet-part` targets. CSS that orders Foundry window controls is activated only on a header explicitly marked `gag-sheet-header`.

## 1.1.0 dashboard and Scene classification

The Cleanliness Manager remains a single ApplicationV2 surface but its Actors tab now builds a transient browser model from Foundry Actor folders. Folder hierarchy, descendant IDs, folder paths, search mode, Actor type, dirt level, selection state, and sorting are computed without changing Actor Documents. Selected Actor UUIDs and filter state are client-scoped UI settings.

Scene classifications remain Scene metadata under `flags.runyth-garb-and-grime.context`. The optional `levelRatings` array has exactly four entries ordered from dirt level 0 through 3. Absence of the array means the current environment profile supplies defaults. The Scene guide reads this metadata and never mutates Actors, rolls, chat, Active Effects, or reactions.

The Scene guide is a GM-only `PersistentApplication`. Its position and size use the existing per-user window-state service, while open/closed state uses a client setting. The dedicated Scene Control group uses Foundry V13's record-shaped Scene Controls API and coexists with the retained Token-control tools.
## 1.2.0 persistent-status authorization

Persistent Token status is split into three independent decisions: **permission**, **scope**, and **display policy**. GMs always pass the authorization layer. Non-GMs must have the world permission `viewTokenLabels`, must satisfy the configured player scope (`disabled`, `owned`, `characters`, or `all`), and the Token's Actor must satisfy the configured Actor scope. Per-Token `show` cannot bypass either authorization check.

The display policy is presentation-only: `manual`, `always`, `controlled`, `hovered`, or `controlled-or-hovered`. Manual mode reads the existing client visibility setting; automatic modes read current Token interaction state. `controlToken` and `hoverToken` hooks schedule idempotent refreshes through the existing frame-coalesced label service, so no per-Token DOM or canvas listeners are registered.

Legacy `audience` configuration is retained only for compatibility. A one-time world migration maps it to the new player scope and permission default without modifying Actor, Token, or Scene Documents. The player-specific quick table in Global Module Settings writes only to the module permission setting; those form fields are explicitly excluded from the general configuration payload.


## 1.2.1 chat authorization and player transaction persistence

Chat audience selection is permission-driven through `src/permissions.mjs`; the runtime no longer reads a parallel `configuration.chat` branch. `viewCleaningChat` controls cards generated by deliberate player cleaning and defaults to Player, while `viewStateChat` controls manual administrative state-change cards and defaults to GM. Hidden cards always resolve to GM recipients. Automation explicitly passes `chat: false` for long-rest/world-day/combat/context dirt and contamination processing.

World transaction history remains a GM-owned world setting. A non-GM cleaning action creates a sanitized transaction request on the package-specific `module.runyth-garb-and-grime` socket. The primary active GM resolves the Actor UUID, verifies the claimed user and module permission, resolves the cleaning method from the registry, sanitizes fields, deduplicates the transaction ID, and appends it to the world log. This keeps player actions visible in the GM transaction dashboard without giving players permission to write world settings.

## 1.2.2 player-linked dashboard eligibility

The GM dashboard still begins from supported, visible world Actors and applies the world-level folder/regex scope before expensive Actor summary/hydration work. However, a manual scope is no longer allowed to hide a genuine player-linked `character` Actor. The Manager computes a lightweight set of player-linked Character IDs from non-GM `User.character` links and OWNER-level Actor permission, then treats that set as an inclusion override for the manual folder/regex scope.

This override is intentionally limited to the D&D Actor type `character`; player-owned NPCs, pets, retainers, and other Actor types continue to obey the configured manual scope. `createUser`, `updateUser` changes to `character`/`role`, and `deleteUser` invalidate the open Manager's Actor cache. Actor `ownership` updates were already part of the Actor display invalidation path. No player/user relationship is persisted by Runyth Garb & Grime.
