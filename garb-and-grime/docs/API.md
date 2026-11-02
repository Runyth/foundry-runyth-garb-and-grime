# Garb & Grime Public API 1.3.0

```javascript
const api = game.modules.get("garb-and-grime")?.api;
```

The API is assigned during Foundry's `init` lifecycle and the `garb-and-grime.apiReady` hook is emitted after registration.

## State methods

| Method | Description |
|---|---|
| `getState(actor, options?)` | Returns a normalized deep copy. `includeHidden` defaults to GM-only visibility. |
| `setDirtLevel(actor, level, options?)` | Sets body and clothing unless either is disabled in options. |
| `adjustDirt(actor, amount, options?)` | Adds or removes levels, clamped to 0–3. |
| `setBodyCleanliness(actor, state, options?)` | Accepts a level or boolean clean state. |
| `setClothingCleanliness(actor, state, options?)` | Accepts a level or boolean clean state. |
| `applyContamination(actor, contaminationId, options?)` | Adds or refreshes a contamination. |
| `removeContamination(actor, contaminationId, options?)` | Removes one contamination. |
| `cleanActor(actor, methodId, options?)` | Executes a registered cleaning method, payment, item use, state update, chat, and hooks. |
| `settleMaintenanceDebt(actor, options?)` | Clears recorded debt; `deduct: true` uses the selected currency adapter first. |

Common mutation options include `reason`, `source`, `chat`, `hidden`, `system`, `body`, `clothing`, `waiveCost`, `skipItemRequirements`, `ignoreAvailability`, and `scene`.

## Registration methods

| Method | Required definition fields |
|---|---|
| `registerCleaningMethod(definition)` | `id`, `name` or `nameKey`, `cost`, `time`, `effect`; optional requirements, settlements, and temporary effects. |
| `registerContamination(definition)` | `id`, `name` or `nameKey`; optional icon, effective penalty, scent, hidden default, and effect mirroring. |
| `registerEnvironmentProfile(definition)` | `id`, `name` or `nameKey`; expected range, social/tracking rules, service list, dirt gain, contamination, and narrative guidance. |
| `registerItemIntegration(definition)` | `id` plus `methodId` or `masking`; optional aliases, consumption, and cost waiver. |
| `registerCurrencyAdapter(adapter)` | `id`, `getBalance`, `canAfford`, and `deduct`. |

Definitions are cloned on registration and retrieval. Duplicate IDs are rejected unless the internal world-definition reload explicitly replaces them.

### Cleaning method example

```javascript
api.registerCleaningMethod({
  id: "river-ritual",
  name: "River Ritual",
  description: "A complete ritual washing.",
  time: { value: 2, unit: "hour" },
  cost: { amount: 0, currency: "Mark" },
  effect: { mode: "set", level: 0, body: true, clothing: true },
  temporaryEffects: [{ id: "groomed", durationSeconds: 43200 }],
  itemRequirements: [],
  settlementTypes: ["any"],
  playerUsable: true,
  enabled: true
});
```

### Custom currency adapter

```javascript
api.registerCurrencyAdapter({
  id: "festival-mark",
  label: "Festival Mark",

  async getBalance(actor, currency) {
    if (currency !== "Mark") return 0;
    return Number(actor.getFlag("my-economy", "mark")) || 0;
  },

  async canAfford(actor, amount, currency) {
    return (await this.getBalance(actor, currency)) >= Number(amount);
  },

  async deduct(actor, amount, currency) {
    const current = await this.getBalance(actor, currency);
    const cost = Number(amount);
    if (current < cost) return { success: false, reason: "insufficient", balance: current };
    const balance = current - cost;
    await actor.setFlag("my-economy", "mark", balance);
    return { success: true, deducted: true, balance };
  }
});
```

After registration, select `festival-mark` in **Garb & Grime Configuration → Currency**. Registration does not itself enable automatic deductions.

## Context and roll methods

| Method | Description |
|---|---|
| `getSceneContext(scene?)` | Returns `{id, overrides, levelRatings, updatedAt, updatedBy}`. |
| `setSceneContext(scene, contextId, options?)` | Stores the profile ID, optional overrides, and optional four-level classification in Scene flags. |
| `getSceneLevelRatings(scene?)` | Returns four values ordered from dirt level 0 through 3. |
| `setSceneLevelRatings(scene, ratings, options?)` | Stores a Scene-specific classification or clears it with `useProfileDefaults: true`. |
| `evaluateRollContext(actor, rollType, options?)` | Returns a recommendation without modifying a roll. |
| `promptRollContext(actor, rollType, options?)` | Opens the visible four-choice roll dialog and optionally performs the selected D&D 5e skill roll. |

Example result:

```javascript
{
  profileId: "clean",
  skillId: "per",
  dirtLevel: 2,
  effectiveLevel: 3,
  mode: "disadvantage",
  reasonKey: "GAG.RollAdvice.FilthyCleanContext",
  severity: 3,
  entryMayBeRefused: true,
  blocksScentStealth: false
}
```

Supported recommendation modes include `normal`, `advantage`, `possible-advantage`, `disadvantage`, `possible-disadvantage`, `advantage-opponent`, and `blocked`.

`promptRollContext` resolves to `{choice, result, rolls}`. Choices are `advantage`, `normal`, `disadvantage`, or `ignore`. **Normal** clears cleanliness advantage/disadvantage; **Ignore** preserves all options already supplied by D&D 5e or another module. Closing the dialog cancels the prompted roll.

Automatic integration listens to `dnd5e.preRollSkillV2`, whose current D&D 5e signature is `(config, dialog, message)`. The Actor is read from `config.subject` and the skill from `config.skill`. Advisory is the default. Prompt mode only interrupts GM-initiated rolls; player-initiated rolls remain advisory because the module deliberately does not expose a player-to-GM mutation socket.


### Scene classification example

```javascript
await api.setSceneContext(canvas.scene, "poor-lawless");
await api.setSceneLevelRatings(canvas.scene, [
  "hated",
  "tolerated",
  "expected",
  "accepted"
]);

const ratings = api.getSceneLevelRatings(canvas.scene);
api.openSceneGuide();
```

Valid values are `expected`, `accepted`, `tolerated`, `disliked`, and `hated`. The four entries always correspond to dirt levels 0, 1, 2, and 3. The classification is advisory metadata and does not apply mechanical effects.

## Token-label methods

| Method | Description |
|---|---|
| `setTokenLabelMode(token, mode, options?)` | Stores a Token-specific mode: `inherit`, `show`, or `hide`. GM only. |
| `setSelectedTokenLabelMode(mode, options?)` | Applies one display mode to every currently controlled Token. GM only. |
| `setTokenLabelPosition(token, position, options?)` | Stores a Token-specific position: `inherit`, `above`, `right`, `below`, or `left`. GM only. |
| `setSelectedTokenLabelPosition(position, options?)` | Applies one position override to every currently controlled Token. GM only. |
| `toggleTokenLabels(options?)` | Toggles the current client's global Token-label visibility. |
| `setTokenLabelsVisible(visible, options?)` | Sets the current client's global Token-label visibility explicitly. |
| `refreshTokenLabels()` | Refreshes labels on all canvas Tokens from current Actor state and settings. |

The global display state is a client setting used by the `manual` display policy. World configuration may instead use `always`, `controlled`, `hovered`, or `controlled-or-hovered`. Per-Token overrides are stored in `flags.garb-and-grime.tokenLabelMode` and `flags.garb-and-grime.tokenLabelPosition`; neither changes Actor cleanliness. A per-Token `show` override never bypasses the non-GM `viewTokenLabels` permission, player scope, or Actor scope. Tokens in `inherit` position mode follow the world-configured default position.

## UI and lookup methods

- `openManager(options?)`
- `openActorPanel(actor, options?)`
- `openSettings(options?)`
- `openSceneGuide(options?)`
- `toggleSceneGuide()`
- `promptRollContext(actor, rollType, options?)`
- `useItemIntegration(item)`
- `getCleaningMethods()`
- `getContaminations()`
- `getEnvironmentProfiles()`
- `getConfiguration()`
- `getVersion()`
- `getApiVersion()`

## Hooks

The API exposes exact names through `api.hooks`.

| Hook | Vetoable | Payload |
|---|---:|---|
| `garb-and-grime.apiReady` | No | API object |
| `garb-and-grime.preStateChange` | Yes | `{actor, previous, next, options, user}` |
| `garb-and-grime.stateChanged` | No | `{actor, previous, next, options, user}` |
| `garb-and-grime.preCleanActor` | Yes | `{actor, method, options, user}` |
| `garb-and-grime.actorCleaned` | No | `{actor, method, previous, next, payment, consumed, options}` |
| `garb-and-grime.preApplyContamination` | Yes | `{actor, contamination, options, user}` |
| `garb-and-grime.contaminationApplied` | No | `{actor, contamination, options, user, state}` |
| `garb-and-grime.contextChanged` | No | `{scene, previous, next, profile, options}` |
| `garb-and-grime.maintenanceProcessed` | No | `{actor, result, config}` |
| `garb-and-grime.rollEvaluated` | No | `{actor, rollType, options, result}` |

A veto hook must return `false` from at least one listener. Vetoes abort before Actor data changes.

## Authority and security

`getState(actor, {includeHidden: true})` still filters hidden data unless the current user is a GM or has the explicit GM-detail permission. The API uses the current Foundry user and document permissions. Passing `system: true` is intended for trusted GM-side automation and does not provide a player with ownership of an Actor. Complementary modules should never expose a player-controlled socket that forwards arbitrary `system: true` calls.
