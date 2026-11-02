# Garb & Grime v1.2.6 — Incremental patch changelog

## Root cause and repair

1. **Small-font floor:** `redrawBackground` imposed an 18px minimum height and `positionLabel` imposed fixed minimum half-sizes. The font-size setting was accepted, but the visible capsule and its placement failed to shrink proportionally at 10–13px. Dimensions are now based on current rendered text and selected padding.
2. **PIXI TextStyle invalidation:** `updateLabel` changed properties on the existing TextStyle. Current PIXI Text geometry may be cached until the style object is reassigned. On changes, use a fresh `PreciseText.getTextStyle()`-based style and assign it; clear inherited canvas text strokes, shadow and text padding.
3. **Token redraw lifecycle:** Old/new Token canvas objects can briefly share a document UUID. Bind labels to the owning canvas object, replace obsolete labels, guard against delayed old-object destroy events, and clear ownership references on cleanup.
4. **Immediate controls:** Changes to `sceneControls.enabled`, `tokenLabels.enabled`, or `tokenLabels.visibilityMode` repaint the Controls UI immediately on a successful Sheets & HUD save.
5. **UX:** Three separate German/English hover tooltips document the Scene Controls switch, Active Effect mirroring, and contamination-specific mirroring.

No new permissions, Actor flags, Token flags, or data migration. Client-specific label preferences remain separate from the GM's world configuration.
