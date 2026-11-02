# Garb & Grime 1.2.6 — Canvas label root-cause and compatibility audit

## Source path

- Editor: `templates/settings-hub.hbs` → `GarbAndGrimeSettings.onSaveConfiguration` → `setConfiguration` → `TokenLabelService.refreshAll`.
- Hook path: `drawToken` → frame-coalesced `scheduleTokenRefresh(full: true)` → `refreshToken`; `updateSetting` → frame-coalesced full refresh.
- Display path: `getConfiguration().tokenLabels` → `formatLabel` → `createLabel`/`updateLabel` → `redrawBackground` → `positionLabel`.
- Viewer authorization uses `canViewerSeeTokenLabel` and Token-label viewer mode, including GM per-Token hide override, unchanged.

## Verified defects in prior code

- A hard `Math.max(18, textHeight + padding*2)` imposed a minimum panel height even at smaller configured fonts; `Math.max(9, height/2)` and `Math.max(12, width/2)` imposed additional visual spacing floors.
- Updating `textObject.style` in place did not force the supported TextStyle reassignment path, and text styles inherited Foundry canvas defaults for potentially large stroke/drop-shadow properties.
- Cached display objects were looked up by document UUID without confirming the owner canvas object remained the same after redraw/replacement.
- Settings already saved through the cache-safe configuration writer, but Scene Controls toolbar redraw was not wired to the `sceneControls.enabled` toggle.

## Correctness changes

- Per-label `PreciseText.getTextStyle()` style is refreshed by assigning an entirely new style on style-signature changes, without recreating Token labels for ordinary settings edits.
- Fixed-size pop-up/position minima removed. Font clamped to 10..48, padding and gap to configured bounds, and all settings support finite numeric defaults. Opacity zero is preserved.
- String-first PreciseText API and dedicated top interface layer remain; no global nameplate manipulation, jQuery, deprecated chat hook, or canvas modification outside the module label container.
- Ownership lifecycle prevents a late destroy hook from deleting a replacement label sharing its UUID; all map/cache entries and per-object label references are released on layer destruction.
- Settings-specific Controls refresh after saved toggle/display policy changes; only three localized native title tooltips added.

## Compatibility and validation scope

- Baseline: Garb & Grime v1.2.5; patch v1.2.6.
- Manifest Foundry V13 min/verified 13.351, DnD5e verified 5.3.3 unchanged.
- API 1.3.0 and state schema 1 unchanged; no data migrations.
- Automated Foundry-style mocks cover 10–13px geometry, new Token of same Actor, hook dispatch, same-UUID redraw, zero-opacity, and toolbar regression.
- A manual live-Foundry verification checklist is bundled. Automated simulation is not represented as an actual Foundry GUI run.
