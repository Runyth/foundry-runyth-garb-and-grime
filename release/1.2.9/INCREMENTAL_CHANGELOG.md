## 1.2.9 — 2026-10-21

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
