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
