# Manual Test Checklist

Use a cloned test world with Foundry v13, D&D 5e, one GM, one normal player, a linked character token, and an unlinked NPC token.

## Installation and discovery

- [ ] Install the ZIP with `garb-and-grime/` as its single root folder.
- [ ] Enable the module and reload without relevant console errors or deprecation warnings.
- [ ] Open **Game Settings → Configure Settings → Module Settings → Garb & Grime**.
- [ ] Confirm **Open Cleanliness Manager** is visible to a normal player and GM.
- [ ] Confirm **Open global module settings** is visible to the GM and hidden from the normal player.
- [ ] Open both applications from their Configure Settings entries.
- [ ] In the Cleanliness Manager, click Overview, Actors, Rules, Transactions, and GM Settings; confirm each tab changes immediately without console errors.
- [ ] In Global Module Settings, click every configuration tab; confirm each section changes immediately without console errors.
- [ ] Confirm the Settings sidebar contains the prominent Garb & Grime card; open both buttons as GM.
- [ ] Confirm the Actors sidebar contains the Garb & Grime launcher card.
- [ ] Open the manager from the Actors sidebar and Scene Controls.
- [ ] Confirm the first-run guide opens once per user/version and both direct buttons work.
- [ ] Temporarily force one optional integration to fail during development and confirm Configure Settings plus unrelated launchers still register and a visible partial-initialization error appears.

## Actor and player workflow

- [ ] Open a core D&D 5e character sheet and click the cleanliness indicator.
- [ ] Verify a player can view an owned Actor and cannot view hidden GM notes or hidden contamination.
- [ ] Verify an unowned Actor cannot be changed by a normal player.
- [ ] Set a per-user Deny override and confirm it wins over the role default; set Allow and Inherit and confirm both paths.
- [ ] Verify a permitted player can use water, soap, spare clothing, and an available service.
- [ ] Confirm changing clothes cleans clothing but leaves a dirty body and body odor.
- [ ] Confirm water reduces body and clothing by exactly one level, never below 0.
- [ ] Confirm soap sets both to level 0.
- [ ] Duplicate an Actor and confirm the copied state is valid and independent.

## Tokens and bulk operations

- [ ] Use the owned Token HUD submenu for view, water, soap, and clothing.
- [ ] Disable Token HUD quick actions and confirm only the Actor-panel launcher remains.
- [ ] As GM, increase, reduce, reset, and toggle upkeep from the HUD.
- [ ] Select multiple linked and unlinked tokens.
- [ ] Apply travel/work, extreme exposure, water, full cleaning, and contamination from the manager.
- [ ] Confirm each unique Actor changes only once when multiple selected tokens share it.

## Contexts and rolls

- [ ] Set a Scene to Gepflegt and confirm the Scene flag persists after reload.
- [ ] At dirt level 2, roll Persuasion and Deception; confirm a disadvantage recommendation appears.
- [ ] Confirm Intimidation is not automatically penalized.
- [ ] Set Arm oder gesetzlos; confirm level 0 can warn and level 1–2 can suggest blending advantage.
- [ ] Evaluate scent Stealth at levels 2 and 3 with enhanced smell.
- [ ] Confirm default roll mode is advisory and does not silently alter the roll.
- [ ] Select GM prompt mode, start a relevant GM roll, and test Advantage, Normal, Disadvantage, Ignore cleanliness, and dialog close.
- [ ] Select automatic mode and verify the visible notification states why a firm recommendation changed the roll mode.
- [ ] Confirm conditional recommendations such as “possible advantage” remain advisory in automatic mode.
- [ ] Start the same roll as a player and confirm it remains advisory rather than being invisibly interrupted.
- [ ] Create a custom profile and verify its JSON social/tracking rules are evaluated.
- [ ] Give a custom cleaning method the `city` settlement tag, give the active profile the same tag without listing the method ID, and confirm the service is available.
- [ ] Remove the matching tag and confirm the service becomes unavailable; explicitly list the method ID and confirm it is available again.

## Automation

- [ ] Enable long-rest automation and complete a D&D 5e long rest.
- [ ] Enable world-day automation and advance world time across one day boundary.
- [ ] Confirm ordinary daily gain occurs once per day.
- [ ] Confirm an explicit extreme event bypasses the daily limit when configured.
- [ ] Enable combat-end gain and end a combat; confirm only participating Actors are affected.
- [ ] Disable every trigger and confirm no automatic dirt changes occur.

## Daily upkeep and currency

- [ ] Enable upkeep while retaining record-only mode and automatic deduction disabled.
- [ ] Opt in one Actor and process a day; confirm cleaning occurs and debt records without deduction.
- [ ] Settle the debt as a record-only settlement.
- [ ] Configure a funded Actor flag wallet and deduct the debt.
- [ ] Test insufficient funds; confirm no cleaning or debt settlement occurs and a warning appears.
- [ ] Enable prompt-before-payment and cancel; confirm no state change.
- [ ] Require a settlement, set the Scene to Wilderness, and confirm the service is unavailable.
- [ ] Trigger long-rest and world-day upkeep in the same in-game day and confirm the Actor is charged at most once.
- [ ] Use the party-wide enable and disable buttons.

## Items and effects

- [ ] Assign an Item integration from the Item sheet.
- [ ] Use consumable soap and confirm quantity decreases exactly once after success.
- [ ] Test insufficient quantity and confirm no cleanliness change.
- [ ] Use clean spare clothing and confirm the Item is not consumed by default.
- [ ] Use perfume or scent masking and confirm the temporary masking state.
- [ ] Enable Active Effects and verify state changes synchronize without duplicates.
- [ ] Disable Active Effects and confirm Actor flags remain intact.

## Persistence and layout

- [ ] Move and resize the manager, Actor panel, and settings hub; reload and confirm restoration.
- [ ] Change manager tab, search, level filter, sorting, and direction; reload and confirm persistence.
- [ ] Test approximately 420 px, 800 px, and wide desktop window widths.
- [ ] Confirm buttons wrap, labels remain readable, fields do not overflow, and tables scroll.
- [ ] Change monitor or browser viewport size and confirm saved windows clamp on-screen.

## Lifecycle and compatibility

- [ ] Refresh browser and reload world.
- [ ] Disable and re-enable the module; confirm Actor and Scene flags are preserved.
- [ ] Test an unsupported/custom sheet; confirm it fails gracefully and other launchers remain available.
- [ ] Inspect the console during all normal workflows for module errors and deprecated API warnings.

## Version 1.0.3 bulk selection and header order

- [ ] Control two or more Tokens and apply +1; every unique linked/synthetic Actor changes once.
- [ ] Apply −1 to the same controlled Tokens; values decrease without going below level 0.
- [ ] Select multiple Actor rows in the Manager and apply +1/−1 simultaneously.
- [ ] Select multiple Actors in the Actors sidebar and use the launcher card's +1/−1 actions.
- [ ] Open a core D&D 5e Actor sheet and confirm the cleanliness status appears left of the ellipsis and close button.
- [ ] Resize the sheet narrowly and confirm the ellipsis and close button remain visible and farthest right.

## Version 1.0.4 chat audit

- [ ] Perform a Token HUD dirt adjustment and confirm the Actor changes successfully.
- [ ] Confirm exactly one Garb & Grime chat card is created for the action.
- [ ] Confirm the card contains the Actor, action or reason, previous level, new level, and result.
- [ ] Repeat a cleaning-method action and confirm exactly one card is created.
- [ ] Confirm any `renderChatMessage` deprecation stack names another package and contains no `modules/garb-and-grime/` frame.
- [ ] Confirm GM, private, public, and disabled chat visibility modes remain unchanged.

## Version 1.0.5 Token cleanliness labels

- [ ] Confirm Token cleanliness labels are visually hidden immediately after updating until the global toggle is enabled.
- [ ] Use **Scene Controls → Token Controls → Toggle cleanliness labels** and confirm every eligible Token label appears or disappears immediately.
- [ ] Press **Shift+Alt+G** and confirm the same global toggle works; rebind it in Configure Controls and test the replacement shortcut.
- [ ] Open Global Module Settings and configure GM-only, owners, and everyone audiences with separate GM/player clients.
- [ ] Test above, below, left, and right positions and every label format.
- [ ] Change an Actor's dirt level and confirm its visible Token labels refresh without creating duplicates.
- [ ] From the Token HUD, set one Token to always show, follow global, and always hide; verify each mode against both global states.
- [ ] Control multiple Tokens and apply each display mode from the selected-token Scene Control.
- [ ] Confirm two Tokens linked to the same Actor may use different display overrides.
- [ ] Reload the browser and world; confirm the per-client global state and per-Token overrides persist.
- [ ] Confirm core Token names and nameplate settings remain unchanged.
- [ ] Disable Token cleanliness labels in module configuration and confirm all module labels disappear while cleanliness state remains intact.


## Version 1.0.6 Token label readability and stacking

- [ ] Enable labels and confirm the default bold white text on the dark background is clearly readable on bright, dark, and detailed maps.
- [ ] Change font colour, background colour, background opacity, and horizontal/vertical padding in Global Module Settings; save and confirm existing labels refresh immediately.
- [ ] Place two Tokens on top of each other and confirm each visible Garb & Grime label renders above the Token artwork.
- [ ] Test the global above, right, below, and left positions.
- [ ] From one Token HUD, override position to above, right, below, left, and follow global.
- [ ] Control several Tokens and apply each position from the selected-token label-position Scene Control.
- [ ] Confirm two Tokens linked to the same Actor can use different label positions.
- [ ] Reload the world and confirm Token position overrides persist without changing Actor cleanliness or Foundry nameplates.

## Version 1.0.7 sheet isolation and Tidy 5e compatibility

- [ ] Open a core D&D 5e character sheet and confirm exactly one cleanliness indicator appears left of the ellipsis and close controls.
- [ ] Start level-up and open every advancement choice, roll, and confirmation pop-up; confirm no Garb & Grime indicator or button appears in any child window.
- [ ] Open rest, skill-roll, ability-roll, and Item advancement dialogs carrying an Actor or Item; confirm none is augmented as a sheet.
- [ ] Confirm unrelated Foundry and module window controls retain their original order and layout.
- [ ] Enable Tidy 5e Modern for a character and NPC; confirm one clickable indicator appears beside the Actor name and survives full and partial renders.
- [ ] Enable Tidy 5e Classic for a character and NPC; confirm one clickable indicator appears beside the name container.
- [ ] Switch Tidy tabs, edit values, resize the sheet, and trigger partial renders; confirm no duplicate indicators or duplicate click handling.
- [ ] Open Tidy level-up and advancement pop-ups; confirm Garb & Grime remains absent from those windows.
- [ ] Test an unsupported custom Actor sheet; confirm it remains unmodified when no safe sheet target exists and all non-sheet launchers continue working.

## Version 1.0.8 compatibility and interference hardening

- [ ] Enable Active Effect mirroring, change one Actor repeatedly, and confirm unchanged Garb & Grime effects are not deleted and recreated on every update.
- [ ] Disable Active Effect mirroring and confirm existing Garb & Grime effects are removed while Actor cleanliness flags remain unchanged.
- [ ] Apply a contamination configured as hidden by default while chat mode is public; confirm its card is whispered only to GMs and no visible Active Effect reveals it.
- [ ] Connect two active GM clients, enable combat-end automation, end one combat, and confirm every participating Actor changes exactly once.
- [ ] With two active GM clients, advance across an in-game day and confirm daily automation and upkeep process once.
- [ ] Open Tidy 5e Modern and Classic sheets, trigger partial renders, and confirm Actor and Item integrations remain single and functional.
- [ ] Type continuously in the Manager Actor search field and confirm focus and caret position survive filtered rerenders.
- [ ] Sort Actors by last update in both directions and confirm chronological ordering rather than locale-string ordering.
- [ ] Delete a custom cleaning method, profile, or contamination and confirm a warning appears; cancel once, then confirm deletion.
- [ ] Delete a custom definition from the middle of a list, add another, and confirm its ID does not collide with an existing definition.
- [ ] Open the Scene context dialog and confirm the select field has useful padding and does not overflow at narrow widths.
- [ ] Inspect the console while using Scene Controls, Item tools, sidebar bulk actions, and the Token-label shortcut; confirm no unhandled Promise rejection originates from Garb & Grime.

## Version 1.0.10 performance and responsiveness

- [ ] Open a world containing at least 50 supported Actors and switch repeatedly among every Manager tab; confirm Rules, Transactions, and Settings open without unnecessary Actor-list delay.
- [ ] Open Global Module Settings with many custom methods and profiles; switch among unrelated tabs and confirm only the selected category is prepared and displayed.
- [ ] Keep the Manager and several Actor panels open, perform rapid repeated dirt changes, and confirm each window updates once without visible render storms or duplicate controls.
- [ ] Control 20 or more Tokens and apply +1, −1, water, full cleaning, and label overrides; confirm every unique Actor completes and Foundry remains responsive.
- [ ] Enable Token labels, drag and animate several Tokens simultaneously, and confirm labels track smoothly without duplicate text objects or stale labels after changing Scenes.
- [ ] Tear down or change the active Scene while labels have pending movement updates; confirm no stale canvas object or console error remains.
- [ ] Toggle automatic upkeep or edit GM notes while Active Effect mirroring is enabled; confirm unrelated Garb & Grime effects are not rewritten.
- [ ] Change dirt, groomed state, or visible contamination and confirm necessary Active Effects still reconcile correctly.
- [ ] Trigger several cleaning or debt-settlement actions in quick succession and confirm every transaction appears exactly once in the log.
- [ ] Use a cleaning method that consumes multiple configured Items and confirm quantities update correctly through one Actor operation.
- [ ] Move and resize multiple Garb & Grime windows rapidly, reload, and confirm every window restores its own final position.
- [ ] Connect multiple players and one or more GMs, run combat-end and world-day automation, and confirm Actors process once without client freezes or duplicate state changes.
- [ ] Profile a representative session in browser developer tools and confirm no sustained Garb & Grime event-listener, DOM-node, canvas-object, or Promise accumulation.


## Version 1.1.0 dashboard, Actor browser, and Scene guide

- [ ] Open Global Module Settings and confirm the General tab contains a prominent dashboard launcher.
- [ ] Confirm the existing Configure Settings menu entry, Settings-sidebar card, and Actors-sidebar card still open the same Manager.
- [ ] Confirm Foundry's left Scene Controls contains a dedicated Garb & Grime group.
- [ ] Open the Manager from every launcher and confirm only one reusable Manager window exists.
- [ ] Test the Actors tab with at least 100 Actors across nested folders.
- [ ] Filter one folder with and without **Include subfolders** and verify exact hierarchy behavior.
- [ ] Test ordinary text search and a valid regular expression; enter an invalid expression and verify visible non-destructive feedback.
- [ ] Filter by character/NPC, dirt level, and selected-only state; combine filters and reset them.
- [ ] Sort by name, folder, dirt level, and last update in both directions.
- [ ] Select visible Actors, select one folder group, clear selection, and confirm selection persists while filtering and sorting.
- [ ] Apply +1, −1, water, full cleaning, upkeep on, and upkeep off to selected Actors; verify every authorized Actor changes once.
- [ ] Open Global Module Settings → Contexts and configure all four classifications for a profile.
- [ ] Assign a Scene context using profile defaults and verify all four levels appear in the Manager and Scene guide.
- [ ] Override all four classifications for one Scene and verify other Scenes remain unchanged.
- [ ] Open the GM-only Scene Cleanliness Guide, move and resize it, reload, and verify its position and size persist.
- [ ] Switch Scenes with auto-open disabled and enabled; verify the configured behavior.
- [ ] Connect a player and confirm the Scene guide and its GM controls are unavailable.
- [ ] Confirm classifications do not change Actor flags, dirt levels, rolls, chat, Active Effects, or reactions.
- [ ] Disable the Scene guide feature and confirm existing Scene context flags remain intact.


## v1.1.1 Actor portrait resilience

- [ ] Open the Manager Actors tab with an Actor using a valid world or system portrait; confirm the portrait renders normally.
- [ ] Use an Actor whose `img` references an unavailable module such as `modules/retired-package/...`; confirm Garb & Grime does not request that URL and shows the prototype-Token texture or bundled fallback instead.
- [ ] Switch repeatedly between Manager tabs and trigger Actor-list rerenders; confirm no repeated HTTP 404 requests are emitted for the stale path.
- [ ] Confirm one grouped console warning begins with `[garb-and-grime]` for the unavailable source module and is not repeated on each render.
- [ ] Open the same Actor through the Garb & Grime Actor panel and confirm the same safe image behavior.
- [ ] Test a currently installed module whose referenced image file is genuinely missing; confirm the browser can fail once, Garb & Grime records one attributed warning, substitutes its fallback, and does not retry that URL on later Garb & Grime rerenders.
- [ ] Confirm the Actor's `img` and prototype-Token texture fields are unchanged after all tests.
- [ ] Confirm unrelated errors from other modules are neither suppressed nor rewritten by Garb & Grime.

## v1.1.2 large-world Actor browser performance

- Populate or use a world containing at least 200 Actors across several nested Actor folders.
- Open the Cleanliness Manager and switch to **Actors**. Confirm the first page appears without waiting for every Actor portrait in the world to decode.
- Confirm the default page contains no more than 40 Actor rows.
- Change rows per page between 20, 40, 80, and 120 and confirm pagination remains responsive.
- Change name/regex/folder/type/selection/cleanliness filters and confirm the current page resets to page 1.
- Navigate forward and backward; confirm only the current page is present in the DOM and portraits for other pages are not requested by Garb & Grime.
- Switch away from Actors and back while the Manager remains open; confirm the cached index makes repeated visits materially faster than a complete rebuild.
- Change a displayed Actor's cleanliness and confirm only that Actor's cached directory data is invalidated and the Manager refreshes correctly.
- Rename/move an Actor and rename/move an Actor folder; confirm filters and paths update correctly.
- Close the Manager, continue moving Tokens/rolling/using sheets for several minutes, and verify no continuing Garb & Grime Actor-browser work, timers, image requests, or console spam occurs.
- Reopen the Manager after closing; confirm a clean index is rebuilt and behavior remains correct.
- Repeat as a player with limited Actor visibility and confirm hidden Actors never enter the displayed index.

## v1.1.3 global dashboard Actor scope

- [ ] With both global scope fields empty, the Overview and Actors tabs include the same supported visible Actor pool as v1.1.2.
- [ ] In Global Module Settings → General, search a large Actor-folder tree and confirm nonmatching rows hide immediately without rerendering or writing settings.
- [ ] Select one Actor folder, save, and confirm the dashboard includes Actors in that folder only when descendant inclusion is disabled.
- [ ] Enable descendant inclusion and confirm nested child-folder Actors are included.
- [ ] Search the folder picker and use Select visible; confirm only currently visible folder rows are checked.
- [ ] Clear selection and save; confirm folder scoping is disabled.
- [ ] Configure a valid regex matching Actor names and confirm only matching Actors enter the dashboard pool.
- [ ] Configure a regex matching a folder-path fragment and confirm Actors in matching paths enter the pool.
- [ ] Combine folder selection and regex and confirm both conditions are required.
- [ ] Enter an invalid regex and confirm settings are not saved and a Garb & Grime-prefixed error notification appears.
- [ ] Delete a previously selected Actor folder and confirm the stale ID does not hide all Actors or throw an error.
- [ ] Confirm the Actors tab shows a global-scope summary while scope is active.
- [ ] Confirm local Actors-tab filters still work inside the globally scoped pool.
- [ ] Confirm Token HUD, sheet controls, Token cleanliness labels, automation, Scene guide, and public API still operate on Actors outside the dashboard scope.

## v1.1.4 Scene preset classification repair

- [ ] Open **Global Module Settings → Contexts** in an existing upgraded world and confirm bundled presets do not all display `Expected` for levels 0–3.
- [ ] Confirm every bundled profile shows a colour-coded four-level preview above its editable classification selectors.
- [ ] Confirm **Clean** reads Expected / Accepted / Disliked / Hated.
- [ ] Confirm **Ordinary** reads Accepted / Expected / Tolerated / Disliked.
- [ ] Confirm **Poor or lawless** reads Hated / Tolerated / Expected / Accepted.
- [ ] Confirm **Wilderness** reads Disliked / Accepted / Expected / Tolerated.
- [ ] Confirm **Military**, **Religious**, **Court**, **Sewer**, **Swamp**, and **Battlefield** each retain their documented distinct pattern.
- [ ] Select several different profiles for the active Scene and confirm the Manager overview and Scene Cleanliness Guide update to the selected profile's four classifications.
- [ ] Create or edit a custom profile, deliberately set all four classifications to Expected, save, reload, and confirm the explicit custom values are preserved.
- [ ] Configure a Scene-specific four-value override, update to v1.1.4, and confirm the Scene override remains unchanged.


## v1.1.5 Manager ApplicationV2 action receiver repair

- [ ] Open the Manager → Actors tab, select multiple modifiable Actors, and use +1 and -1; each click completes once with no unhandled promise rejection.
- [ ] Use Water, Clean Fully, Enable Maintenance, and Disable Maintenance on the selection; verify every selected Actor is processed and the success notification is correct.
- [ ] Rapidly click the same bulk action twice; verify the two operations execute in order without racing or throwing.
- [ ] Clear the Actor selection and press a bulk action; verify only the Select Actors warning appears and no error is logged.
- [ ] Apply text/regex/folder/type/level filters while the persistent selection contains Actors outside the current page; verify bulk actions still resolve the persisted selection safely.
- [ ] Use Select Visible, Select Folder, and Clear Selection repeatedly; verify selection persistence remains coherent.
- [ ] Close and reopen the Manager, then repeat the bulk actions; verify there is no stale receiver, queue, listener, or promise state.
- [ ] Verify Actor ownership/permission restrictions still exclude Actors the current user may not modify.
## v1.2.0 granular persistent-status permissions

- [ ] Upgrade a world with the old Token-label audience set to GM only; confirm non-GMs remain unable to see persistent labels until explicitly permitted.
- [ ] Upgrade worlds using the old Owners and Everyone audiences; confirm the migration preserves their intended player visibility without rewriting Actor or Token Documents.
- [ ] As GM, set **Display behaviour = Always** and confirm eligible PC cleanliness labels remain continuously visible to the GM.
- [ ] Connect two players with otherwise similar access. Explicitly allow **View persistent cleanliness status** for one and deny/inherit for the other; confirm only the allowed player sees eligible labels.
- [ ] Test player scopes **Disabled**, **Owned Actors**, **Player Characters**, and **All eligible Tokens** with owned and unowned PC/NPC Tokens.
- [ ] Test Actor scope **Supported Actor types** and **Player Characters only**.
- [ ] Verify **Always show** on a Token cannot bypass a denied player's permission or the configured player/Actor scope.
- [ ] Verify **Always hide** suppresses a Token label for GM and authorized players.
- [ ] Test **Manual**, **Always**, **Controlled**, **Hovered**, and **Controlled or Hovered** policies on multiple Tokens.
- [ ] In Manual mode, press the registered Token-label keybinding as GM and as an authorized player; confirm unauthorized players receive one clear Garb & Grime warning and no label appears.
- [ ] In an automatic mode, press the manual keybinding and confirm it does not silently alter automatic visibility.
- [ ] Rapidly hover/control several Tokens and confirm labels reuse existing canvas objects rather than accumulating duplicates.
- [ ] Save only Token-label colors/position/display policy and confirm Actor Active Effects are not mass-reconciled.
- [ ] Save an unrelated settings category and confirm canvas Token labels are not unnecessarily refreshed.
- [ ] Change Active Effect mirroring settings and confirm effect reconciliation still occurs when genuinely required.
- [ ] Close/reopen Global Module Settings and verify per-player overrides remain in the Permissions setting and do not appear inside exported general configuration data.
- [ ] Repeat with Tidy 5e Modern/Classic, Token HUD, dashboard, Scene guide, and chat actions to confirm the feature introduces no interference.


## v1.2.1 transaction and chat-permission regression

- [ ] Connect one GM and at least two player clients.
- [ ] On a player-owned PC, perform **Self-wash with soap** from a Garb & Grime player-facing control.
- [ ] Confirm the Actor is cleaned once and exactly one Garb & Grime cleaning card appears in Chat.
- [ ] With default permissions, confirm both players and the GM can see that player-initiated cleaning card.
- [ ] Open **Global Module Settings → Permissions**, deny **View player-initiated cleaning chat** for one player, repeat the wash, and confirm only the GM and still-authorized player can see the new card.
- [ ] Confirm the former Chat tab is absent.
- [ ] Confirm the Sheets/Token Labels section contains display configuration but no per-player permission editor.
- [ ] Confirm every role minimum and user Allow/Deny/Inherit override is edited only in the Permissions tab.
- [ ] As the GM, open Manager → Transactions and confirm the player's soap wash is present with Actor, method, result, amount/currency and timestamp.
- [ ] Repeat one player wash and confirm one transaction is recorded, not two.
- [ ] With two GM clients connected, confirm only the primary active GM persists the player transaction and no duplicate entry appears.
- [ ] End combat, complete a long rest, advance a world day, and apply automatic context exposure; confirm automatic dirt/contamination processing does not create Chat cards.
- [ ] Perform a manual GM cleanliness adjustment; with default permissions confirm its state-change card is GM-only.
- [ ] Grant **View manual cleanliness-change chat** to a player and confirm a subsequent manual state change becomes visible to that player.
- [ ] Confirm hidden contamination/action cards remain GM-only regardless of chat permissions.
- [ ] Disconnect all GMs, perform a permitted player wash, and confirm the action itself remains functional; reconnect a GM and verify the module clearly logs that no active GM was available to persist that transaction rather than granting the player world-setting write access.

## v1.2.2 growing-party Actor eligibility regression

- Start with five non-GM users and five `character` Actors visible through a restrictive global dashboard folder/regex scope.
- Create or use a sixth `character` Actor outside that manual scope. Confirm it remains absent while unassigned.
- Add a sixth non-GM user and select that Actor as the user's Foundry character. Confirm an already-open Garb & Grime Manager refreshes and shows all six PCs.
- Remove the default-character link, grant an existing non-GM user OWNER permission to the sixth Character Actor, and confirm it remains included.
- Grant a player OWNER permission to an NPC/pet outside the manual scope and confirm it does not bypass the scope.
- Change the sixth user's selected character again and confirm the Manager updates without reloading the browser.
- Close and reopen the Manager; confirm the same six-PC result.
- Verify dashboard text/folder/type/level filters still operate within the resulting pool and Reset Filters does not affect the global scope.
- Verify pagination, bulk selection, Actor portrait fallback, Token HUD, Token labels, sheets, chat, and transactions remain unaffected.


## v1.2.3 Scene Context regression

- [ ] On a fresh Scene with no Garb & Grime Scene flags, open the Scene Context control. `ordinary` is selected deterministically and Save succeeds.
- [ ] Cancel the Scene Context dialog, reopen it, and save a valid profile. No error or stale dialog state remains.
- [ ] Save each valid bundled environment profile and confirm the Scene guide/Manager immediately reflects the selected profile.
- [ ] Give a Scene flag an unavailable/deleted profile ID. Opening Scene Context shows the unavailable ID explicitly and does not rewrite the flag.
- [ ] Replace the unavailable profile through the dialog. Unrelated stored Scene Context fields survive the replacement.
- [ ] With a stale profile selected, attempt Save without choosing a replacement. Only one Garb & Grime error is shown and `undefined` is never submitted.
- [ ] Temporarily simulate an unavailable profile registry during initialization. Scene Context reports a registry-not-ready error instead of `Unknown environment profile: undefined`.
- [ ] Simulate a failed Scene flag write. One Garb & Grime persistence error is reported with the affected Scene; no duplicate notification appears.
- [ ] Switch Scenes and repeat fresh/valid/stale profile checks.
- [ ] Reload the browser/world and confirm valid contexts persist and stale references remain explicit until replaced.
- [ ] Disable/re-enable Garb & Grime and repeat the Scene Context control test.
- [ ] Reconfirm on Foundry VTT 13.351 with D&D5e 5.3.3.


## v1.2.4 Token-label rendering and viewer-permission regression

- [ ] As GM, enable persistent Token cleanliness labels and select several PC Tokens. Confirm every label shows localized cleanliness text such as `2 · Dirty`, never `[object Object]` or another JavaScript object string.
- [ ] Test all label formats: level + name, name only, level only, detailed body/clothing.
- [ ] Test Above, Right, Below, and Left positions and confirm labels remain above overlapping Token artwork.
- [ ] In **Global Module Settings → Permissions**, deny **View persistent cleanliness status** for a player. Confirm no personal display preference can make labels visible.
- [ ] Grant that permission to the player. Confirm the Garb & Grime Scene Controls expose **Cleanliness label display preferences**.
- [ ] As that player, test Follow GM, Manual, Always, Controlled, Hovered, Controlled-or-Hovered, and Always Hide. Confirm choices affect only that browser client.
- [ ] With Manual selected, use Shift+Alt+G and the Scene Control toggle. Confirm the player's own visibility changes without changing GM or another player's visibility.
- [ ] Change the player's personal position and confirm the GM's global/per-Token positions remain unchanged.
- [ ] Set a Token to GM **Always hide** and confirm an authorized player's Always preference cannot override that Token hide.
- [ ] Set a Token to GM **Always show**, leave the player on Follow GM, and confirm the player sees it when permitted. Then choose a personal Controlled/Hovered mode and confirm the personal mode governs the player's view.
- [ ] Upgrade a world carrying legacy `playerScope: disabled` plus an explicit player `viewTokenLabels` grant. Confirm it migrates to Character-only eligibility and the permission grant becomes effective.
- [ ] Reconfirm Token HUD, sheets/Tidy 5e, Scene guide, Manager, chat and transaction behavior remain unaffected.


## v1.2.5 Token-label live-configuration regression

- [ ] With several labels currently visible, open **Global Module Settings → Sheets & HUD** and substantially change format, position, font size, font colour, background colour, background opacity, padding, and Token offset in one save.
- [ ] Confirm every currently visible label updates immediately after Save without changing Scene, moving a Token, hovering, reloading, or closing the settings window.
- [ ] Change only Display Behaviour and confirm its existing behaviour remains correct.
- [ ] Save a second substantially different visual configuration and confirm there is no stale one-save-behind behaviour.
- [ ] Set labels Above, Right, Below, and Left in successive saves and verify the new position is applied immediately.
- [ ] Change format between level+name, name, level, and detailed; verify existing label text changes immediately.
- [ ] Verify compact defaults on a fresh world or after resetting configuration: 18 px font, 8 px offset, 6 px horizontal padding, 3 px vertical padding.
- [ ] Upgrade a world still using the exact legacy 22/10/8/4 visual defaults and confirm it adopts the compact defaults.
- [ ] Upgrade a world with any customized label visual value and confirm all customized values are preserved.
- [ ] Grant and deny player label visibility through Permissions and confirm this patch does not alter authorization or personal viewer preferences.
- [ ] Reconfirm per-Token Always Show/Hide and position overrides, overlapping-token z-order, Token HUD, Tidy 5e, Manager, Scene guide, chat, and transactions.


## v1.2.6 Token-label precise sizing and new Token regression

- [ ] On Foundry 13.351 / D&D5e 5.3.3, enable Canvas Token labels in **Global Module Settings → Sheets & HUD** and choose **Always** so no manual toggle hides the test.
- [ ] Test **Font size 18, 14, 13, 12, 11, 10**; save after each change. Confirm both glyphs **and enclosing panel** reduce smoothly below 14, not merely the text.
- [ ] Set padding to 2 horizontal / 1 vertical and distance to 2. Confirm actual background size/position, including above/below/left/right modes, changes accordingly.
- [ ] Change font and background colours, opacity including **0** and **1**, content format (level/name/detailed), and then save. Verify visible Tokens repaint without a Scene reload.
- [ ] Draw a **new Token from the same Actor** after these changes. It should use exactly the same newly saved font, background, colours, placement, and format.
- [ ] Replace or recreate a Token with the same embedded Token UUID (or redraw canvas), checking one working label only; old Token destruction must not remove the replacement.
- [ ] Verify repeated saves and Token hover/control events do not duplicate labels or lag the world.
- [ ] Toggle **Enable Scene Control buttons** and change label visibility behavior; check the Scene Controls toolbar updates after Save, without changing Scene.
- [ ] Hover **Enable Scene Control buttons**, **Mirror states as Active Effects**, and **Also mirror contaminations**. Check each independent translated explanation in English and German.
- [ ] Verify effects include only module-owned visible state/contamination effects, and that toggles do not rewrite underlying Actor cleanliness state.
- [ ] Check GM/player role and per-user permissions and personal viewer mode; unauthorized players cannot see labels even when Token overrides say Always Show.
- [ ] Reconfirm manager bulk operations, chat, transactions, Scene Context/guide, Actor sheets and Tidy, Token HUD, and automated rules.

**Note:** Automated tests use a PIXI/Foundry V13-compatible mock. The live Foundry V13.351/D&D5e 5.3.3 visual checks above require running the module in the user's world and are not claimed as executed by the build validator.

## v1.2.7 — Scoped Token-label keyboard shortcut

- [ ] Install upgrade over 1.2.6 and verify prior custom Token-label font/style/permissions are retained.
- [ ] GM: open Global Module Settings → Sheets & HUD → Canvas Token Labels. Confirm shortcut Enabled and default scope **All player-character Tokens on Scene**.
- [ ] Deploy two PCs, one unassigned Character, one NPC and one GM-hidden Token on one Scene. Do not select any Token. Press **Shift+Alt+G** and verify only the two player-linked PC labels toggle, on the current client.
- [ ] Press again; both labels toggle off together. Change manual mode to Always / Controlled / Hovered; confirm shortcut still works and toggles the target group without changing the world visibility setting.
- [ ] Set **Selected PC Tokens only** and press with no selection: a clear warning, no accidental toggle. Select one PC and NPC, repeat: only PC toggles.
- [ ] Set **Selected eligible Tokens** and select PC + eligible NPC: both toggle. Check **All eligible Tokens** similarly, respecting Actor/player scope.
- [ ] Set a Token to GM **Always hide** and verify the shortcut cannot reveal it to GM or player.
- [ ] Deny **View persistent cleanliness status** for a player; that player cannot use the shortcut to reveal a label. Grant it and test; they can use their own shortcut without changing GM's/other players' views.
- [ ] Set a player's personal display preference to **Always hide**; shortcut cannot show anything. Change to Manual and retry.
- [ ] Change font/position/style, re-draw a Token with the same Document UUID, confirm local visibility and style remain correct. Switch Scenes and verify transient overrides reset.
- [ ] Disable shortcut in Sheets & HUD; verify no Token overrides are changed and the keybinding is not consumed. Re-enable.
- [ ] Open Foundry **Game Settings → Configure Controls**, customize Garb & Grime shortcut to a free combination and confirm it works. Remove/rebind and confirm no hardcoded global key listener exists.
- [ ] Verify no world Token flags, cleanliness values, transactions or chat messages changed after local shortcut presses.

## v1.2.8 — Live deployed Character Token cleanliness synchronization

- [ ] On Foundry 13.351 / D&D5e 5.3.3, place two **unlinked** Tokens from one player Character Actor on the current Scene (optionally a linked Token too). Make all their Garb & Grime cleanliness labels visible to GM.
- [ ] Set the world Character to Dirty / Stinking from Manager or Actor sheet. Without moving, reselecting, or re-adding Tokens, confirm **all** deployed Token labels update on the next canvas frame.
- [ ] Clean that Character with soap using the player's normal action. Confirm the world Actor, both existing Token labels, and Actor-panel/Token HUD cleanliness agree immediately, on the GM and player's clients with permission.
- [ ] From a player-owned **unlinked** Character Token's Garb & Grime control, adjust dirt or wash. Confirm the world Actor becomes authoritative and other Tokens of that PC refresh. Confirm a player without base Actor ownership/permission cannot mutate the base Actor by owning only a synthetic Token.
- [ ] Place a new Token from the same Character after changing cleanliness; verify it starts with current world cleanliness even if the Token's synthetic ActorDelta includes old flags.
- [ ] Switch Scenes and back; verify labels resolve the current world Actor cleanliness on Scene load without writing Token flags.
- [ ] Deploy two unlinked NPC Tokens from the same NPC; change one and ensure the other/world NPC do not acquire that Token's private cleanliness state.
- [ ] Confirm GM/player label visibility permissions, per-Token Always Hide, user visibility preferences and Shift+Alt+G scope remain unchanged.
- [ ] If Active Effect mirroring is enabled, inspect its existing synchronization separately; this patch fixes canonical cleanliness/labels and does not introduce a new Token Active Effect mirroring subsystem.
- [ ] Check Manager actions, chat, GM transaction history, Tidy 5e sheets, Scene Context, API and automation workflows for regressions.

Automated tests mock Foundry TokenDocument/ActorDelta behavior; multiplayer testing in a running world has not been performed by the packaging tool.

## v1.2.9 deployed Token hover + soap inventory acceptance

1. GM: place one linked and two unlinked PC Tokens; select **Hovered** as label display policy; start with dirt level 3 and hover one existing Token. Confirm `3 · Stinking` (localized).
2. Unhover every Token. A player uses **Self-wash** with water/soap; the Actor sheet changes; hover the **same deployed** Token without redeploying it. Confirm label immediately shows new level. Repeat from GM and player clients.
3. While a Token is already hovered, change the world PC Actor's dirt level in the GM dashboard. Confirm the existing label updates without moving/dragging the Token. Confirm a newly drawn Token shows the same number.
4. Check two unlinked NPC Token instances continue to have independent dirt levels, and a player's permission denial prevents labels being shown.
5. Global Settings → Cleaning: set **Require soap** on, **Consume soap** on, **Soap units per wash** to 2; give PC zero soap; Self-wash with soap must fail visibly, with no currency change, no chat-cleaned card and no successful transaction.
6. Give the PC a stack of one Soap and one Seife (or exact aliases); wash again; both units should be consumed exactly once; body and clothing clean instantly; GM Transactions/Chat continue to reflect success.
7. With only one unit remaining, attempt two rapid washes. First may succeed, second must be denied after stock depletion (note remote clients' simultaneous independent actions are not globally serialized).
8. Disable **Consume soap** but leave **Require soap** on: wash with an existing soap stack, confirm quantity unchanged. Remove soap and confirm wash is denied.
9. With the GM's Clean Fully **bulk** action, confirm the intended administrative exemption still works with no soap. Check spare clothing and bathhouse unchanged.
10. Change to German client locale; confirm new settings, messages and label text translate. Test saving and reopening configuration as well as reloading Foundry.
