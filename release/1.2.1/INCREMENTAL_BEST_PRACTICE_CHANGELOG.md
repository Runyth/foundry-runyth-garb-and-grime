# Garb & Grime v1.2.1 — Incremental best-practice changelog

## Fixed
- Player-initiated cleaning now reaches the GM-owned transaction log through the module socket instead of being silently skipped for non-GM users.
- Remote transaction requests are processed only by the primary active GM, validated against Actor/user permissions and a registered cleaning method, sanitized, and deduplicated by transaction ID.
- Added the required `"socket": true` manifest declaration for the package-specific `module.garb-and-grime` namespace.
- Removed the old Chat configuration as an independent visibility authority.
- Automatic long-rest, world-day, combat-end, context exposure, automatic contamination, and daily-upkeep changes are explicitly chat-silent.
- Manager transaction data is not prepared for ordinary players.

## Permission streamlining
- Removed the Global Settings Chat tab.
- Removed the duplicate per-player Token-label permission controls from the Sheets tab.
- Permissions tab is the sole UI for role minimums and per-user Allow/Deny/Inherit authorization.
- Added `viewCleaningChat`, default Player.
- Added `viewStateChat`, default GM.
- Added one-time migration removing legacy `configuration.chat` and seeding the two chat permissions.

## Preserved
- Actor-state schema 1.
- Public API 1.3.0.
- Existing Token-label display modes/scopes, Actor flags, Scene flags, dashboard scope, Tidy integration, currency behavior, automation behavior other than chat emission, and all existing cleaning methods.
