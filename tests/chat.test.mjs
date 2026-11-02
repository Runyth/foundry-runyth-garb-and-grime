// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const moduleRoot = path.join(sourceRoot, ".");

function collect(directory, suffix = ".mjs") {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collect(absolute, suffix));
    else if (entry.name.endsWith(suffix)) files.push(absolute);
  }
  return files.sort();
}

function mergeObject(original, other, { inplace = true } = {}) {
  const target = inplace ? original : structuredClone(original);
  const merge = (left, right) => {
    for (const [key, value] of Object.entries(right ?? {})) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        left[key] = merge(left[key] && typeof left[key] === "object" ? left[key] : {}, value);
      } else {
        left[key] = structuredClone(value);
      }
    }
    return left;
  };
  return merge(target, other);
}

function setupFoundry({ chatMode = "public" } = {}) {
  const messages = [];
  const settings = new Map([
    ["runyth-garb-and-grime.configuration", {
      chat: { enabled: true, mode: chatMode },
      effects: { enabled: false, includeContaminations: true }
    }],
    ["runyth-garb-and-grime.permissions", { roleMinimums: {}, userOverrides: {} }],
    ["runyth-garb-and-grime.transaction-log", []]
  ]);

  globalThis.HTMLElement = class HTMLElement {};
  globalThis.Hooks = {
    call() { return true; },
    callAll() {}
  };
  globalThis.foundry = {
    utils: {
      deepClone: structuredClone,
      mergeObject,
      randomID() { return "transaction-id"; },
      getProperty(object, propertyPath) { return String(propertyPath).split(".").reduce((value, key) => value?.[key], object); },
      escapeHTML(value) {
        return String(value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");
      }
    }
  };
  globalThis.game = {
    user: { id: "gm", name: "GM", isGM: true, role: 4 },
    users: [{ id: "gm", name: "GM", isGM: true, role: 4 }],
    settings: {
      get(moduleId, key) { return settings.get(`${moduleId}.${key}`); },
      async set(moduleId, key, value) {
        settings.set(`${moduleId}.${key}`, structuredClone(value));
        return value;
      }
    },
    i18n: {
      localize(key) { return key; },
      format(key, data = {}) { return `${key}:${JSON.stringify(data)}`; }
    },
    time: { worldTime: 0 }
  };
  globalThis.ui = {
    notifications: {
      info() {},
      warn() {},
      error() {}
    }
  };
  globalThis.ChatMessage = {
    getWhisperRecipients() { return [{ id: "gm" }]; },
    getSpeaker({ actor }) { return { actor: actor.id, alias: actor.name }; },
    async create(data) {
      messages.push(structuredClone(data));
      return { id: `message-${messages.length}`, ...data };
    }
  };
  return messages;
}

test("module source contains no deprecated or duplicate chat-render integration", () => {
  const source = collect(moduleRoot).map((file) => fs.readFileSync(file, "utf8")).join("\n");
  assert.doesNotMatch(source, /Hooks\.(?:on|once)\(\s*["']renderChatMessage["']/);
  assert.doesNotMatch(source, /Hooks\.(?:on|once)\(\s*["']renderChatMessageHTML["']/);
  assert.doesNotMatch(source, /html\.find\s*\(/);
  assert.doesNotMatch(source, /jQuery\s*\(/);
  assert.doesNotMatch(source, /\$\s*\(\s*(?:html|element)\s*\)/);

  const chatSource = fs.readFileSync(path.join(moduleRoot, "src/chat.mjs"), "utf8");
  assert.equal((chatSource.match(/ChatMessage\.create\s*\(/g) ?? []).length, 1);
  assert.doesNotMatch(chatSource, /addEventListener\s*\(/);
});

test("a state adjustment creates exactly one correctly populated passive chat card", async () => {
  const messages = setupFoundry();
  let stored = {
    schema: 1,
    dirtLevel: 1,
    body: { level: 1, clean: false },
    clothing: { level: 1, clean: false },
    contaminations: [],
    masking: [],
    gmNotes: "",
    autoMaintenance: false,
    maintenanceExempt: false,
    maintenanceDebt: 0,
    lastDailyGainDay: null,
    lastMaintenanceDay: null,
    transactionLog: []
  };
  const actor = {
    id: "actor-1",
    uuid: "Actor.actor-1",
    documentName: "Actor",
    name: "Test Actor",
    effects: [],
    getFlag() { return structuredClone(stored); },
    async setFlag(moduleId, key, value) {
      stored = structuredClone(value);
      return stored;
    },
    async deleteEmbeddedDocuments() {},
    async createEmbeddedDocuments() {},
    testUserPermission() { return true; }
  };
  const registry = { getContamination() { return null; } };
  const { StateService } = await import(`../src/state-service.mjs?chat-state=${Date.now()}`);
  const service = new StateService(registry);

  const result = await service.adjustDirt(actor, 1, { reason: "Travel" });

  assert.equal(result.dirtLevel, 2);
  assert.equal(messages.length, 1);
  const [message] = messages;
  assert.equal(message.speaker.actor, actor.id);
  assert.equal(message.flags["runyth-garb-and-grime"].actionCard, true);
  assert.match(message.content, /Test Actor/);
  assert.match(message.content, /GAG\.Chat\.StateChanged/);
  assert.match(message.content, /GAG\.Levels\.1\.Name/);
  assert.match(message.content, /GAG\.Levels\.2\.Name/);
  assert.match(message.content, /Travel/);
});

test("a cleaning action creates one card while its internal state update stays silent", async () => {
  const messages = setupFoundry();
  const method = {
    id: "soap",
    name: "Soap",
    enabled: true,
    playerUsable: true,
    time: { value: 1, unit: "hour" },
    cost: { amount: 0, currency: "Mark" },
    effect: { mode: "set", level: 0, body: true, clothing: true },
    temporaryEffects: [],
    itemRequirements: [],
    settlementTypes: ["any"]
  };
  let state = {
    dirtLevel: 2,
    body: { level: 2, clean: false },
    clothing: { level: 2, clean: false },
    contaminations: [],
    masking: [],
    maintenanceDebt: 0,
    lastMaintenanceDay: null,
    autoMaintenance: false,
    maintenanceExempt: false
  };
  const actor = {
    id: "actor-2",
    uuid: "Actor.actor-2",
    documentName: "Actor",
    name: "Laundry Actor",
    items: [],
    testUserPermission() { return true; }
  };
  const stateService = {
    getState() { return structuredClone(state); },
    async updateStateFromAction(actorValue, mutator, options) {
      assert.equal(options.silent, true);
      state = await mutator(structuredClone(state));
      return structuredClone(state);
    }
  };
  const registry = {
    getCleaningMethod() { return structuredClone(method); },
    getCurrencyAdapter() { return null; }
  };
  const contextService = { getProfile() { return null; } };
  const { ActionService } = await import(`../src/action-service.mjs?chat-clean=${Date.now()}`);
  const service = new ActionService(registry, stateService, contextService);

  const result = await service.cleanActor(actor, "soap");

  assert.equal(result.success, true);
  assert.equal(messages.length, 1);
  assert.match(messages[0].content, /Laundry Actor/);
  assert.match(messages[0].content, /GAG\.Chat\.Cleaned/);
  assert.match(messages[0].content, /GAG\.Levels\.2\.Name/);
  assert.match(messages[0].content, /GAG\.Levels\.0\.Name/);
  assert.match(messages[0].content, /Soap/);
});

test("player-initiated cleaning chat is permission-routed to all players by default and ignores legacy Chat settings", async () => {
  const messages = setupFoundry({ chatMode: "gm" });
  const gm = { id: "gm", name: "GM", isGM: true, role: 4, active: true };
  const player1 = { id: "p1", name: "Player One", isGM: false, role: 1, active: true };
  const player2 = { id: "p2", name: "Player Two", isGM: false, role: 1, active: true };
  const users = [gm, player1, player2];
  users.get = (id) => users.find((user) => user.id === id);
  game.user = player1;
  game.users = users;
  game.socket = { emit() {} };

  const method = {
    id: "soap",
    name: "Soap",
    enabled: true,
    playerUsable: true,
    time: { value: 1, unit: "hour" },
    cost: { amount: 0, currency: "Mark" },
    effect: { mode: "set", level: 0, body: true, clothing: true },
    temporaryEffects: [],
    itemRequirements: [],
    settlementTypes: ["any"]
  };
  let state = {
    dirtLevel: 2,
    body: { level: 2, clean: false },
    clothing: { level: 2, clean: false },
    contaminations: [],
    masking: [],
    maintenanceDebt: 0,
    lastMaintenanceDay: null,
    autoMaintenance: false,
    maintenanceExempt: false
  };
  const actor = {
    id: "actor-player",
    uuid: "Actor.actor-player",
    documentName: "Actor",
    name: "Player Actor",
    items: [],
    testUserPermission(user) { return user?.id === "p1" || user?.isGM; }
  };
  const stateService = {
    getState() { return structuredClone(state); },
    async updateStateFromAction(actorValue, mutator) {
      state = await mutator(structuredClone(state));
      return structuredClone(state);
    }
  };
  const registry = {
    getCleaningMethod() { return structuredClone(method); },
    getCurrencyAdapter() { return null; }
  };
  const { ActionService } = await import(`../src/action-service.mjs?chat-player-clean=${Date.now()}`);
  const service = new ActionService(registry, stateService, { getProfile() { return null; } });

  const result = await service.cleanActor(actor, "soap");
  assert.equal(result.success, true);
  assert.equal(messages.length, 1);
  assert.deepEqual([...messages[0].whisper].sort(), ["gm", "p1", "p2"]);
});

test("manual state-change chat is GM-only by default and automation source is explicitly chat-silent", async () => {
  const messages = setupFoundry();
  const gm = { id: "gm", name: "GM", isGM: true, role: 4, active: true };
  const player = { id: "p1", name: "Player", isGM: false, role: 1, active: true };
  game.users = [gm, player];

  let stored = {
    schema: 1,
    dirtLevel: 1,
    body: { level: 1, clean: false },
    clothing: { level: 1, clean: false },
    contaminations: [], masking: [], gmNotes: "", autoMaintenance: false,
    maintenanceExempt: false, maintenanceDebt: 0, lastDailyGainDay: null,
    lastMaintenanceDay: null, transactionLog: []
  };
  const actor = {
    id: "actor-gm",
    uuid: "Actor.actor-gm",
    documentName: "Actor",
    name: "GM Actor",
    effects: [],
    getFlag() { return structuredClone(stored); },
    async setFlag(moduleId, key, value) { stored = structuredClone(value); return stored; },
    async deleteEmbeddedDocuments() {},
    async createEmbeddedDocuments() {},
    testUserPermission() { return true; }
  };
  const { StateService } = await import(`../src/state-service.mjs?chat-gm-state=${Date.now()}`);
  const service = new StateService({ getContamination() { return null; } });
  await service.adjustDirt(actor, 1, { reason: "Manual" });
  assert.equal(messages.length, 1);
  assert.deepEqual(messages[0].whisper, ["gm"]);

  const automationSource = fs.readFileSync(path.join(moduleRoot, "src/automation.mjs"), "utf8");
  assert.match(automationSource, /source:\s*options\.source \?\? "automation",\s*chat:\s*false/s);
  assert.match(automationSource, /source:\s*`context:\$\{profile\.id\}`,\s*chat:\s*false/s);
});

test("per-user chat denial in Permissions overrides the default player cleaning audience", async () => {
  const messages = setupFoundry();
  const gm = { id: "gm", name: "GM", isGM: true, role: 4, active: true };
  const player1 = { id: "p1", name: "Player One", isGM: false, role: 1, active: true };
  const player2 = { id: "p2", name: "Player Two", isGM: false, role: 1, active: true };
  game.users = [gm, player1, player2];
  game.settings.set = async (moduleId, key, value) => value;
  const permissionSource = {
    roleMinimums: { viewCleaningChat: 1, viewStateChat: 4 },
    userOverrides: { p2: { viewCleaningChat: false } }
  };
  game.settings.get = (moduleId, key) => key === "permissions" ? permissionSource : key === "configuration" ? {} : [];
  game.user = player1;

  const { postActionCard } = await import(`../src/chat.mjs?permission-denial=${Date.now()}`);
  await postActionCard({
    actor: { id: "actor", name: "Actor" },
    previous: { dirtLevel: 2 },
    next: { dirtLevel: 0 },
    method: { id: "soap", name: "Soap" },
    permission: "viewCleaningChat"
  });
  assert.equal(messages.length, 1);
  assert.deepEqual([...messages[0].whisper].sort(), ["gm", "p1"]);
});

test("chat permission migration removes the legacy Chat configuration and seeds authoritative defaults", async () => {
  const values = new Map([
    ["runyth-garb-and-grime.chatPermissionsVersion", 0],
    ["runyth-garb-and-grime.configuration", { chat: { enabled: true, mode: "gm" }, tokenLabels: {} }],
    ["runyth-garb-and-grime.permissions", { roleMinimums: {}, userOverrides: {} }]
  ]);
  game.user = { id: "gm", isGM: true, role: 4 };
  game.settings = {
    get(moduleId, key) { return values.get(`${moduleId}.${key}`); },
    async set(moduleId, key, value) { values.set(`${moduleId}.${key}`, structuredClone(value)); return value; }
  };
  const { migrateChatPermissions } = await import(`../src/migration.mjs?chat-permission-migration=${Date.now()}`);
  const result = await migrateChatPermissions();
  assert.equal(result.changed, true);
  assert.equal(Object.hasOwn(values.get("runyth-garb-and-grime.configuration"), "chat"), false);
  assert.equal(values.get("runyth-garb-and-grime.permissions").roleMinimums.viewCleaningChat, 1);
  assert.equal(values.get("runyth-garb-and-grime.permissions").roleMinimums.viewStateChat, 4);
  assert.equal(values.get("runyth-garb-and-grime.chatPermissionsVersion"), 1);
});
