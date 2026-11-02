# Garb & Grime v1.2.5 — Incremental Changelog

- Fixed Sheets & HUD Canvas Token-label presentation settings being persisted but not immediately applied because the immediate repaint could still read the previous merged configuration cache.
- Configuration saves now use the cache-safe writer and invalidate the merged cache both before and after the Foundry settings write.
- Sheets & HUD saves immediately repaint existing labels with the persisted format, position, font, colours, opacity, padding, and offset.
- Global configuration reset also immediately repaints labels.
- Compact defaults: 18 px font, 8 px Token offset, 6×3 px padding, slightly smaller border/radius.
- Minimum configurable font is now 10 px; minimum padding is 2×1 px.
- Token-label settings migration v3 upgrades only the exact previous visual defaults; any customized visual value prevents automatic restyling.
- Public API remains 1.3.0 and Actor-state schema remains 1.
- No Actor, Token, or Scene data migration is required.
