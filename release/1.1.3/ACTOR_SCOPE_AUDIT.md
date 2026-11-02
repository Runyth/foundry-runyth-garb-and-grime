# Garb & Grime 1.1.3 — Dashboard Actor Scope Audit

## Goal

Allow large worlds to define the intended dashboard Actor population up front, instead of indexing every supported visible Actor and relying only on per-tab filters afterward.

## Implementation

The global configuration now contains:

- `general.dashboardActorRegex`: optional Unicode/case-insensitive regular expression.
- `general.dashboardActorFolderIds`: zero or more Actor-folder IDs.
- `general.dashboardActorIncludeSubfolders`: whether selected folders include descendants.

The regex matches Actor name, Actor type, and the full Actor-folder path. Folder scope and regex combine with logical AND. Empty values mean no global restriction.

## Scalable folder selector

Global Module Settings → General contains a module-scoped, searchable hierarchical Actor-folder list. Search hides nonmatching folder rows locally without rerendering or writing settings. “Select visible” operates on the currently searched subset, while “Clear selection” resets folder choices. The list is scroll-bounded and uses native DOM listeners with AbortController cleanup.

## Performance behavior

The Manager now:

1. Gets supported Actors visible to the current user.
2. Builds the cheap Actor-folder catalog.
3. Applies global folder/regex scope.
4. Only then reads Garb & Grime directory summaries and creates Actor index rows.
5. Applies per-dashboard filters, sorting, and pagination.
6. Hydrates portraits and detailed presentation only for the current page.

Folder path lookup uses maps rather than repeated folder-tree traversal inside the Actor index loop.

## Safety and compatibility

- The scope affects dashboard lists and dashboard bulk management only.
- It does not alter Actor Documents or cleanliness flags.
- It does not disable Actor-sheet indicators, Token HUD actions, Token labels, automation, Scene guide behavior, chat, or public API operations.
- Deleted/stale folder IDs are ignored safely. If no configured folder IDs still exist, folder scope becomes nonrestrictive rather than hiding the entire dashboard.
- Invalid regex values are rejected when saving settings with a Garb & Grime-prefixed error. If invalid configuration is introduced externally, the dashboard ignores the regex component and displays a warning rather than failing.
