# Garb & Grime 1.1.4 — Scene Preset Classification Audit

## Root cause

The 1.1.0 Scene-classification feature added `profile.levelRatings`, but worlds could already contain stored environment-profile definitions created before that field existed. In Global Module Settings, the editor prepared each missing entry with:

`profile.levelRatings?.[level] ?? "expected"`

That made all four selectors visibly read Expected. Saving the form then wrote those four fallback values back into the world setting, turning a presentation fallback into persistent configuration.

## Corrections

- The editor now resolves missing bundled ratings from the canonical bundled profile definition instead of four Expected values.
- Older custom profiles without a four-value classification still use the legacy expected-range derivation fallback.
- A hidden world migration version repairs bundled presets that are missing ratings, contain the known all-Expected corruption, or still exactly match a duplicated older built-in pattern that was intentionally refined in 1.1.4.
- Future profile-editor saves mark the four-value classification as `levelRatingsSource: "custom"`, so a deliberately customized built-in profile—including four Expected values—is not altered by future preset repairs.
- `custom-*` profiles are never changed by the preset migration.
- Scene-specific `levelRatings` overrides are stored on the Scene and are not touched.
- Registry loading supplies canonical ratings for an older bundled profile that lacks `levelRatings`, allowing non-GM clients to remain safe even before a GM persists the one-time repair.

## Bundled patterns

| Preset | 0 Clean | 1 Worn | 2 Dirty | 3 Stinking |
|---|---|---|---|---|
| Clean | Expected | Accepted | Disliked | Hated |
| Ordinary | Accepted | Expected | Tolerated | Disliked |
| Poor or lawless | Hated | Tolerated | Expected | Accepted |
| Wilderness | Disliked | Accepted | Expected | Tolerated |
| Military | Accepted | Expected | Accepted | Disliked |
| Religious | Expected | Tolerated | Disliked | Hated |
| Court or nobility | Expected | Disliked | Hated | Hated |
| Sewer | Hated | Disliked | Accepted | Expected |
| Swamp | Disliked | Tolerated | Expected | Accepted |
| Battlefield | Hated | Disliked | Tolerated | Expected |

Each bundled profile now has a distinct four-value pattern.
