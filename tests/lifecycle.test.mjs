import assert from "node:assert/strict";
import test from "node:test";

function getProperty(object, path) {
  return String(path).split(".").reduce((value, key) => value?.[key], object);
}
function setProperty(object, path, value) {
  const parts = String(path).split(".");
  const last = parts.pop();
  let target = object;
  for (const part of parts) target = target[part] ??= {};
  target[last] = value;
  return true;
}
function mergeObject(original, other, { inplace = true } = {}) {
  const target = inplace ? original : structuredClone(original);
  const merge = (left, right) => {
    for (const [key, value] of Object.entries(right ?? {})) {
      if (value && typeof value === "object" && !Array.isArray(value)) left[key] = merge(left[key] && typeof left[key] === "object" ? left[key] : {}, value);
      else left[key] = structuredClone(value);
    }
    return left;
  };
  return merge(target, other);
}

test("mocked Foundry init exposes the API and registers entry points", async () => {
  const hookHandlers = new Map();
  globalThis.Hooks = {
    once(name, callback) { hookHandlers.set(name, [...(hookHandlers.get(name) ?? []), { callback, once: true }]); },
    on(name, callback) { hookHandlers.set(name, [...(hookHandlers.get(name) ?? []), { callback, once: false }]); },
    call(name, ...args) { for (const entry of hookHandlers.get(name) ?? []) if (entry.callback(...args) === false) return false; return true; },
    callAll(name, ...args) { for (const entry of hookHandlers.get(name) ?? []) entry.callback(...args); }
  };

  class MockApplicationV2 {
    constructor(options = {}) { this.options = options; this.position = { width: 900, height: 680, left: 10, top: 10 }; this.element = { querySelector() { return null; } }; }
    render() { return this; }
    addEventListener() {}
    setPosition(position) { Object.assign(this.position, position); }
    _onPosition() {}
    async _onFirstRender() {}
    async _onRender() {}
    async _onClose() {}
  }
  globalThis.foundry = {
    utils: {
      deepClone: structuredClone,
      mergeObject,
      getProperty,
      setProperty,
      hasProperty: (object, path) => getProperty(object, path) !== undefined,
      escapeHTML: (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
      randomID: () => "random-id"
    },
    applications: {
      api: {
        ApplicationV2: MockApplicationV2,
        HandlebarsApplicationMixin: (Base) => class extends Base {},
        DialogV2: { async confirm() { return true; }, async wait() { return false; } }
      }
    }
  };
  globalThis.HTMLElement = class {};
  globalThis.CONST = { USER_ROLES: { NONE: 0, PLAYER: 1, TRUSTED: 2, ASSISTANT: 3, GAMEMASTER: 4 }, KEYBINDING_PRECEDENCE: { NORMAL: 0 } };
  globalThis.canvas = { scene: null, tokens: { controlled: [] } };
  globalThis.ui = { notifications: { info() {}, warn() {}, error() {} } };
  globalThis.ChatMessage = { getWhisperRecipients: () => [], getSpeaker: () => ({}), async create() {} };
  globalThis.fromUuid = async () => null;

  const definitions = new Map();
  const values = new Map();
  const menus = new Map();
  const moduleRecord = { id: "runyth-garb-and-grime", version: "1.1.5", api: null };
  globalThis.game = {
    modules: new Map([["runyth-garb-and-grime", moduleRecord]]),
    keybindings: { register() {} },
    settings: {
      register(moduleId, key, definition) { definitions.set(`${moduleId}.${key}`, definition); values.set(`${moduleId}.${key}`, structuredClone(definition.default)); },
      registerMenu(moduleId, key, definition) { menus.set(`${moduleId}.${key}`, definition); },
      get(moduleId, key) { return values.get(`${moduleId}.${key}`); },
      async set(moduleId, key, value) { values.set(`${moduleId}.${key}`, structuredClone(value)); return value; }
    },
    i18n: { localize: (key) => key, format: (key) => key },
    user: { id: "gm", name: "GM", isGM: true, role: 4 },
    users: [],
    actors: [],
    time: { worldTime: 0 },
    system: { id: "dnd5e", version: "5.3.3" }
  };

  await import(`../scripts/main.mjs?test=${Date.now()}`);
  assert.equal(moduleRecord.api, null, "API exposure waits for Foundry init");

  for (const entry of hookHandlers.get("init") ?? []) await entry.callback();
  assert.equal(typeof moduleRecord.api.openManager, "function");
  assert.equal(moduleRecord.api.getVersion(), "1.2.9");
  assert.equal(moduleRecord.api.getApiVersion(), "1.3.0");
  assert.ok(definitions.has("runyth-garb-and-grime.configuration"));
  assert.ok(menus.has("runyth-garb-and-grime.openManager"));
  assert.ok(menus.has("runyth-garb-and-grime.configurationHub"));

  for (const entry of hookHandlers.get("ready") ?? []) await entry.callback();
  assert.deepEqual(moduleRecord.api.getState(null), {
    schema: 1,
    dirtLevel: 0,
    body: { level: 0, clean: true },
    clothing: { level: 0, clean: true },
    contaminations: [],
    lastIncrease: null,
    lastCleaning: null,
    lastChange: null,
    lastChangeReason: "",
    autoMaintenance: false,
    maintenanceExempt: false,
    maintenanceDebt: 0,
    masking: [],
    groomedUntil: null,
    gmNotes: "",
    lastDailyGainDay: null,
    lastMaintenanceDay: null,
    transactionLog: []
  });
});
