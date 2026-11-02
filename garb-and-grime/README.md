# Garb & Grime

**Garb & Grime** is a Foundry VTT module for clothing cleanliness, body odor, contamination, social context, scent tracking, and optional daily upkeep in D&D 5e campaigns.

- Module ID: `garb-and-grime`
- Module version: `1.2.9`
- Public API: `1.3.0`
- Primary target: Foundry VTT v13 and D&D 5e 5.2+
- Languages: German and English through Foundry VTT's native Language Preference
- Dependencies: none

The primary source of truth is the Actor flag `flags.garb-and-grime.state`. The module writes no Actor data until that Actor is first used.

## Patch release 1.2.9

**Existing Token hover indication:** hovering a deployed Token now reloads current cleanliness text from its authoritative Actor, even when the label was hidden/cached. Both expanded and dotted Actor flag update payloads schedule a frame-coalesced refresh of live Tokens; local state changes also refresh through the module hook. No Token replacement is needed.

**Optional soap requirement:** Under **Global Module Settings → Cleaning**, the GM can turn on **Require soap**, set **Soap units per wash** (1–100), and choose whether those units are actually consumed. This checks the Actor inventory *before* any currency deduction or cleanliness change. Soap is recognized by exact Soap/Seife names, configured soap-integration aliases, or the module's explicit Soap item-integration flag. Empty stacks, partial matches, and items tagged for another integration do not qualify. Multiple soap stacks are supported. If consumption is off, soap must still be present but is not deducted. Item-sheet use of a Soap item never double-consumes the same item. There is no chat card or successful transaction for a refused wash.

The default **Require soap: Off** preserves existing campaigns. Players cannot bypass an enabled requirement with the API's skip option. GM bulk-clean operations remain explicitly exempt, and other cleaning methods retain their method-specific requirements. Local rapid repeated attempts are serialized per Actor. Cross-client simultaneous inventory writes still depend on Foundry's core Document update consistency; the module does not claim a server-wide inventory transaction lock.

## Patch release 1.2.8

Existing deployed unlinked Character Tokens no longer display stale cleanliness when their world Actor is washed or becomes dirtier. In Foundry V13 unlinked Tokens use synthetic ActorDelta Actors whose flags may remain an old snapshot of the world Actor; Garb & Grime now treats the world `character` Actor as the authoritative source for cleanliness on all its Tokens, resolving via Foundry's TokenDocument `baseActor` and `actorId` rather than reading an outdated synthetic Actor flag.

The normal `updateActor` hook schedules a frame-coalesced refresh of **all currently deployed matching Token labels** on each connected client, with no scene reload or Token re-creation. Freshly drawn Tokens and newly viewed Scenes also read the same canonical state. A cleanliness change initiated through an unlinked Character Token now persists to the world Actor, rather than becoming an isolated synthetic-token update. World Actor ownership is checked before a player may alter it through a Token. NPC synthetic Token Actors deliberately retain their independent cleanliness state; no existing TokenDocuments, deltas, or Actor state schemas are rewritten and no global per-frame polling is added.

## Patch release 1.2.7

The native **Shift+Alt+G** cleanliness-label shortcut now toggles labels for **all player-linked character Tokens on the current Scene** by default, without selecting anything. The GM configures the scope in **Global Module Settings → Sheets & HUD → Canvas Token Labels**: all player-character Tokens, selected player-character Tokens, all eligible Tokens, or selected eligible Tokens. An adjacent toggle enables/disables the shortcut. Each viewer can change the key combination through **Foundry Game Settings → Configure Controls → Garb & Grime**; the module does not intercept raw browser keyboard events.

Each press reconciles the chosen local Token group: if every label is visible, all are hidden; otherwise all are shown. This works in automatic visibility modes as well as Manual mode. The shortcut is **client-only**: it does not change world configuration, Token flags, Actor state, or other viewers' labels. The override survives redrawing a Token on the same Scene, but resets upon changing Scenes, changing personal display preference, or reloading the client. Explicit GM **Always hide**, viewer's personal **Always hide**, world-level label disablement, Token visibility, eligible Actor scope, player-scope restrictions, and the authoritative **Permissions → View persistent cleanliness status** continue to apply. Selected-target modes warn when no Token is selected; no chat messages are emitted.

## Patch release 1.2.6

Version 1.2.6 fixes Canvas Token-label sizing and restyling after **Global Module Settings → Sheets & HUD** changes. The former 18px minimum background height and fixed label half-dimensions prevented 10–13px text settings from producing proportionally small boxes and positions. The renderer now measures each label from its current text, font and padding without the artificial floor.

On style changes, existing `PreciseText` objects receive a new TextStyle so PIXI can invalidate and measure the updated glyphs. Inherited large Foundry canvas nameplate strokes and shadows are removed from these module-specific labels. Both full refreshes and newly drawn/replaced Token objects receive current saved styling. A delayed destroy event for a replaced Token cannot remove its replacement label.

The three Sheets & HUD toggles **Enable Scene Control buttons**, **Mirror states as Active Effects**, and **Also mirror contaminations** have localized hover explanations. Changes to Scene Control visibility and label display policy are applied to the toolbar immediately after saving. Existing personal player preferences and GM permissions are unchanged; no document migration is necessary.

## Patch release 1.2.5

Version 1.2.5 fixes Canvas Token-label presentation settings not applying immediately after saving **Global Module Settings → Sheets & HUD**. Configuration writes now invalidate the merged settings cache before and after persistence, and a Sheets & HUD save immediately repaints existing canvas labels with the newly saved format, position, font, colours, opacity, padding, and offset.

The default label footprint is also smaller: 18 px font, 6×3 px padding, and an 8 px Token gap. Worlds still using the exact previous visual defaults are migrated to the compact defaults; any customized visual setting prevents that migration so user styling is preserved.

## Patch release 1.2.4

Version 1.2.4 fixes the persistent Token-label renderer showing `[object Object]`. Foundry V13 `PreciseText` is now constructed with a string text value directly instead of an ambiguous object-shaped constructor argument.

The **Permissions** tab is authoritative for player access to persistent cleanliness labels. Once **View persistent cleanliness status** is allowed for a player, that player can choose a personal client-side display mode and position from the Garb & Grime Scene Controls. Personal choices never grant access, never alter another client, and never modify the GM's per-Token flags. The old player-scope `Disabled` value is migrated to Character-only eligibility so a permission grant cannot be contradicted by a second hidden authorization switch.

## Patch release 1.2.3

Version 1.2.3 fixes the Foundry V13 Scene Context dialog submission path. DialogV2 owns the form, so Garb & Grime now reads the selected profile from the submitting button's native `form` instead of nesting and querying a second `<form>`. Fresh Scenes default deterministically, stale profile references remain visible until the GM explicitly chooses a replacement, and Scene Context errors are classified and reported once.

## Patch release 1.2.2

Version 1.2.2 fixes dashboard eligibility when a world grows after the original party was configured. The root cause was not pagination: Garb & Grime's manual global Actor scope was evaluated without considering Foundry's player-character links. A Character Actor assigned as a non-GM user's selected character—or owned by a non-GM user—can therefore no longer be hidden by an older folder/regex scope. User create/update/delete events now invalidate and rerender the open Manager immediately.

The folder/regex scope remains active for all other supported Actors, preserving the large-world performance filter. Player-linked bypass is limited to `character` Actors so player-owned NPCs, pets, and similar Actors do not unexpectedly enter the dashboard.

## Patch release 1.2.1

Version 1.2.1 makes the **Permissions** tab the single authorization source for Garb & Grime chat and player visibility decisions. The former Chat settings tab and the duplicate per-player Token-label permission editor are removed. Player-initiated cleaning uses the new **View player-initiated cleaning chat** permission, enabled for Players by default; manual administrative cleanliness changes use **View manual cleanliness-change chat**, GM-only by default. Automatic long-rest, world-day, combat, environment-exposure, daily-upkeep, and automatic contamination changes do not create chat cards.

Player cleaning transactions are now forwarded through Garb & Grime's Foundry module socket to the primary active GM, which validates and persists them in the world transaction log. Players never receive world-setting write authority.

## Feature release 1.2.0

Version 1.2.0 adds GM-controlled persistent cleanliness visibility. Persistent Token labels remain GM-only by default, while the authoritative **Global Module Settings → Permissions** tab can grant the dedicated **View persistent cleanliness status** permission to individual players. The same section controls whether labels are manual, always visible, visible for controlled Tokens, visible on hover, or visible on control/hover, plus separate Actor and player scopes.

Per-Token **Always show**, **Always hide**, and position overrides still work, but never bypass a player's visibility permission. Existing worlds retain the intent of their former GM/owners/everyone audience setting through an automatic settings migration; no Actor or Token data is rewritten.

## Feature release 1.1.0

Version 1.1.0 makes the dashboard visible from the module's Global Module Settings and from a dedicated **Garb & Grime** group in Foundry's left Scene Controls. The Actors tab now scales to large worlds through folder hierarchy, optional recursive folder filtering, text or regular-expression search, Actor-type and cleanliness filters, persistent selection, folder selection, sorting, and bulk cleaning or upkeep actions.

The release also introduces an optional GM-only **Scene Cleanliness Guide**. Every Scene context can classify all four cleanliness levels as **Expected**, **Accepted**, **Tolerated**, **Disliked**, or **Hated**. The guide is a movable, resizable, persistent ApplicationV2 window and is purely advisory: it does not change Actors, rolls, reactions, or chat.

## Performance and responsiveness

Version 1.0.10 performs independent bulk work with bounded concurrency, coalesces reactive Application and Token-label rendering into browser frames, caches merged settings, batches transaction and embedded-Item writes, and prepares only the active Manager or Global Settings tab. Operations on one Actor remain ordered, and public API cloning behavior is unchanged. See `docs/PERFORMANCE_AUDIT_1.0.10.md` for the complete audit.

## Localization

Garb & Grime uses Foundry VTT's native package localization. The active language follows **Game Settings → Configure Settings → Core Settings → Language Preference**. German and English are bundled; the Global Module Settings window shows the active Foundry language and available translations. See `docs/LOCALIZATION.md` for adding another language.

## Installation

Extract the installable ZIP into Foundry's user-data modules directory so the final path is:

```text
Data/modules/garb-and-grime/module.json
```

Restart Foundry if necessary, enable **Garb & Grime** in the world, and reload.

## Finding the module

The interface is deliberately available from several independent locations. A failure in one optional integration no longer suppresses the others.

### Most obvious GM route

1. Open **Game Settings** in the right sidebar.
2. Press **Configure Settings**.
3. Open **Module Settings**.
4. Find **Garb & Grime**.
5. Use either **Open Cleanliness Manager** or **Open global module settings**.
6. Inside Global Module Settings, the **General** tab contains a prominent **Open dashboard** card.

The Settings sidebar itself also shows a prominent **Garb & Grime** card with both buttons for a GM.

### Additional routes

1. **Actors sidebar** → prominent **Garb & Grime** card → **Open Cleanliness Manager**.
2. **Primary Actor sheet** → clickable cleanliness indicator. Garb & Grime does not insert controls into level-up, advancement, rest, roll, or other Actor-related dialogs.
3. **Owned Token HUD** after right-clicking a token → shirt submenu.
4. **Left Scene Controls → Garb & Grime** → dedicated Manager, Scene guide, Scene context, and bulk-action tools.
5. **Scene Controls → Token Controls** → retained Garb & Grime tools for Token-focused workflows.

The first GM login after installation or every module update shows a usage guide with direct Manager and Global Settings buttons.

## Basic use

1. Open the **Cleanliness Manager**.
2. Open the **Actors** tab to filter by hierarchical folder, optional subfolders, text or regular expression, Actor type, selection, dirt level, and sort order. Select visible rows or whole folder groups for bulk changes.
3. Select one or more tokens to use travel, extreme exposure, water, full cleaning, or contamination bulk actions.
4. Click an Actor row or sheet indicator to open the Actor's dedicated panel.
5. Body and clothing levels can be edited independently by an authorized user.
6. Set the current Scene context to **Gepflegt**, **Gewöhnlich**, **Arm oder gesetzlos**, **Wildnis**, or another profile.
7. Optionally open the **Scene Cleanliness Guide** to keep all four Scene classifications visible to the GM.
8. Relevant D&D 5e skill rolls receive an advisory notification. The GM can instead select a visible four-way roll prompt or visible automatic handling; advisory mode is the default.

The **Rules** tab contains the complete German player-facing explanation supplied for the campaign.

## Scene cleanliness classifications

Each environment profile and Scene can classify the complete cleanliness range independently:

- **Expected**
- **Accepted**
- **Tolerated**
- **Disliked**
- **Hated**

The Scene flag stores only the selected context and optional four-value override. Profile defaults remain editable in **Global Module Settings → Contexts**, where each profile now shows a colour-coded four-level preset preview before the editable selectors. Use the dedicated left Scene Control, Manager overview, or Global Module Settings to open the GM-only guide. Its window position and size persist per user. Enabling **open on Scene change** is optional and disabled by default.

Bundled preset classifications:

| Preset | Clean (0) | Worn (1) | Dirty (2) | Stinking (3) |
|---|---|---|---|---|
| Clean | Expected | Accepted | Disliked | Hated |
| Ordinary | Accepted | Expected | Tolerated | Disliked |
| Poor or lawless | Hated | Tolerated | Expected | Accepted |
| Wilderness | Disliked | Accepted | Expected | Tolerated |
| Military | Accepted | Expected | Accepted | Disliked |
| Religious | Expected | Tolerated | Disliked | Hated |
| Court or nobility | Expected | Disliked | Hated | Hated |
| Sewer | Hated | Disliked | Accepted | Expected |
| Swamp | Disliked | Tolerated | Expected | Accepted |
| Battlefield | Hated | Disliked | Tolerated | Expected |

The four classifications above are authoritative for the Scene guide. The older expected-minimum/maximum fields are retained only as fallback compatibility data for definitions that do not provide four classifications. These classifications are descriptive GM guidance only; they do not automatically apply reputation, refusal, reaction, roll, or Actor-state effects.

## Token cleanliness labels

GMs can display a compact cleanliness label next to canvas Tokens without replacing Foundry's normal Token nameplate. Labels are disabled visually by default so updating does not change an existing Scene until the GM enables them.

Global controls:

1. **Scene Controls → Token Controls → Toggle cleanliness labels**.
2. Default keyboard shortcut **Shift+Alt+G**, configurable through Foundry's **Configure Controls** menu.
3. **Global Module Settings → Actor sheets & Token HUD → Token cleanliness labels**.

Per-Token controls are available from the GM Token HUD and selected-token Scene Controls. Each Token can **follow the global toggle**, **always show**, or **always hide**. Its position can independently follow the global default or be forced above, right, below, or left. These overrides are stored only on that Token; Actor cleanliness remains unchanged.

Configuration includes audience (GM, owners, or everyone), global default position, label format, font size, distance, font colour, background colour, background opacity, and horizontal/vertical padding. Available formats are level and name, name only, level only, or detailed body/clothing values. The default uses bold white text on a nearly opaque dark background with a dirt-level accent border.

Labels are rendered in a dedicated interface-layer container above the Token layer. They remain visible when another Token overlaps the labelled Token and do not alter Foundry's built-in Token nameplates.

## Default dirt levels

| Level | German | English meaning |
|---:|---|---|
| 0 | Sauber | Clean body and clothing; a groomed appearance is possible. |
| 1 | Getragen | Visible travel or work wear, normally without a mechanical consequence. |
| 2 | Schmutzig | Noticeable stains and odor; social consequences in clean environments. |
| 3 | Stinkend | Strong mud, sweat, blood, decay, sewage, or comparable odor. |

Relevant contamination may make the effective level one step worse without overwriting the visible body or clothing level.

## Default cleaning methods

| Method | Time | Cost | Result |
|---|---:|---:|---|
| Wasser ohne Seife | 30 minutes | Free | Body and clothing each decrease by exactly one level. |
| Selbstwäsche mit Seife | 1 hour | 1 Mark | Body and clothing become level 0. |
| Waschhaus oder einfache Herberge | 4 hours | 2 Mark | Body and clothing become level 0. |
| Gutes Badehaus mit Wäscher | 2 hours | 5 Mark | Level 0 plus temporary groomed state. |
| Saubere Wechselkleidung | 1 minute | No direct cost | Clothing becomes clean; body odor remains. |
| Täglicher Unterhalt | 1 day | 2 Mark | Optional settlement upkeep service. |

All names, costs, currencies, times, effects, item requirements, temporary states, and availability rules are editable by the GM. `Mark` is a literal campaign currency label and is never silently converted to GP.

## Daily upkeep and currency safety

Daily upkeep is disabled by default. The default payment mode records a service and any accrued upkeep cost without deducting currency.

Automatic deduction requires all of the following:

1. Daily upkeep enabled.
2. The Actor opted in.
3. Payment mode set to automatic.
4. Automatic deduction explicitly enabled.
5. A configured currency adapter that can pay the requested `Mark` amount.

Built-in adapters:

- **Record only**: never deducts currency.
- **D&D 5e denomination**: uses an explicitly configured `system.currency.<denomination>` path.
- **Actor flag wallet**: uses a configurable Actor data path, defaulting to `flags.garb-and-grime.wallet`.

A complementary module can register the campaign's custom Mark economy through the public API. Failed or cancelled payments leave the cleanliness state unchanged and create visible feedback. Recorded upkeep debt can be settled from the Actor panel.

## Item integration

An Item sheet includes a GM-only **Garb & Grime use** selector. Assign an Item to soap, spare clothing, perfume, scent masking, washing kit, towel, laundry voucher, or magical cleaning. Default aliases also recognize common German and English names, while module flags and the API provide stable name-independent integration.

Authorized owners can press **Use for cleaning** on a configured owned Item. Consumable quantities are checked and reduced only when the action succeeds.

## Permissions

The configuration hub exposes minimum Foundry roles for:

1. View own cleanliness.
2. Modify own cleanliness through permitted actions.
3. Use services.
4. Consume cleaning Items.
5. Change clothing.
6. View party cleanliness.
7. View persistent Token cleanliness status.
8. View player-initiated cleaning chat.
9. View manual cleanliness-change chat.
10. Modify other Actors.
11. Configure Scene contexts.
12. Manage cleaning methods.
13. Manage module settings.
14. View GM-only details.

Actor ownership is still enforced for ordinary player actions. Every permission—including persistent Token labels and chat visibility—supports explicit per-user Allow, Deny, or Inherit overrides from the Permissions tab only. GM notes and hidden contamination entries are removed from player-facing state. Players cannot use GM-only methods or directly edit arbitrary Actors unless the permission configuration explicitly allows it.

## Chat and Active Effects

Chat visibility is permission-driven. Player-initiated cleaning is visible to all Players by default through **View player-initiated cleaning chat**; manual administrative state-change cards are GM-only by default through **View manual cleanliness-change chat**. Per-user Allow/Deny overrides live only in the Permissions tab. Hidden actions remain GM-only, and automatic dirt/maintenance events are chat-silent.

Optional Active Effects mirror dirty, stinking, groomed, mixed body/clothing, and configured contamination states. Actor flags remain authoritative; effects are presentation only and can be disabled without losing data.

Effect synchronization is idempotent: unchanged module effects are retained rather than deleted and recreated after every state update. Disabling effect mirroring removes existing Garb & Grime effects without changing Actor flags. Hidden GM contaminations are never mirrored into player-visible effects.

## Public API

```javascript
const api = game.modules.get("garb-and-grime")?.api;

const state = api.getState(actor);
await api.adjustDirt(actor, 1, { reason: "Travel" });
await api.cleanActor(actor, "water");
await api.setSceneContext(canvas.scene, "ordinary");
await api.setSceneLevelRatings(canvas.scene, ["accepted", "expected", "accepted", "disliked"]);
api.openSceneGuide();
await api.promptRollContext(actor, "per");
api.openActorPanel(actor);
```

The API includes every requested state, contamination, cleaning, context, currency, item, UI, and roll-evaluation method. See [Public API](docs/API.md) for complete objects, hooks, veto behavior, and an adapter example.

## Roll handling

Roll integration uses the D&D 5e v5.2+ process-configuration hook and never depends on a legacy Actor/skill callback signature. Three GM-configurable modes are available:

| Mode | Behavior |
|---|---|
| Advisory | Displays the reason and leaves the pending roll untouched. This is the default. |
| GM prompt | Pauses a GM-initiated relevant skill roll and offers **Advantage**, **Normal**, **Disadvantage**, or **Ignore cleanliness** before safely repeating it. Player rolls remain advisory. |
| Automatic | Applies only firm advantage/disadvantage recommendations after visibly displaying the reason. Conditional or impossible recommendations remain advisory. |

The Actor panel also exposes the same explicit GM choice for Persuasion, Deception, Intimidation, and scent-based Stealth. Duplicate prompts are suppressed for the configured interval.

## Actor-sheet compatibility and isolation

Garb & Grime augments only primary Actor sheets. It deliberately does not use global `renderApplicationV1`, `renderApplicationV2`, or global header-control hooks, because level-up, advancement, rest, roll, and configuration applications can also expose an Actor without being an Actor sheet.

For core D&D 5e sheets, the indicator is placed immediately before the sheet's own ellipsis and close controls. Its ordering CSS is enabled only on the exact header marked by Garb & Grime.

For Tidy 5e Sheets (no hard dependency):

- Modern sheets use `renderActorSheetV2` and Tidy's `actor-name` sheet part.
- Classic sheets use `tidy5e-sheet.renderActorSheet` and Tidy's `name-container` sheet part.
- Partial renders are idempotent and never create duplicate indicators or listeners.
- The indicator stays in the Actor identity area rather than the Foundry window-control bar.

Item integration likewise uses only Item-sheet render hooks. Sidebar launchers use only Actor-directory and Settings-sidebar hooks.

## Compatibility

| Component | Declared support |
|---|---|
| Foundry VTT | Minimum 13; verified manifest target 13.351; best-effort allowance through 14 |
| D&D 5e | Minimum 5.2.0; designed against 5.3.3 conventions |
| Other systems | Core state API may work, but sheet, rest, currency, and skill-roll integration target D&D 5e |
| Required modules | None |

Core D&D 5e Actor sheets use Foundry's semantic Actor-sheet render hooks. Tidy 5e Modern and Classic Actor sheets use Tidy's documented Actor-sheet hook and stable `data-tidy-sheet-part` integration points. Unsupported sheets fail closed: Garb & Grime does not inspect generic applications or inject into Actor-related dialogs, and the manager plus Token HUD remain available as fallbacks.

In worlds with multiple connected GMs, broadcast combat-end and world-day automation is processed only by the deterministic primary active GM, preventing duplicate state changes and upkeep charges.


## Dashboard Actor scope

For large worlds, GMs can restrict which Actors the dashboard considers at all under **Game Settings → Configure Settings → Module Settings → Garb & Grime → Global Module Settings → General → Dashboard Actor scope**.

- **Actor scope regular expression** matches Actor name, Actor type, and the full Actor-folder path.
- **Dashboard Actor folders** is a searchable hierarchical folder selector with Select visible / Clear selection controls.
- **Include descendants** includes Actors stored in nested subfolders beneath selected folders.
- Folder scope and regex are combined with AND.
- Leaving both filters empty preserves the legacy behavior and includes every supported Actor the current user can view.
- The scope affects dashboard lists and dashboard bulk management only. It does not disable Token HUD, Actor-sheet indicators, Token labels, automation, Scene rules, or the public API for excluded Actors.

The scope is applied before Garb & Grime reads directory cleanliness summaries, resolves portraits, paginates rows, or builds Actor DOM, so it reduces work in addition to reducing visual clutter.

## Troubleshooting

| Symptom | Resolution |
|---|---|
| No module entry appears anywhere | Confirm version 1.2.4 is installed, reload the world and all browser clients, then check **Game Settings → Configure Settings → Module Settings → Garb & Grime**. Version 1.0.2 registers essential settings before optional integrations and reports partial initialization failures visibly. |
| Manager tabs do not react | Confirm version 1.2.4 is installed. Version 1.0.2 avoids Foundry V13's reserved `data-action="tab"` dispatcher and uses the module's own rerendering tab action, preserving the active Manager tab per user. |
| A `renderChatMessage` deprecation appears after a cleanliness action | Garb & Grime does not register any chat-render hook. Its passive card is created once through `ChatMessage.create()`. The warning is emitted by another enabled module that listens to every chat message through Foundry’s deprecated hook; inspect the warning stack for that package. |
| Actor tab causes portrait 404 spam | Version 1.1.1 prevents Garb & Grime from requesting Actor portraits that belong to unavailable modules. It uses a valid prototype-Token texture when possible, otherwise bundled fallback artwork. Actual load failures from otherwise available paths are cached for the browser session and reported once with a `[garb-and-grime]` prefix. Garb & Grime never rewrites the Actor image field automatically. |
| Actors tab is slow in a large world | Version 1.1.3 keeps the v1.1.2 cached/paginated Actor browser and adds a world-level dashboard Actor scope in Global Module Settings. Restrict the pool by Actor-folder selection and/or regular expression so excluded Actors never enter the dashboard index. |
| Old 1.0.0 files remain after updating | Stop Foundry, replace the complete `Data/modules/garb-and-grime` directory instead of merging files, restart Foundry, enable the module, and reload clients. |
| No Actor indicator | Check Actor Sheets settings, supported Actor types, player visibility, and Actor ownership. Use Configure Settings, the Settings card, Actors card, manager, or Token HUD as fallback. |
| Cleaning service unavailable | Set the Scene context to a profile that offers the method, edit the profile's service list, or let the GM use an availability override through the API. |
| Payment fails | Verify funds, adapter selection, exact currency label, and D&D 5e denomination or custom adapter configuration. |
| Soap or clothing Item not found | Assign the Item integration on its Item sheet or register a custom mapping through the API. |
| No roll recommendation | Enable Roll Advice, verify the skill ID list, and set an applicable Scene context. Ordinary level 0–2 rolls often intentionally have no recommendation. |
| Window opens off-screen after display changes | Saved positions are clamped to the current viewport on first render. Resize or move once to store a new position. |
| Custom sheet has no indicator | Open the manager through Module Settings, Actors sidebar, Scene Controls, or Token HUD. Report the sheet's stable header selector before adding a compatibility adapter. |

## Validation

The source archive contains a dependency-free Node.js validation suite:

```text
npm test
npm run check
```

It validates pure state transitions, dirt rules, contamination and masking, registry isolation, current D&D 5e roll-hook behavior, visible roll choices, manifest and localization integrity, required entry points, API surface, referenced assets, JavaScript syntax, and prohibited legacy patterns. See [Manual Test Checklist](docs/MANUAL_TEST_CHECKLIST.md) for live Foundry acceptance testing.

The package was statically and reproducibly validated in the build environment. A live Foundry server was not available there; the included checklist remains the final runtime verification in the exact campaign stack.

Development references:

- Foundry VTT v13 API: https://foundryvtt.com/api/v13/
- Foundry VTT module development: https://foundryvtt.com/article/module-development/
- D&D 5e system source: https://github.com/foundryvtt/dnd5e


### Service availability

Settlement-bound cleaning methods are available when the active environment profile explicitly lists the method ID or shares at least one settlement tag with the method. The `any` tag remains universally available.
