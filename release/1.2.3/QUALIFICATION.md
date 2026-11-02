# Garb & Grime v1.2.3 — Qualification

Status: **qualified for release**.

Acceptance checks:

- Scene Context never intentionally passes `undefined` as a profile ID.
- Fresh Scenes open with a deterministic effective `ordinary` profile and are not written until Save.
- Valid profile selection persists normally.
- Stale/deleted profile references are shown explicitly as unavailable and remain untouched until the GM selects a replacement.
- Missing selection, registry-unavailable, unknown profile, invalid Scene document, and persistence failure are distinguished.
- DialogV2 input is read from the native owning `button.form`; no nested Scene Context form remains.
- Known Scene Context failures generate one module-owned console/error notification path.
- Existing Scene level ratings, unrelated Scene Context fields, Actor cleanliness, Token features, chat, transactions, permissions, Tidy 5e integration and performance behavior remain passing.
- Public API remains 1.3.0; Actor-state schema remains 1.
- Working-tree suite: 107/107 passed.
- Extracted provisional source suite: 107/107 passed.
