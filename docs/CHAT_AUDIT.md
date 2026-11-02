# Foundry V13 chat-rendering audit

Release: 1.0.4

## Result

Runyth Garb & Grime does not register `renderChatMessage`, `renderChatMessageHTML`, or any other chat-message render hook. Its action cards are passive HTML content created once with `ChatMessage.create()` in `src/chat.mjs`.

Adding a `renderChatMessageHTML` hook would be unnecessary because Runyth Garb & Grime does not modify a card after Foundry renders it and does not attach card interactions.

## Creation paths

| Action path | Card behavior |
|---|---|
| `StateService.updateState()` | Creates one card unless the action is silent or `chat: false`. |
| `ActionService.cleanActor()` | Performs its internal state update with `silent: true`, then creates one cleaning card after the action succeeds. |
| Failed or cancelled cleaning payment | Creates no success card and leaves Actor state unchanged. |
| Daily upkeep | Explicitly uses `chat: false`. |
| Long rest / world day / combat-end dirt | Explicitly uses `chat: false`. |
| Automatic context contamination | Explicitly uses `chat: false`. |

## Source audit

The complete module source was checked for:

- `Hooks.on("renderChatMessage", ...)`
- `Hooks.once("renderChatMessage", ...)`
- chat-related `renderChatMessageHTML` registrations
- `html.find(...)`
- `jQuery(...)`
- `$()` wrapping of supplied render elements
- chat-card `addEventListener(...)` calls
- multiple `ChatMessage.create(...)` sites

No deprecated chat hook or jQuery chat-render assumption exists. `src/chat.mjs` contains the module's single `ChatMessage.create()` call and no listener binding.

## General listener audit

Non-chat render integrations use native DOM APIs. Actor-sheet, Item-sheet, Token HUD, and sidebar injection use semantic Foundry or Tidy hooks plus module-owned marker attributes to avoid reinserting controls during partial or repeated sheet renders. Application window close listeners use `{ once: true }`. Manager form listeners are bound to newly rendered DOM nodes and are discarded with the previous render tree.

## Warning attribution

Creating any Foundry chat message invokes hooks registered by every enabled package. A deprecation warning appearing immediately after Runyth Garb & Grime calls `ChatMessage.create()` does not establish ownership. The warning belongs to the package named in the warning stack or package detector. Runyth Garb & Grime intentionally does not suppress or work around deprecated hooks belonging to RP Names or another module.


## v1.2.1 permission routing

Chat rendering remains passive and hook-free. The former Chat settings tab no longer controls routing. Recipients are selected from the authoritative module permissions: player-initiated cleaning uses `viewCleaningChat`, manual state changes use `viewStateChat`, and hidden actions are restricted to GMs. The legacy `configuration.chat` branch is removed by migration and ignored at runtime.
