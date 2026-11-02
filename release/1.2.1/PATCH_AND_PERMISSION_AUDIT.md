# Runyth Garb & Grime v1.2.1 — Transaction and permission audit

## Reported defects

1. A player could successfully use Self-wash with soap, but the action did not appear in the GM Manager transaction tab.
2. The obsolete Chat tab could say GM-only while a player still observed messages, because chat visibility and the newer granular permission model were independent authorities.
3. Automatic dirt changes were capable of producing state-change chat cards even though they are background bookkeeping rather than player decisions.

## Root causes

### Player transactions
`ActionService.#recordTransaction()` persisted to the world setting only when `game.user.isGM` was true. A non-GM action created the transaction entry in memory and then discarded it.

### Split chat authority
`src/chat.mjs` read `configuration.chat.enabled` and `configuration.chat.mode`, while the rest of the module increasingly relied on granular permissions. This allowed two independent authorization models to disagree.

### Automatic chat
Automation called state mutation methods without `chat: false` in all paths, so `StateService.updateState()` could create passive action cards for automated dirt changes.

## Corrections

- Enabled the Foundry package socket in `module.json`.
- Non-GM cleaning transactions are emitted to `module.runyth-garb-and-grime`.
- Only the primary active GM accepts remote transaction requests.
- The GM resolves the Actor UUID with `foundry.utils.fromUuid`, resolves the user, validates module/Actor permission, resolves the cleaning method, sanitizes all persisted fields, and deduplicates IDs before appending the world log.
- Players never write the world transaction setting directly.
- Chat recipients are computed exclusively from module permissions.
- `viewCleaningChat` defaults to Player and is used for deliberate non-system player cleaning.
- `viewStateChat` defaults to GM and is used for manual administrative state-change output.
- Hidden cards are always restricted to GMs.
- Automatic dirt/contamination processing explicitly uses `chat: false`.
- Removed the Chat tab and the duplicate Token-label permission table so authorization is edited only in Permissions.
- Added one-time migration which removes legacy `configuration.chat` data and seeds the two new permission defaults.

## Data compatibility

No Actor, Token, Scene, Item, Active Effect, or transaction schema migration is required. The only migration changes a world configuration branch and permission defaults. Existing transaction entries remain readable.

## Foundry V13 notes

The package socket follows Foundry's module socket namespace convention and the manifest declares `socket: true`. UUID resolution uses the namespaced `foundry.utils.fromUuid` API. Chat cards remain passive `ChatMessage.create()` content with no deprecated chat-render hook.
