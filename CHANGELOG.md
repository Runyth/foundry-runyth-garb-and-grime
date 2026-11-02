# Changelog

## 1.2.9 — 2026-10-21

- First publication as a Runyth module: `runyth-garb-and-grime` / **Runyth Garb & Grime** with the publication standard in place — deterministic `-mod`, `-src`, and `-doc` archives with per-version checksums, byte-identical rebuild verification, standard quality and release pipelines, the full GNU AGPL-3.0-or-later licence with the standard source notice, the standard README licence chapter, and the manifest URL surfaces.

### Fixed — existing Token hover labels
- Refresh the cleanliness **content** on `hoverToken`, not merely label position; previously, a cached hidden label could become visible with old text despite the Actor sheet having the new state.
- On transition from hidden to visible, refresh the full label before positioning it.
- Handle both nested and flattened module Actor-flag change payloads from Foundry update hooks.
- Listen to the module-owned state-change hook to refresh local changes immediately, while retaining remote Actor update propagation and frame-coalescing.
- Keep authoritative world Character Actor state for unlinked PC Tokens, independent state for synthetic NPC Tokens, and existing per-player visibility controls.

### Added — configurable soap inventory enforcement
- In **Global Module Settings → Cleaning**, add **Require soap**, **Consume soap**, and **Soap units per wash** (1–100).
- Enforcement is disabled by default for existing campaigns. When enabled, Self-wash with soap is rejected before any payment or cleanliness change if the Actor lacks sufficient soap.
- Match explicitly flagged `soap` integration items or exact Soap/Seife/custom integration aliases; do not match partial names, zero-stock items, or explicitly differently tagged items.
- Support multiple inventory stacks; optionally consume the configured quantity in batch. With consumption disabled, possession is required but inventory is unchanged.
- Prevent duplicate deduction when cleaning is invoked from a soap Item-sheet button which already schedules soap consumption.
- Serialize concurrent soap cleaning operations per Actor within a client, avoiding rapid double-click reuse of the same stock.
- Players cannot bypass enabled enforcement by calling the API with `skipItemRequirements`; authorized GM bulk-clean operations retain their existing bypass behavior.
- Preserve legacy method-specific item requirements for other cleaning methods, and preserve all previous behavior when soap enforcement is disabled.
- Added English and German localization for controls, explanations and quantity validation.

### Compatibility / validation
- Version 1.2.9; public API 1.3.0 and Actor state schema 1 remain unchanged.
- No Scene, Token, Actor or world-data migration required.
- 148 automated tests passed on the working tree.
- Foundry 13.351 and dnd5e 5.3.3 are the primary live test targets; automated tests mock Foundry APIs and cannot replace multiplayer canvas/inventory acceptance testing.

## 1.2.8 — 2026-10-21

### Fixed
- Corrected stale cleanliness readouts on already-deployed unlinked PC Tokens after washing or adjusting their world Actor. Foundry V13 unlinked Token Actors are synthetic ActorDelta instances and can retain old `flags.runyth-garb-and-grime.state` values independently of the world Actor.
- Made the world `character` Actor the canonical Runyth Garb & Grime state source for both Token-overlay rendering and service reads/updates, using Foundry's `TokenDocument.baseActor` when available. Drawn Tokens do not require recreation to display updated state.
- Preserve the existing `updateActor` / frame-coalesced label refresh path; matching uses authoritative `TokenDocument.actorId` as well as prior UUID/ID matching so every affected Token updates on the current Scene and every connected client.
- Player-initiated cleaning through an unlinked Character Token writes the base Actor, with an additional base-Actor permission check; unlinked NPC Tokens continue to maintain independent cleanliness state.
- No copying ActorDelta flags, no Token Document writes, no polling, no Actor/state migrations, no changes to label visibility permissions, appearance, shortcuts, API (`1.3.0`), or schema (`1`).

### Verification
- Added live-Token regressions for multiple deployed unlinked PC Tokens, direct world Actor washing/dirt increases, player-initiated Token washing, newly drawn Tokens, NPC isolation, invalid base links and permission-denied writes.
- Unit/integration tests operate against Foundry-compatible mocks; visual/multiplayer acceptance testing inside a running Foundry V13 world remains necessary.

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
- 130 automated tests, including new default and selected scopes, player permission isolation, GM hide, automatic modes, same-UUID redraw, scene reset, native callback, and static settings integration.
- API version remains `1.3.0`; schema remains `1`; no world-data migration needed.

## 1.2.6 — 2026-10-13

### Fixed
- Removed fixed 18px background-height and 9/12px half-dimension floors that masked Canvas cleanliness label shrinkage at 10–13px font sizes. Label background and placement now follow real text dimensions and configured padding/distance.
- Replaced in-place PIXI TextStyle mutation with a new independently derived `PreciseText` style when any font/colour style value changes. This triggers reliable glyph/layout invalidation while preserving the Foundry v13 string-first constructor.
- Disabled inherited canvas nameplate shadows, strokes, and padding so small module-specific labels do not retain unscaled visual effects.
- Normalized finite numeric visual settings (font size, distance, padding, opacity) consistently; transparent backgrounds (opacity `0`) remain valid.
- Hardened Token redraw/replacement lifecycle: a newly drawn Token using the same document UUID cannot accidentally reuse an obsolete canvas object's label, and a late old-object destroy event cannot remove its replacement.
- Sheets & HUD Scene Controls and label display policy changes now immediately redraw Foundry's Controls UI when needed.

### Help and localization
- Added separate localized hover tooltips for **Enable Scene Control buttons**, **Mirror states as Active Effects**, and **Also mirror contaminations**, explaining precisely what each switch affects and what it leaves unchanged.
- Maintained complete English/German locale-key parity.

### Validation and compatibility
- Added raster-style-aware unit tests for 10/11/12px label geometry, colour, zero-opacity, padding, offset, re-styling, a second Token of the same Actor, same-UUID replacement, and Foundry `drawToken`/`updateSetting` integration. Static tests cover all three localized tooltips and immediate toolbar redraw.
- Public API remains `1.3.0`; Actor state schema remains `1`. No Actor, Token, Scene, or settings migration is required.


## 1.2.5 — 2026-10-10

### Fixed
- Fixed Canvas Token-label presentation settings being saved but not applied immediately. The settings window previously wrote directly through `game.settings.set()` and then repainted before Runyth Garb & Grime's cached merged configuration was reliably invalidated.
- Routed configuration writes through the cache-safe `setConfiguration()` helper, which invalidates before and after persistence.
- Saving **Sheets & HUD** now performs an immediate full label repaint using the newly persisted configuration.
- Resetting the global configuration also immediately refreshes Token labels.

### Compact defaults
- Reduced default Token-label font size from 22 px to 18 px.
- Reduced default Token gap from 10 px to 8 px.
- Reduced default horizontal/vertical padding from 8×4 px to 6×3 px.
- Reduced the minimum configurable font size to 10 px and padding minima to 2×1 px.
- Reduced the default label border/radius slightly for a more compact visual footprint.
- Added a v3 Token-label settings migration which changes only the exact old visual defaults; customized values are preserved.

### Compatibility
- Display behaviour, GM/player permissions, personal viewer preferences, per-Token overrides, Token HUD, Tidy 5e integration, dashboard, Scene guide, chat and transactions remain unchanged.
- Public API remains `1.3.0`; Actor-state schema remains `1`.
- No Actor, Token, or Scene migration is required.

## 1.2.4 — 2026-10-10

### Fixed
- Fixed persistent Token cleanliness labels rendering `[object Object]` instead of the formatted cleanliness text. The root cause was an ambiguous PIXI-v8-style object constructor passed to Foundry V13 `PreciseText`; labels now use the V13-safe string-first constructor.
- Removed the legacy `disabled` player label scope as an independent authorization gate. The **Permissions** tab is now the sole authority for whether a player may see persistent cleanliness status.
- Existing worlds with `playerScope: disabled` migrate to the safe Character-only scope; existing `viewTokenLabels` grants/denials remain unchanged.

### Player display preferences
- A player explicitly allowed **View persistent cleanliness status** can now choose a personal client-side display mode: Follow GM default, Manual, Always, Controlled, Hovered, Controlled or Hovered, or Always Hide.
- Authorized players can also choose a personal label position: Follow GM default, Above, Right, Below, or Left.
- Added a **Cleanliness label display preferences** Scene Control for authorized viewers.
- Personal preferences are client-scoped and never change world configuration, another player's view, or GM per-Token flags.
- GM per-Token **Always hide** and player authorization remain authoritative; a personal preference can never grant access.
- The existing Shift+Alt+G/manual toggle now follows the viewer's effective personal mode.

### Compatibility
- Existing GM world presentation settings, per-Token show/hide/position flags, Token HUD, Scene guide, chat, transactions, dashboard, Tidy 5e integrations, and Actor state remain compatible.
- Public API remains `1.3.0`; state schema remains `1`.
- No Actor, Token, or Scene migration is required.

## 1.2.3

- Fixed Scene Context failing with `Unknown environment profile: undefined` under Foundry V13 DialogV2.
- Replaced invalid nested-dialog form markup with Foundry V13 `button.form` submission handling.
- Fresh Scenes deterministically default to the ordinary profile without passing an undefined selection.
- Stale/deleted Scene profile references are now displayed explicitly as unavailable and can be replaced by the GM without silent remapping.
- Hardened Scene Context validation for missing selections, unavailable profile registry, invalid Scene documents, unknown profile IDs, and persistence failures.
- Scene-context writes preserve unrelated stored flag fields and avoid duplicate user-facing errors.
- Added regression coverage for fresh, valid, stale, missing, registry-unavailable, persistence-failure, and repeated dialog workflows.

## 1.2.2 — 2026-10-10

### Fixed
- Fixed newly added player-character Actors being omitted from the GM dashboard when an older global folder/regex Actor scope excluded them.
- The dashboard now treats Foundry player-character assignment and non-GM OWNER access as authoritative PC signals for `character` Actors.
- Player-linked Character Actors bypass the manual global folder/regex scope while NPCs and other Actor types continue to obey it.
- Added `createUser`, relevant `updateUser`, and `deleteUser` invalidation so changing the player roster or selected character refreshes an already-open Manager immediately.
- The dashboard scope summary now explicitly reports player-linked Characters included from outside the manual scope.

### Root cause
- Runyth Garb & Grime previously built the GM dashboard from supported world Actors and then applied the global folder/regex scope without consulting Foundry's `User.character` relationship or non-GM Actor ownership. Assigning an Actor to a new or additional player therefore could not make an Actor visible if the manual scope had already excluded it.

### Compatibility
- Existing global Actor folder/regex settings remain intact and continue filtering non-player-linked Actors before expensive Actor index work.
- Public API remains `1.3.0`; state schema remains `1`.
- No Actor, Token, Scene, User, or settings migration is required.

## 1.2.1 — 2026-10-10

### Fixed
- Fixed player-initiated cleaning transactions not appearing in the GM Manager transaction log. Player actions now submit a deduplicated transaction record over Runyth Garb & Grime's package-specific Foundry socket; only the primary active GM validates and persists it.
- Declared `"socket": true` in `module.json`, as required for the `module.runyth-garb-and-grime` package socket namespace.
- Fixed chat visibility being controlled by the obsolete Chat configuration independently from the granular Permissions tab.
- Prevented automatic long-rest, world-day, combat-end, environment-exposure, and automatic-contamination state changes from generating chat cards. Daily upkeep remains chat-silent.
- Restricted Manager transaction data to GMs or users explicitly allowed to view hidden GM details.

### Streamlined permissions
- Removed the Chat settings tab from Global Module Settings.
- Removed the duplicate per-player Token-label permission table from the Sheets tab.
- The Permissions tab is now the sole UI for role minimums and per-user Allow/Deny/Inherit overrides.
- Added `viewCleaningChat` (**View player-initiated cleaning chat**), default Player.
- Added `viewStateChat` (**View manual cleanliness-change chat**), default GM.
- Legacy `configuration.chat` data is removed once by migration and is ignored by runtime chat routing.

### Compatibility
- Public API remains `1.3.0`; Actor-state schema remains `1`.
- Existing Actor, Token, Scene, cleanliness, transaction, dashboard, and Token-label data remain compatible.
- No Actor/Token/Scene document migration is required.

## 1.2.0 — 2026-10-10

### Added
- Added the granular `viewTokenLabels` permission for persistent Token cleanliness status. Non-GM users are denied by default; GMs can grant or deny visibility per player through the existing Permissions tab or the Token Labels section in Global Module Settings.
- Added persistent Token-label display policies: Manual, Always, Controlled, Hovered, and Controlled or Hovered.
- Added separate Actor eligibility and player visibility scopes so GMs can limit persistent labels to supported Actors or PCs, and player visibility to disabled, owned Actors, PCs, or all eligible Token Actors.
- Added a compact per-player visibility table directly beside the Token-label configuration without adding language or permission controls to the main dashboard.

### Improved
- Per-Token `show`, `hide`, and position overrides remain authoritative for display behavior but can never bypass player permissions or player scope.
- The manual Shift+Alt+G label toggle is now available to authorized players and remains configurable through Foundry Configure Controls; automatic display policies do not depend on the client toggle.
- Automatic label modes react to Token hover and control changes without rebuilding labels or registering per-Token listeners.
- Existing worlds migrate legacy GM/owners/everyone Token-label audience settings to the new permission/scope model while preserving their previous visibility intent. Fresh/default worlds remain GM-only.

### Correctness and performance
- Prevented Token-label permission form fields from leaking into the general configuration object.
- Saving unrelated Global Module Settings no longer refreshes all canvas labels.
- Saving Token-label-only settings no longer reconciles Active Effects for every Actor unless effect configuration actually changed.
- Re-audited ApplicationV2 actions, hooks, Scene Controls, chat integration, DOM usage, CSS isolation, canvas label lifecycle, and deprecated Foundry globals; no new broad or deprecated integration path was introduced.
- Standardized Actor-panel and Item-integration failure diagnostics to the `[runyth-garb-and-grime]` prefix so runtime errors remain immediately attributable.

### Compatibility
- Public API remains `1.3.0`; state schema remains `1`.
- Existing Token label mode/position flags, Actor state, Scene state, dashboard scope, permissions, and settings remain compatible.
- No Actor, Token, or Scene document migration is required.

## 1.1.5 — 2026-08-25

### Fixed
- Fixed all Manager bulk Actor action failures caused by accessing a private static helper through Foundry ApplicationV2's instance-bound action receiver (`TypeError: Receiver must be class CleanlinessManager`).
- Removed the private-static receiver dependency from bulk Actor resolution and shared one receiver-independent resolver across adjustment, cleaning, and maintenance bulk actions.
- Serialized Actor-browser selection and mutation actions per open Manager instance so rapid repeated clicks execute in order instead of racing Actor/settings writes.
- Added a Runyth Garb & Grime-owned rejection boundary for Actor-browser bulk operations, preventing unhandled promise rejections and emitting one clearly prefixed console error plus a localized Foundry notification if an operation itself fails.

### Validated
- Bulk increase/decrease, water cleaning, full cleaning, maintenance enable/disable, multi-selection, empty selection, filtered/persisted selections, repeated clicks, folder selection, clearing selection, and reopening the Manager.
- Audited all Manager ApplicationV2 action handlers for the same private-static receiver pattern; no other action handler uses a private static member through the Application instance.

### Compatibility
- Public API remains `1.3.0`; state schema remains `1`.
- Existing Actor state, selection persistence, permissions, filters, pagination, Actor scope, and performance optimizations remain compatible.
- No world-data migration is required.

## 1.1.4 — 2026-08-19

### Fixed
- Fixed the Global Module Settings profile editor fallback that displayed missing legacy `levelRatings` as `Expected / Expected / Expected / Expected`.
- Added a one-time repair for bundled presets affected by that fallback, including worlds where saving the editor had persisted the four identical `Expected` values.
- Preserves explicit custom classifications by marking future saved profile ratings as custom and leaving `custom-*` profiles untouched.

### Improved
- Made every bundled environment preset use an explicit, distinct four-level classification gradient.
- Added a colour-coded four-level preview to each profile in Global Module Settings → Contexts so the preset differences are visible at a glance.
- Clarified that the four classifications are authoritative for the Scene guide; expected-min/max remain only as compatibility fallback data for older/custom definitions without classifications.

### Compatibility
- Public API remains `1.3.0`; state schema remains `1`.
- Existing Scene-specific classification overrides are unchanged.
- No Actor, Token, or Scene document migration is required.

## 1.1.3 — 2026-08-08

### Added
- Added a GM-configurable world-level **Dashboard Actor scope** under Global Module Settings → General.
- Added an optional Unicode/case-insensitive regular-expression scope matching Actor name, Actor type, and full Actor-folder path.
- Added a searchable hierarchical Actor-folder selector with Select visible, Clear selection, and optional descendant inclusion.
- Added a visible scope summary to the Actors dashboard tab whenever the global scope is active.

### Improved
- Applies the global Actor scope before cleanliness-summary reads, Actor index hydration, image work, pagination, and DOM preparation, further reducing large-world dashboard cost.
- Keeps per-dashboard text/folder/type/level/selection filters as secondary filters inside the smaller globally scoped pool.
- Ignores stale deleted-folder IDs safely; an empty valid folder selection continues to mean all folders.

### Compatibility
- Existing worlds retain all-Actor dashboard behavior until a GM explicitly configures the new scope.
- No Actor, Token, Scene, or stored cleanliness data migration is required.
- Public API remains 1.3.0 and state schema remains 1.

## 1.1.2 — 2026-08-08

### Fixed

- Reworked the Cleanliness Manager Actors tab so it no longer fully hydrates and renders every Actor in the world on each visit.
- Added bounded Actor-list pagination with 20/40/80/120 rows per page and a conservative default of 40.
- Added a lightweight directory-state summary path that skips full state normalization and deep cloning for Actor-list indexing.
- Detailed date formatting, portrait resolution, image diagnostics, and row hydration now run only for the current page.
- Cached lightweight Actor index rows across Manager rerenders and invalidated only the Actor or folder entries affected by Foundry document changes.
- Removed unnecessary scent/roll-context evaluation from the detailed Actors tab; scent evaluation remains on the Overview where it is displayed.
- Explicitly releases Manager Actor caches, listener controllers, filter timers, and focus references when the dashboard closes.
- Bounded failed-image and warning caches to prevent unbounded browser-session growth after many bad portrait paths.
- Added responsive pagination controls and localization in English and German.

### Compatibility

- Public API remains `1.3.0`.
- State schema remains `1`.
- No Actor, Token, Scene, or settings migration is required.

## 1.1.1 — 2026-08-08

### Fixed

- Prevented the Manager and Actor cleanliness panel from inserting Actor portrait URLs owned by unavailable modules into rendered HTML, eliminating repeated HTTP 404 spam from stale portrait paths during tab changes and rerenders.
- Added a safe portrait resolution chain: valid Actor image, valid prototype-Token texture, then a bundled Runyth Garb & Grime fallback avatar.
- Cached genuine image-load failures for the browser session so subsequent Runyth Garb & Grime rerenders do not repeatedly retry the same broken URL.
- Added grouped, deduplicated console diagnostics prefixed with `[runyth-garb-and-grime]`, including an explicit hint when a known successor module is installed.

### Compatibility

- Runyth Garb & Grime never rewrites `Actor.img`, prototype-Token texture data, or assets owned by another module.
- Legacy predecessor-module references in asset sources are detected only for display safety; the module does not guess renamed paths.
- Existing Actor, Token, Scene, settings, transactions, public API, and state schema remain unchanged.
- Errors attributed by Foundry to other packages remain untouched.

## 1.1.0 — 2026-08-04

### Added

- Added a prominent dashboard launcher inside Global Module Settings.
- Added a dedicated Runyth Garb & Grime group to Foundry's left Scene Controls with Manager, Scene guide, Scene context, and bulk-action tools.
- Added a scalable Actor browser with hierarchical folder paths, recursive/non-recursive folder filtering, text and regular-expression search, Actor-type and cleanliness filters, persistent selection, folder selection, sorting, and bulk actions.
- Added optional per-Scene classification of all four dirt levels as Expected, Accepted, Tolerated, Disliked, or Hated.
- Added a movable, resizable, persistent, GM-only Scene Cleanliness Guide.
- Added configurable profile defaults and Scene-specific classification overrides.
- Added public API methods `getSceneLevelRatings`, `setSceneLevelRatings`, `openSceneGuide`, and `toggleSceneGuide`; API version is now 1.3.0.

### Improved

- Added localized dashboard, Actor-browser, Scene-guide, classification, notification, and validation text in German and English.
- Added explicit bulk water, full-cleaning, and automatic-upkeep actions for selected Actors.
- Preserved all existing Settings-sidebar, Actors-sidebar, sheet, Token HUD, Token-label, context, chat, automation, and currency workflows.

### Fixed

- Corrected detailed Actor-row scent evaluation in the expanded scalable browser.
- Corrected bulk Actor-action notifications to include the performed action.

### Compatibility

- No Actor-state schema migration is required.
- Existing Actor, Token, Scene context, settings, transaction, and API data remain compatible.
- Scene classifications are advisory only and do not silently modify Actors, rolls, or reactions.

## 1.0.10 — 2026-08-03

- Added bounded asynchronous processing for bulk Actor, Token, migration, automation, maintenance, and Active Effect refresh workflows.
- Coalesced reactive ApplicationV2 and Token-label rerenders into one browser frame.
- Cached merged configuration and permission settings with Foundry `onChange` invalidation.
- Made the Manager and Global Module Settings prepare only data required by the active tab.
- Replaced repeated Manager listeners with delegated listeners cleaned up by `AbortController`.
- Batched concurrent transaction-log writes and multi-Item quantity updates.
- Skipped Active Effect reconciliation when only non-visual state fields change.
- Reused registry definitions internally without unnecessary defensive cloning while preserving cloned public results.
- Serialized and deduplicated persisted window-position writes.
- Reduced Token-label work by separating full state refreshes from position-only refreshes and coalescing canvas hooks.
- Added performance regression coverage for concurrency limits, render coalescing, settings caches, effect skipping, transaction batching, and lifecycle cleanup.
- Preserved state schema 1, public API 1.2.0, permissions, chat behavior, automation rules, and all existing UI workflows.

## 1.0.9 — 2026-08-03

- Confirmed and standardized Foundry-native manifest localization for German and English.
- Localized remaining validation, registry, initialization, and automation-area messages that were hard-coded in English.
- Added a read-only localization status block to Global Module Settings; no dashboard language selector was added.
- Documented Foundry Language Preference usage and the process for adding further translation files.
- Added localization regression checks for manifest languages, key parity, runtime error paths, and the absence of a competing module language setting.

All notable changes to Runyth Garb & Grime are documented here.

## 1.0.8 — 2026-08-02

### Fixed

- Migrated UUID resolution to the Foundry V13 `foundry.utils.fromUuid` and `foundry.utils.fromUuidSync` namespaces.
- Prevented hidden-by-default contamination cards and contamination Active Effects from exposing GM-only details to players.
- Replaced destructive Active Effect recreation with idempotent reconciliation, and now remove stale module effects when effect mirroring is disabled.
- Prevented multiple active GM clients from applying combat-end and world-day automation more than once.
- Contained rejected Promises from automation hooks, Scene Controls, Item integration, sidebar bulk actions, and the Token-label keybinding.
- Prevented duplicate Actor and Item sheet integrations during Tidy 5e or other partial sheet renders by preferring the complete application root.
- Corrected the Manager's last-updated sorting to use timestamps rather than localized display text.
- Preserved Manager search focus and caret position after debounced filter rerenders.
- Prevented custom definition ID collisions after deleting and creating methods, contexts, or contaminations.

### Improved

- Added confirmation before deleting custom cleaning methods, environment profiles, or contaminations.
- Added scoped padding and layout rules for Runyth Garb & Grime-owned DialogV2 forms without affecting other dialogs.
- Added regression coverage for Active Effect reconciliation, hidden contamination privacy, primary-GM automation, namespaced V13 utilities, partial-render idempotence, and Manager/settings UX.

## 1.0.7 — 2026-07-29

### Fixed

- Prevented the cleanliness indicator from appearing in level-up, advancement, rest, roll, and other Actor-related pop-up applications.
- Removed global ApplicationV1/ApplicationV2 and global sheet-header control fallbacks from Actor-sheet integration.
- Scoped title-bar ordering CSS to headers explicitly marked by Runyth Garb & Grime; unrelated Foundry and module windows are no longer affected.
- Scoped the accessibility-only `.sr-only` rule to Runyth Garb & Grime applications.
- Restricted Item tools, sidebar launchers, and Token HUD augmentation to their semantic Foundry render hooks.

### Improved

- Added explicit Tidy 5e Modern and Classic Actor-sheet integration using Tidy's documented render hook and `data-tidy-sheet-part` targets.
- Added regression coverage that rejects generic application hooks, unscoped window-control CSS, and accidental child-dialog augmentation.

## 1.0.6 — 2026-07-26

### Added

- Added configurable Token-label font colour, background colour, background opacity, and horizontal/vertical padding.
- Added clearer defaults: bold white text on a nearly opaque dark background with a dirt-level accent border.
- Added per-Token and selected-Token position overrides for above, right, below, left, or global-default placement.
- Added public API 1.2.0 methods for per-Token and selected-Token label positioning.

### Fixed

- Moved Token labels into one dedicated `canvas.interface` container so they always render above Token artwork, including overlapping Tokens.
- Preserved idempotent rendering and existing display overrides without changing Actor or Scene data.

## 1.0.5 — 2026-07-26

### Added

- Added optional canvas cleanliness labels beside Tokens without replacing Foundry nameplates.
- Added a GM global display toggle in Scene Controls, Global Module Settings, and the configurable **Shift+Alt+G** keybinding.
- Added per-Token **follow global**, **always show**, and **always hide** overrides through the Token HUD and selected-token Scene Control.
- Added configurable label audience, position, content format, font size, and offset.
- Added public API 1.1.0 methods for global and per-Token label control.
- Added idempotency and visibility regression coverage so canvas refreshes do not duplicate labels.

## 1.0.4 — 2026-07-25

### Fixed

- Audited the complete module and confirmed Runyth Garb & Grime registers no `renderChatMessage` or other chat-render hook; passive action cards continue to use the supported `ChatMessage.create()` workflow.
- Added regression coverage that rejects deprecated chat hooks and jQuery chat-render assumptions and verifies exactly one correctly populated card for state and cleaning actions.
- Documented that deprecation warnings triggered after card creation originate from another enabled module listening to all chat messages.

## 1.0.3 — 2026-07-25

### Added

- Added explicit +1 and −1 dirt controls for all controlled Tokens in the Cleanliness Manager and Scene Controls bulk dialog.
- Added checkbox-based multi-Actor selection to the Manager's Actors tab, including select-visible, clear-selection, and simultaneous +1/−1 actions.
- Added +1/−1 quick actions for Actors selected in the Foundry Actors sidebar, including compatibility with checkbox-based and common multi-selection markers.

### Fixed

- Moved the sheet cleanliness status left of Foundry's ellipsis and close controls so core window controls remain farthest right.
- Added narrow-window behavior that shortens the sheet status without displacing Foundry's core controls.

## 1.0.2 — 2026-07-25

### Fixed

- Fixed every Cleanliness Manager tab and Global Module Settings tab under Foundry V13.
- Replaced the reserved ApplicationV2 `data-action="tab"` action with a module-specific `switchTab` action so Foundry no longer calls `changeTab` without a tab-group identifier.
- Preserved the existing rerender-based tab state, including the per-user active Manager tab setting.
- Added regression validation that rejects reintroduction of the reserved tab action in module templates.

## 1.0.1 — 2026-07-25

### Fixed

- Deferred public API exposure until Foundry's `init` lifecycle so early access to `game.modules` cannot prevent all module hooks and settings from registering.
- Isolated settings, Actor-sheet, Token HUD, Scene Controls, sidebar, item, roll, and automation initialization; one optional integration can no longer suppress every entry point.
- Added visible permanent feedback when initialization is only partially successful.
- Added Foundry v13 ApplicationV2 and ApplicationV1 Actor-sheet header controls with defensive in-sheet fallbacks.
- Made Token HUD insertion tolerant of current and alternate HUD layouts.

### Added

- Prominent Runyth Garb & Grime card in the Settings sidebar with **Open Cleanliness Manager** and GM-only **Open global module settings** buttons.
- Prominent launcher card in the Actors sidebar.
- Two explicit Configure Settings submenus under Runyth Garb & Grime: the player-accessible Cleanliness Manager and GM-restricted Global Module Settings.
- Updated first-run guide with direct Manager and Global Settings actions and exact navigation instructions.
- Automated validation for init-safe API exposure and every independent launcher family.

## 1.0.0 — 2026-07-25

### Added

- Four-level body and clothing cleanliness model with independent values.
- Visible and GM-hidden contamination tags with effective dirt penalties and scent behavior.
- German and English localization, including the complete German player rules reference.
- Cleanliness Manager with overview, Actor list, filters, sorting, bulk actions, rules, transaction log, and GM shortcuts.
- Permanent launchers in Module Settings, Actors sidebar, Scene Controls, Actor sheets, and owned Token HUDs.
- Per-user persistence for manager, Actor panel, and configuration window size and position; manager tab, filters, and sorting also persist.
- Configurable cleaning methods using literal `Mark` currency defaults.
- Optional long-rest, world-day, combat-end, activity, extreme exposure, and daily-limit automation.
- Optional daily upkeep with record-only, no-payment, prompt-before-payment, and explicit automatic-deduction modes.
- Accrued upkeep debt, once-per-day upkeep charging, visible payment failure, manual settlement, transaction logging, and extensible currency adapters.
- Configurable Scene context profiles stored in Scene flags, including functional settlement tags and explicit service-method availability overrides.
- D&D 5e v5.2+ `preRollSkillV2` integration using the current process-configuration signature, with advisory, visible GM four-choice prompt, and visible automatic modes.
- Item flags, alias mappings, Item-sheet configuration, consumption, cleaning, and scent masking.
- Optional synchronized Active Effects with Actor flags as the authoritative state.
- Granular role-based permissions, per-user Allow/Deny/Inherit overrides, hidden-state filtering, and Actor ownership enforcement.
- Stable public API 1.0.0 and vetoable lifecycle hooks.
- Schema validation, lazy Actor flags, migration, malformed-state recovery, synthetic Actor compatibility, and duplication-safe data.
- Dependency-free automated validation and live manual test checklist.
