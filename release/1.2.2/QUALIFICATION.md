# Garb & Grime v1.2.2 — Qualification

Status: **qualified for release**.

Acceptance checks:

- Reported five-to-six player-character expansion scenario reproduced structurally and covered by automated regression.
- Root cause identified in dashboard eligibility precedence; no hard-coded five-Actor limit exists.
- New Foundry-selected Character outside a restrictive manual scope is included.
- Character Actor shared to an existing player through OWNER permission is included.
- Player-owned NPCs/pets do not bypass the manual scope.
- User character/role changes invalidate and rerender an already-open Manager.
- Existing global folder/regex filtering remains before expensive Actor index/hydration work for non-player-linked Actors.
- Existing pagination, performance cache, Actor filters, permissions, chat, transactions, Token labels, Token HUD, sheets and Scene features remain passing.
- No Actor, Token, Scene, User or settings migration is required.
- Public API remains 1.3.0 and state schema remains 1.
- Working-tree suite: 102/102 passed.
- Extracted-source suite: 102/102 passed.
