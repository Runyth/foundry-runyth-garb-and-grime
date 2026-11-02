# Runyth Garb & Grime v1.2.0 — Incremental best-practice changelog

## Added
- Dedicated `viewTokenLabels` permission, denied to non-GMs by default.
- Per-player inherit/allow/deny visibility overrides in Global Module Settings.
- Manual, Always, Controlled, Hovered, and Controlled-or-Hovered persistent label policies.
- Separate Actor eligibility and player Actor scopes.
- Compatibility migration from the legacy audience model.

## Hardened
- Per-Token show overrides cannot bypass security/scope decisions.
- Viewer override form fields cannot leak into general configuration.
- Label refreshes are limited to relevant configuration changes.
- Active Effect reconciliation is skipped when effect settings did not change.
- Runtime diagnostics use consistent Runyth Garb & Grime attribution.

## Preserved
- Public API 1.3.0.
- State schema 1.
- Existing Token label mode/position flags.
- Dashboard, Tidy 5e, Token HUD, Scene guide, chat, automation, Actor state, permissions, and bulk workflows.
