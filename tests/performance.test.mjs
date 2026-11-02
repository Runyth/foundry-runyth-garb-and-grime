import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const moduleRoot = path.join(sourceRoot, ".");
const read = (relativePath) => fs.readFileSync(path.join(moduleRoot, relativePath), "utf8");

function mergeObject(original, other, { inplace = true } = {}) {
  const target = inplace ? original : structuredClone(original);
  const merge = (left, right) => {
    for (const [key, value] of Object.entries(right ?? {})) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        left[key] = merge(left[key] && typeof left[key] === "object" ? left[key] : {}, value);
      } else left[key] = structuredClone(value);
    }
    return left;
  };
  return merge(target, other);
}

test("bounded asynchronous mapping preserves order without flooding work", async () => {
  const { mapWithConcurrency } = await import(`../src/util.mjs?performance-map=${Date.now()}`);
  let active = 0;
  let maximum = 0;
  const results = await mapWithConcurrency(Array.from({ length: 12 }, (_, index) => index), async (value) => {
    active += 1;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active -= 1;
    return value * 2;
  }, { concurrency: 3 });

  assert.deepEqual(results, Array.from({ length: 12 }, (_, index) => index * 2));
  assert.ok(maximum > 1, "work should execute concurrently");
  assert.ok(maximum <= 3, "work must respect the configured concurrency cap");
});

test("reactive application renders are coalesced into one browser frame", async () => {
  const callbacks = [];
  globalThis.requestAnimationFrame = (callback) => callbacks.push(callback);
  const { scheduleApplicationRender } = await import(`../src/util.mjs?performance-render=${Date.now()}`);
  let renders = 0;
  const app = {
    rendered: true,
    render(options) {
      renders += 1;
      assert.deepEqual(options, { force: true });
    }
  };

  assert.equal(scheduleApplicationRender(app), true);
  assert.equal(scheduleApplicationRender(app), false);
  assert.equal(scheduleApplicationRender(app), false);
  assert.equal(callbacks.length, 1);
  callbacks.shift()();
  assert.equal(renders, 1);
  delete globalThis.requestAnimationFrame;
});

test("configuration caches reuse merged settings and detect non-Foundry in-place mutations", async () => {
  let merges = 0;
  const configuration = { tokenLabels: { enabled: true } };
  const permissions = { roleMinimums: { viewOwn: 1 }, userOverrides: {} };
  globalThis.foundry = {
    utils: {
      deepClone: structuredClone,
      mergeObject(original, other, options) {
        merges += 1;
        return mergeObject(original, other, options);
      }
    }
  };
  globalThis.game = {
    settings: {
      get(moduleId, key) {
        return key === "configuration" ? configuration : permissions;
      }
    }
  };

  const settings = await import(`../src/settings.mjs?performance-cache=${Date.now()}`);
  const first = settings.getConfiguration();
  const second = settings.getConfiguration();
  assert.equal(first, second);
  assert.equal(merges, 1);

  configuration.tokenLabels.enabled = false;
  const third = settings.getConfiguration();
  assert.notEqual(third, second);
  assert.equal(third.tokenLabels.enabled, false);
  assert.equal(merges, 2);

  settings.getPermissionsSetting();
  settings.getPermissionsSetting();
  assert.equal(merges, 3);
  permissions.roleMinimums.viewOwn = 4;
  assert.equal(settings.getPermissionsSetting().roleMinimums.viewOwn, 4);
  assert.equal(merges, 4);
});



test("cache-safe configuration writes are visible to an immediate post-save repaint", async () => {
  let stored = { tokenLabels: { enabled: true, fontSize: 22, position: "above" } };
  globalThis.foundry = {
    utils: {
      deepClone: structuredClone,
      mergeObject
    }
  };
  globalThis.game = {
    settings: {
      settings: new Map([["runyth-garb-and-grime.configuration", {}]]),
      get(moduleId, key) { return key === "configuration" ? stored : {}; },
      async set(moduleId, key, value) {
        if (key === "configuration") stored = structuredClone(value);
        return value;
      }
    }
  };
  const settings = await import(`../src/settings.mjs?performance-config-save=${Date.now()}-${Math.random()}`);
  assert.equal(settings.getConfiguration().tokenLabels.fontSize, 22);
  const next = structuredClone(settings.getConfiguration());
  next.tokenLabels.fontSize = 13;
  next.tokenLabels.position = "right";
  await settings.setConfiguration(next);
  const immediate = settings.getConfiguration();
  assert.equal(immediate.tokenLabels.fontSize, 13);
  assert.equal(immediate.tokenLabels.position, "right");
});

test("Sheets & HUD saves use the cache-safe configuration writer and repaint labels immediately", () => {
  const settingsHub = read("src/apps/settings-hub.mjs");
  assert.match(settingsHub, /await setConfiguration\(configuration\)/);
  assert.doesNotMatch(settingsHub, /await game\.settings\.set\(MODULE_ID, SETTINGS\.CONFIG, configuration\)/);
  assert.match(settingsHub, /services\.tokenLabelService\.refreshAll\(\)/);
  assert.match(settingsHub, /sceneControlsChanged \|\| labelControlsChanged/);
  assert.match(settingsHub, /ui\.controls\?\.render\?\.\(\)/);
});

test("performance-sensitive integrations retain lifecycle and batching guards", () => {
  const manager = read("src/apps/manager.mjs");
  const labels = read("src/integrations/token-labels.mjs");
  const actions = read("src/action-service.mjs");
  const persistent = read("src/apps/persistent-app.mjs");
  const automation = read("src/automation.mjs");
  const migration = read("src/migration.mjs");
  const state = read("src/state-service.mjs");
  const settingsHub = read("src/apps/settings-hub.mjs");
  const rollService = read("src/roll-service.mjs");

  assert.match(manager, /new AbortController\(\)/);
  assert.match(manager, /signal: this\._gagRenderListeners\.signal/);
  assert.doesNotMatch(manager, /querySelectorAll\([^\n]+\)\.forEach\([^\n]+addEventListener/);

  assert.match(labels, /requestAnimationFrame\(callback\)/);
  assert.match(labels, /refreshTokenPosition/);
  assert.match(labels, /frameTicket/);
  assert.match(labels, /Hooks\.on\("controlToken"/);
  assert.match(labels, /Hooks\.on\("hoverToken"/);

  assert.match(actions, /pendingTransactions/);
  assert.match(actions, /queueMicrotask/);
  assert.match(actions, /updateEmbeddedDocuments\("Item"/);
  assert.match(actions, /pendingTransactions/);
  assert.match(persistent, /windowStateWriteQueue/);
  assert.match(persistent, /positionSignature/);

  for (const source of [automation, migration, state]) assert.match(source, /mapWithConcurrency/);
  assert.match(settingsHub, /activeTab === "cleaning"/);
  assert.match(settingsHub, /activeTab === "contexts"/);
  assert.match(settingsHub, /activeTab === "permissions"/);
  assert.match(rollService, /preparedState/);
  assert.match(rollService, /emitHook/);
});


test("state-only changes skip unnecessary Active Effect reconciliation", async () => {
  const configuration = { effects: { enabled: true, includeContaminations: true } };
  globalThis.foundry = {
    utils: {
      deepClone: structuredClone,
      mergeObject,
      escapeHTML: (value) => String(value)
    }
  };
  globalThis.game = {
    user: { id: "gm", isGM: true, role: 4 },
    settings: {
      get(moduleId, key) {
        if (key === "configuration") return configuration;
        if (key === "permissions") return { roleMinimums: {}, userOverrides: {} };
        return undefined;
      }
    },
    i18n: { localize: (key) => key, format: (key) => key }
  };
  globalThis.Hooks = { call: () => true, callAll() {} };
  let stored = {
    schemaVersion: 1,
    dirtLevel: 1,
    body: { level: 1, clean: false },
    clothing: { level: 1, clean: false },
    contaminations: [],
    masking: [],
    autoMaintenance: false
  };
  let effectsRead = 0;
  const actor = {
    documentName: "Actor",
    testUserPermission: () => true,
    getFlag: () => structuredClone(stored),
    async setFlag(moduleId, key, value) { stored = structuredClone(value); },
    get effects() { effectsRead += 1; return []; }
  };
  const { StateService } = await import(`../src/state-service.mjs?performance-effects=${Date.now()}`);
  const service = new StateService({});
  await service.setAutomaticMaintenance(actor, true, { silent: true });
  assert.equal(stored.autoMaintenance, true);
  assert.equal(effectsRead, 0);
});

test("concurrent transaction entries are flushed through one settings write", async () => {
  const configuration = {
    dailyUpkeep: { currency: "Mark" },
    currency: { defaultLabel: "Mark", adapterId: "record-only" }
  };
  let transactionLog = [];
  let writes = 0;
  globalThis.foundry = {
    utils: {
      deepClone: structuredClone,
      mergeObject,
      randomID: () => `tx-${Math.random()}`,
      escapeHTML: (value) => String(value),
      getProperty(object, propertyPath) {
        return String(propertyPath).split(".").reduce((value, key) => value?.[key], object);
      }
    }
  };
  globalThis.game = {
    user: { id: "gm", isGM: true, role: 4 },
    settings: {
      get(moduleId, key) {
        if (key === "configuration") return configuration;
        if (key === "permissions") return { roleMinimums: {}, userOverrides: {} };
        if (key === "transactionLog") return transactionLog;
        return undefined;
      },
      async set(moduleId, key, value) {
        if (key === "transactionLog") {
          writes += 1;
          transactionLog = structuredClone(value);
        }
        return value;
      }
    },
    i18n: { localize: (key) => key, format: (key) => key },
    time: { worldTime: 0 }
  };
  globalThis.Hooks = { call: () => true, callAll() {} };
  globalThis.ui = { notifications: { info() {}, warn() {}, error() {} } };
  const states = new Map();
  const actors = ["one", "two"].map((id) => {
    const actor = { uuid: `Actor.${id}`, name: id, testUserPermission: () => true };
    states.set(actor.uuid, { maintenanceDebt: 2, contaminations: [], masking: [], body: { level: 0, clean: true }, clothing: { level: 0, clean: true }, dirtLevel: 0 });
    return actor;
  });
  const stateService = {
    getState(actor) { return structuredClone(states.get(actor.uuid)); },
    async updateStateFromAction(actor, mutator) {
      states.set(actor.uuid, await mutator(structuredClone(states.get(actor.uuid))));
      return structuredClone(states.get(actor.uuid));
    }
  };
  const registry = { getCurrencyAdapter: () => null };
  const { ActionService } = await import(`../src/action-service.mjs?performance-transactions=${Date.now()}`);
  const service = new ActionService(registry, stateService, null);

  await Promise.all(actors.map((actor) => service.settleMaintenanceDebt(actor)));
  assert.equal(writes, 1);
  assert.equal(transactionLog.length, 2);
});


test("Actor browser hydrates only a bounded page and releases its cache on close", () => {
  const manager = read("src/apps/manager.mjs");
  const template = read("templates/manager.hbs");
  const settings = read("src/settings.mjs");
  const main = read("scripts/main.mjs");
  const images = read("src/display-images.mjs");

  assert.match(manager, /actorPageSize:\s*40/);
  assert.match(manager, /paginateActorRows\(filtered,/);
  assert.match(manager, /pagination\.rows\.map\(\(row\) => this\.#hydrateActorRow\(row\)\)/);
  assert.match(manager, /#actorIndexRow\(/);
  assert.match(manager, /getDirectorySummary\(/);
  assert.match(manager, /resolveActorDisplayImage\(row\.actor\)/);
  assert.match(manager, /invalidateActorCache\(\);\s*return super\._onClose/s);
  assert.doesNotMatch(manager, /filtered\.map\(\(row\) => this\.#hydrateActorRow/);
  assert.match(template, /data-action="changeActorPage"/);
  assert.match(template, /data-gag-filter="actorPageSize"/);
  assert.match(settings, /actorPageSize:\s*40/);
  assert.match(main, /manager\?\.invalidateActor\?\.\(actor\)/);
  assert.match(main, /Hooks\.on\("createActor"/);
  assert.match(images, /MAX_FAILED_SOURCES\s*=\s*512/);
  assert.match(images, /MAX_WARNED_ISSUES\s*=\s*128/);
});

test("directory summaries avoid full state normalization for large Actor indexes", async () => {
  let deepClones = 0;
  globalThis.foundry = { utils: { deepClone(value) { deepClones += 1; return structuredClone(value); } } };
  globalThis.game = {
    user: { id: "gm", isGM: true, role: 4 },
    settings: { get: () => ({ roleMinimums: {}, userOverrides: {} }) },
    i18n: { localize: (key) => key, format: (key) => key }
  };
  globalThis.CONST = { USER_ROLES: { GAMEMASTER: 4 } };
  const { StateService } = await import(`../src/state-service.mjs?directory-summary=${Date.now()}`);
  const service = new StateService({});
  const actor = {
    getFlag: () => ({
      dirtLevel: 2,
      body: { level: 1 },
      clothing: { level: 2 },
      contaminations: [{ id: "mud", hidden: false }, { id: "secret", hidden: true }],
      autoMaintenance: true,
      lastChange: 123,
      transactionLog: Array.from({ length: 100 }, (_, index) => ({ index }))
    })
  };
  const summary = service.getDirectorySummary(actor, { includeHidden: true });
  assert.equal(summary.dirtLevel, 2);
  assert.equal(summary.bodyLevel, 1);
  assert.equal(summary.clothingLevel, 2);
  assert.equal(summary.contaminations.length, 2);
  assert.equal(summary.autoMaintenance, true);
  assert.equal(deepClones, 0, "directory indexing must not deep-clone full Actor state");
});
