// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import assert from "node:assert/strict";
import test from "node:test";

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

const baseState = {
  dirtLevel: 2,
  body: { level: 2, clean: false },
  clothing: { level: 2, clean: false },
  contaminations: [], masking: [], maintenanceDebt: 0,
  lastMaintenanceDay: null, autoMaintenance: false, maintenanceExempt: false
};

function createStateService() {
  let state = structuredClone(baseState);
  return {
    getState() { return structuredClone(state); },
    async updateStateFromAction(actor, mutator) {
      state = await mutator(structuredClone(state));
      return structuredClone(state);
    }
  };
}

test("a player cleaning transaction is persisted by the primary GM exactly once", async () => {
  const settings = new Map([
    ["runyth-garb-and-grime.configuration", { dailyUpkeep: { automaticDeduction: false }, currency: { defaultLabel: "Mark" } }],
    ["runyth-garb-and-grime.permissions", { roleMinimums: { modifyOwnActions: 1 }, userOverrides: {} }],
    ["runyth-garb-and-grime.transactionLog", []]
  ]);
  const gm = { id: "gm", name: "GM", isGM: true, role: 4, active: true };
  const player = { id: "player", name: "Player", isGM: false, role: 1, active: true };
  const users = [gm, player];
  users.get = (id) => users.find((user) => user.id === id);
  let emitted = null;
  let socketHandler = null;

  const actor = {
    id: "actor",
    uuid: "Actor.actor",
    documentName: "Actor",
    name: "Player Character",
    items: [],
    testUserPermission(user) { return user?.id === "player" || user?.isGM; }
  };
  const method = {
    id: "soap", name: "Soap", enabled: true, playerUsable: true,
    cost: { amount: 0, currency: "Mark" },
    effect: { mode: "set", level: 0, body: true, clothing: true },
    temporaryEffects: [], itemRequirements: [], settlementTypes: ["any"]
  };
  const registry = {
    getCleaningMethod(id) { return id === "soap" ? structuredClone(method) : null; },
    getCurrencyAdapter() { return null; }
  };

  globalThis.Hooks = { call() { return true; }, callAll() {} };
  globalThis.canvas = { scene: null };
  globalThis.ui = { notifications: { info() {}, warn() {}, error() {} } };
  globalThis.ChatMessage = { getSpeaker() { return {}; }, async create() { return {}; } };
  globalThis.foundry = {
    utils: {
      deepClone: structuredClone,
      mergeObject,
      randomID: () => "tx-player-1",
      getProperty(object, path) { return String(path).split(".").reduce((value, key) => value?.[key], object); },
      async fromUuid(uuid) { return uuid === actor.uuid ? actor : null; },
      escapeHTML(value) { return String(value); }
    },
    applications: { api: { DialogV2: { async confirm() { return true; } } } }
  };
  globalThis.game = {
    user: player,
    users,
    settings: {
      get(moduleId, key) { return settings.get(`${moduleId}.${key}`); },
      async set(moduleId, key, value) { settings.set(`${moduleId}.${key}`, structuredClone(value)); return value; }
    },
    socket: {
      emit(name, payload) { emitted = structuredClone(payload); },
      on(name, callback) { socketHandler = callback; }
    },
    i18n: { localize: (key) => key, format: (key) => key },
    time: { worldTime: 0 }
  };

  const { ActionService } = await import(`../src/action-service.mjs?transaction-sync=${Date.now()}`);
  const playerService = new ActionService(registry, createStateService(), { getProfile() { return null; } });
  const result = await playerService.cleanActor(actor, "soap", { chat: false });
  assert.equal(result.success, true);
  assert.equal(settings.get("runyth-garb-and-grime.transactionLog").length, 0, "players never write the world setting directly");
  assert.equal(emitted?.type, "recordTransaction");
  assert.equal(emitted?.entry?.userId, "player");

  game.user = gm;
  const gmService = new ActionService(registry, createStateService(), { getProfile() { return null; } });
  assert.equal(gmService.registerSocketHandlers(), true);
  socketHandler(emitted);
  socketHandler(emitted);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));

  const log = settings.get("runyth-garb-and-grime.transactionLog");
  assert.equal(log.length, 1, "duplicate socket delivery is deduplicated by transaction id");
  assert.equal(log[0].actorUuid, actor.uuid);
  assert.equal(log[0].actorName, actor.name);
  assert.equal(log[0].methodId, "soap");
  assert.equal(log[0].methodName, "Soap");
  assert.equal(log[0].userId, "player");
  assert.equal(log[0].success, true);
});
