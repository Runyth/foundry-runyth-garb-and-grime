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

function setupBase(configuration) {
  globalThis.HTMLElement = class HTMLElement {};
  globalThis.foundry = {
    utils: {
      deepClone: structuredClone,
      mergeObject,
      escapeHTML: (value) => String(value),
      fromUuid: async () => null,
      fromUuidSync: () => null
    }
  };
  globalThis.game = {
    user: { id: "gm-a", name: "GM A", isGM: true, active: true, role: 4 },
    users: [{ id: "gm-a", name: "GM A", isGM: true, active: true, role: 4 }],
    actors: [],
    settings: {
      get(moduleId, key) {
        if (`${moduleId}.${key}` === "runyth-garb-and-grime.configuration") return configuration;
        if (`${moduleId}.${key}` === "runyth-garb-and-grime.permissions") return { roleMinimums: {}, userOverrides: {} };
        return undefined;
      },
      async set() {}
    },
    i18n: { localize: (key) => key, format: (key, data = {}) => `${key}:${JSON.stringify(data)}` },
    time: { worldTime: 0 }
  };
  globalThis.ui = { notifications: { info() {}, warn() {}, error() {} } };
}

test("Foundry V13 integrations use namespaced UUID helpers and full sheet roots", () => {
  const util = read("src/util.mjs");
  const actions = read("src/action-service.mjs");
  const actorSheets = read("src/integrations/actor-sheets.mjs");
  const items = read("src/integrations/items.mjs");

  assert.match(util, /foundry\.utils\.fromUuid\(/);
  assert.match(util, /foundry\.utils\.fromUuidSync\(/);
  assert.match(actions, /foundry\.utils\.fromUuid\(/);
  assert.doesNotMatch(`${util}\n${actions}`, /(^|[^.\w])fromUuid(?:Sync)?\s*\(/m);
  assert.ok(actorSheets.indexOf("getRootElement(app?.element)") < actorSheets.indexOf("getRootElement(html)"));
  assert.ok(items.indexOf("getRootElement(app?.element)") < items.indexOf("getRootElement(html)"));
});

test("Active Effects are reconciled idempotently and removed when mirroring is disabled", async () => {
  const configuration = { effects: { enabled: true, includeContaminations: true } };
  setupBase(configuration);
  const calls = { create: [], update: [], delete: [] };
  const effect = {
    id: "effect-1",
    name: "GAG.Levels.2.Name",
    img: "modules/runyth-garb-and-grime/assets/icons/dirty.svg",
    disabled: false,
    changes: [],
    getFlag(moduleId, key) {
      if (moduleId !== "runyth-garb-and-grime") return undefined;
      if (key === "effectKind") return "dirt-2";
      return undefined;
    }
  };
  const actor = {
    effects: [effect],
    async createEmbeddedDocuments(type, data) { calls.create.push({ type, data }); },
    async updateEmbeddedDocuments(type, data) { calls.update.push({ type, data }); },
    async deleteEmbeddedDocuments(type, ids) { calls.delete.push({ type, ids }); }
  };
  const state = {
    dirtLevel: 2,
    body: { level: 2, clean: false },
    clothing: { level: 2, clean: false },
    contaminations: [],
    groomedUntil: null
  };
  const registry = { getContamination() { return null; } };
  const { syncEffects } = await import(`../src/effects.mjs?reconcile=${Date.now()}`);

  await syncEffects(actor, state, registry);
  assert.deepEqual(calls, { create: [], update: [], delete: [] });

  configuration.effects.enabled = false;
  await syncEffects(actor, state, registry);
  assert.deepEqual(calls.delete, [{ type: "ActiveEffect", ids: ["effect-1"] }]);
  assert.equal(calls.create.length, 0);
});

test("hidden contamination is never mirrored into a player-visible Active Effect", async () => {
  const configuration = { effects: { enabled: true, includeContaminations: true } };
  setupBase(configuration);
  const created = [];
  const actor = {
    effects: [],
    async createEmbeddedDocuments(type, data) { created.push({ type, data }); },
    async updateEmbeddedDocuments() {},
    async deleteEmbeddedDocuments() {}
  };
  const registry = {
    getContamination() {
      return { name: "Hidden residue", createEffect: true, icon: "assets/icons/chemical.svg" };
    }
  };
  const state = {
    dirtLevel: 0,
    body: { level: 0, clean: true },
    clothing: { level: 0, clean: true },
    contaminations: [{ id: "secret", hidden: true }],
    groomedUntil: null
  };
  const { syncEffects } = await import(`../src/effects.mjs?hidden-effect=${Date.now()}`);

  await syncEffects(actor, state, registry);
  assert.equal(created.length, 0);
});

test("hidden-by-default contamination cards remain GM-only", async () => {
  const configuration = {
    chat: { enabled: true, mode: "public" },
    effects: { enabled: false, includeContaminations: true }
  };
  setupBase(configuration);
  const messages = [];
  globalThis.Hooks = { call() { return true; }, callAll() {} };
  globalThis.ChatMessage = {
    getWhisperRecipients() { return [{ id: "gm-a" }]; },
    getSpeaker({ actor }) { return { actor: actor.id }; },
    async create(data) { messages.push(structuredClone(data)); return data; }
  };
  let stored;
  const actor = {
    id: "actor-1",
    uuid: "Actor.actor-1",
    documentName: "Actor",
    name: "Private Actor",
    effects: [],
    testUserPermission() { return true; },
    getFlag() { return stored; },
    async setFlag(moduleId, key, value) { stored = structuredClone(value); },
    async deleteEmbeddedDocuments() {},
    async updateEmbeddedDocuments() {},
    async createEmbeddedDocuments() {}
  };
  const registry = {
    getContamination(id) {
      return id === "secret" ? { id, name: "Secret residue", hiddenByDefault: true, effectivePenalty: 1, createEffect: false } : null;
    }
  };
  const { StateService } = await import(`../src/state-service.mjs?privacy=${Date.now()}`);
  const service = new StateService(registry);

  await service.applyContamination(actor, "secret");

  assert.equal(messages.length, 1);
  assert.deepEqual(messages[0].whisper, ["gm-a"]);
  assert.equal(stored.contaminations[0].hidden, true);
});

test("world-wide automation runs only on the primary GM and contains async hook failures", async () => {
  const configuration = {
    automation: {
      combatEndEnabled: true,
      combatEndGain: 1,
      worldDayEnabled: false,
      worldDayGain: 0,
      longRestEnabled: false,
      longRestGain: 0,
      oncePerDay: false,
      extremeBypassesDailyLimit: true
    },
    dirtGain: { normal: 1, extreme: 2, quietDay: 0 }
  };
  setupBase(configuration);
  const hooks = new Map();
  globalThis.Hooks = { on(name, callback) { hooks.set(name, callback); } };
  globalThis.game.users = [
    { id: "gm-a", isGM: true, active: true },
    { id: "gm-b", isGM: true, active: true }
  ];
  globalThis.game.user = { id: "gm-b", isGM: true, active: true };
  const actor = { id: "actor-1", uuid: "Actor.actor-1", type: "character" };
  let adjustments = 0;
  const stateService = {
    getState() { return { lastDailyGainDay: null }; },
    async adjustDirt() { adjustments += 1; }
  };
  const { AutomationService } = await import(`../src/automation.mjs?gm=${Date.now()}`);
  const service = new AutomationService(stateService, { async processDailyMaintenance() {} }, { getProfile() { return null; } });
  service.registerHooks();

  assert.equal(hooks.get("deleteCombat").constructor.name, "Function");
  hooks.get("deleteCombat")({ combatants: [{ actor }] });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(adjustments, 0);

  globalThis.game.user = { id: "gm-a", isGM: true, active: true };
  hooks.get("deleteCombat")({ combatants: [{ actor }] });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(adjustments, 1);
});

test("manager and settings UX hardening remains present", () => {
  const manager = read("src/apps/manager.mjs");
  const settings = read("src/apps/settings-hub.mjs");
  const automation = read("src/automation.mjs");

  assert.match(manager, /lastChangeTimestamp/);
  assert.match(manager, /#restoreFilterFocus/);
  assert.match(manager, /setSelectionRange/);
  assert.match(settings, /nextCustomId/);
  assert.match(settings, /RemoveDefinitionTitle/);
  assert.match(settings, /refreshAllEffects/);
  assert.doesNotMatch(automation, /Hooks\.on\([^\n]+async\s*\(/);
  assert.match(automation, /\.catch\(\(error\) => this\.#reportError/);
});
