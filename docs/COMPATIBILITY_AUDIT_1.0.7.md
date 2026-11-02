# Runyth Garb & Grime 1.0.7 Compatibility Audit

## Confirmed defects

1. Actor integration listened to global ApplicationV1/ApplicationV2 and global header-control hooks. Any application exposing an Actor, including D&D 5e level-up and advancement dialogs, could receive the cleanliness control.
2. CSS globally reordered `.window-header` and `.sheet-header` control elements, affecting windows that did not belong to Runyth Garb & Grime.
3. The generic `.sr-only` selector was not scoped to module applications.
4. Item and sidebar integrations retained generic ApplicationV2 fallbacks that were broader than their intended document or sidebar surfaces.

## Corrections

- Actor integration now registers only `renderActorSheet`, `renderActorSheetV2`, and `tidy5e-sheet.renderActorSheet`.
- Tidy Modern targets `data-tidy-sheet-part="actor-name"`; Tidy Classic targets `data-tidy-sheet-part="name-container"`.
- The Foundry title-bar ordering rule is scoped through `gag-sheet-header`, which is added only to a primary core Actor-sheet header.
- The accessibility helper is scoped to `.runyth-garb-and-grime .sr-only`.
- Item, sidebar, and Token HUD integrations use semantic render hooks only.
- Existing Actor flags, Token flags, Scene flags, API contracts, and schema version remain unchanged.

## Regression protection

Automated checks reject:

- global Actor-sheet header hooks;
- `renderApplicationV1` or `renderApplicationV2` augmentation in document integrations;
- unscoped `.window-header > .window-controls`;
- unscoped `.sr-only`;
- missing Tidy Modern or Classic integration points;
- duplicate Actor-sheet hook registration.
