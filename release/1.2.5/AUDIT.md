# Runyth Garb & Grime v1.2.5 — Root-cause and compatibility audit

## Reported symptom

After substantially changing Canvas Token Labels under Sheets & HUD, Display Behaviour appeared to apply but format, position, font, colours, opacity, padding, and offset did not visibly update.

## Root cause

Runyth Garb & Grime caches its merged world configuration for performance. The Global Settings save handler bypassed the module's cache-safe `setConfiguration()` helper and called `game.settings.set()` directly. It then scheduled a label repaint immediately. Foundry's registered setting `onChange` callback is responsible for invalidating the cache, so the immediate repaint could occur while the previous merged configuration was still cached.

This explains the asymmetric symptom: presentation was repainted once with stale values, while visibility/display behaviour could appear correct later because control/hover/token events re-evaluated it after the setting callback had caught up.

## Fix

- Route Global Settings configuration writes through `setConfiguration()`.
- Invalidate the merged configuration cache before and after persistence.
- For Sheets & HUD, run an immediate full Token-label repaint after the awaited save.
- Keep frame-coalesced refreshes for unrelated/general reactive work.
- Make configuration reset repaint labels immediately as well.

## Compact defaults

Default label visuals changed from 22 px / 10 px gap / 8×4 px padding to 18 px / 8 px gap / 6×3 px padding. Migration v3 changes only the exact old default tuple, preserving customized worlds.

## Preserved behavior

No changes were made to player authorization, personal viewer modes/positions, GM per-Token overrides, Actor state, Token flags, Scene context, chat, transactions, Tidy integration, public API signatures, or state schema.

## Regression coverage

Tests verify cache-safe immediate post-save reads, Settings Hub usage of the safe writer, immediate repaint dispatch, compact defaults, and migration preservation of custom styles.
