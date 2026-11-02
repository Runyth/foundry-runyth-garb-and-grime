# Garb & Grime 1.1.5 — Test Summary

New regression coverage verifies:

- ApplicationV2 instance-bound invocation of all bulk Actor mutation handlers;
- +1 and -1 Actor adjustments;
- Water and full-clean bulk cleaning;
- automatic maintenance enable and disable;
- multi-Actor persisted selection;
- empty selection warnings without errors;
- selected Actors remaining actionable while filtered off the current list;
- rapid repeated bulk clicks executing in order;
- Select Visible, Select Folder, and Clear Selection persistence;
- a freshly reopened Manager instance;
- contained settings/action failures with a Garb & Grime-owned diagnostic;
- absence of the private-static receiver pattern from Manager action handlers.

All previous regression coverage remains active.

Result before packaging: **89/89 tests passed**.
