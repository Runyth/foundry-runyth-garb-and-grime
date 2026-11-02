# Garb & Grime v1.2.9 — root cause audit

## Deployed hovered Token not updating

1. Foundry's `hoverToken` listener used `scheduleTokenRefresh(..., {full:false})`.
2. The position-only method `refreshTokenPosition` positioned cached labels and set visible, without invoking state-service reads or `formatLabel`. If the label was hidden during an Actor change (or the Actor change event did not propagate to this viewer), hovering revealed stale text.
3. The v1.2.8 canonical Actor change alone was insufficient: canonical *reads* matter only on full label hydration.
4. Fix: full re-hydration on hover; full refresh on any hidden→visible change; account for nested/flattened Actor flags and local `HOOKS.STATE_CHANGED`. The module's existing refresh queue keeps expensive work coalesced.

## Soap requirement missing

The bundled `soap` cleaning method declared `itemRequirements: [{integrationId:'soap', quantity:1, optional:true}]`. Its old resolution path skipped missing optional soap, allowing the wash. This is a design/default gap, not an inventory-detection failure. The new GM-setting `cleaning.requireSoap` explicitly enables the enforced rule while leaving existing campaigns unchanged.

New planner reads canonical PC Actor inventory, accepts exact name/integration matches, counts stock across stacks, validates configuration, and avoids double-deduction when the Soap Item tool reserves a unit. Required stock is checked before payment, item consumption or dirt-state changes. It remains a client-side rule executed within Foundry's Document update model, not a global distributed inventory lock. Player API skip attempts do not suppress it; GM bulk cleaning may opt out.

## Non-goals / compatibility

No updates to world Actor state format, public API version, Token flags, synthetic NPC behavior, chat permissions, transaction protocol, currency adapter semantics, or scene contexts. The previous `cleaningMethods` list and integration aliases are retained.
