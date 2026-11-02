# Runyth Garb & Grime 1.1.0 feature and compatibility audit

## Scope

The complete 1.0.10 production source, tests, templates, styles, localization, public API, settings lifecycle, Actor workflows, Scene Controls, and Scene flag model were reviewed before implementing 1.1.0.

## Dashboard discovery

### Added

- A prominent dashboard card in **Global Module Settings → General**.
- A dedicated **Runyth Garb & Grime** group in Foundry's left Scene Controls.
- Retained Configure Settings menus, Settings-sidebar card, Actors-sidebar card, Actor-sheet indicator, Token HUD controls, and Token-control tools.

### Isolation

- No generic Application render hook was added.
- Existing semantic Actor-sheet, sidebar, Token HUD, and Scene Control hooks remain isolated.
- The dedicated left control group is registered through the Foundry V13 record-shaped `getSceneControlButtons` structure.

## Scalable Actor management

The Actors tab now supports:

- hierarchical Actor-folder paths;
- root and nested folder filtering;
- optional recursive subfolder inclusion;
- ordinary text or Unicode regular-expression search;
- Character/NPC filtering;
- dirt-level filtering;
- selected-only filtering;
- name, folder, level, or update sorting;
- ascending and descending order;
- persistent row selection across filtering and sorting;
- select-visible, select-folder, and clear-selection workflows;
- bulk +1, −1, water, complete cleaning, upkeep enable, and upkeep disable actions;
- bounded asynchronous processing and visible completion feedback.

The implementation does not write selection state into Actor Documents.

## Scene cleanliness classification

### Data model

- Environment profiles may define four `levelRatings` values.
- Scene context flags may optionally override those four values.
- Missing Scene overrides inherit profile defaults.
- Valid values are `expected`, `accepted`, `tolerated`, `disliked`, and `hated`.
- Existing Scene context flags remain valid; no migration is required.

### Presentation

- The Manager overview always shows all four dirt levels and classifications.
- A movable, resizable, persistent, GM-only Scene Cleanliness Guide shows the same information.
- Profile defaults are editable in Global Module Settings.
- Scene-specific values are editable from the Manager, Scene Control, or guide.

### Intentional limitation

The classifications are advisory metadata only. Version 1.1.0 does not apply NPC reactions, reputation changes, roll modifiers, entry refusal, chat output, Actor dirt changes, or Active Effects from these values.

## Compatibility preserved

- Actor state schema remains 1.
- Existing Actor, Token, Scene context, settings, transaction, chat, Active Effect, automation, currency, localization, and Token-label data remain compatible.
- Public API remains backward compatible and advances to 1.3.0 only to add Scene classification and guide methods.
- Existing Tidy 5e and core D&D 5e sheet integrations are unchanged.
- No dependency was added.

## Defects found during implementation

- Detailed Actor rows referenced scent evaluation before preparation. The evaluation is now prepared once with the shared contamination definition map.
- Bulk Actor-action feedback omitted the action placeholder. Notifications now include the localized action performed.

## External reference limitation

The Heavenly Restriction source archive was not available in the active runtime. Its previously established scalable-selection principles—hierarchical folders, recursive filtering, regular expressions, and explicit selection—were applied without copying implementation code.
