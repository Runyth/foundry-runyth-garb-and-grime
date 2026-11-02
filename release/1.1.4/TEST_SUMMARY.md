# Garb & Grime 1.1.4 — Test Summary

New regression coverage verifies:

- all ten bundled Scene presets have explicit and distinct four-value acceptance gradients;
- the settings editor no longer falls back to four Expected values;
- the profile editor marks deliberate saves as custom;
- the one-time migration repairs missing/all-Expected/legacy duplicated bundled ratings;
- explicit customized built-in ratings and `custom-*` profiles remain untouched;
- registry loading restores canonical ratings for older bundled profiles that lack the new field.

All previous regression coverage remains active.

Result before packaging: **85/85 tests passed**.
