import assert from "node:assert/strict";
import test from "node:test";

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

function setup(configuration) {
  const settings = new Map([
    ["runyth-garb-and-grime.configuration", configuration],
    ["runyth-garb-and-grime.transaction-log", []],
    ["runyth-garb-and-grime.permissions", { roleMinimums: {}, userOverrides: {} }]
  ]);
  const notifications = [];
  globalThis.Hooks = {
    call() { return true; },
    callAll() {}
  };
  globalThis.canvas = { scene: null };
  globalThis.ui = {
    notifications: {
      info(message) { notifications.push({ type: "info", message }); },
      warn(message) { notifications.push({ type: "warn", message }); },
      error(message) { notifications.push({ type: "error", message }); }
    }
  };
  globalThis.foundry = {
    utils: {
      deepClone: structuredClone,
      mergeObject,
      getProperty(object, path) {
        return String(path).split(".").reduce((value, key) => value?.[key], object);
      },
      randomID: () => "transaction-id",
      escapeHTML: (value) => String(value)
    },
    applications: {
      api: {
        DialogV2: { async confirm() { return true; } }
      }
    }
  };
  globalThis.game = {
    user: { id: "gm", name: "GM", isGM: true, role: 4 },
    settings: {
      get(moduleId, key) { return settings.get(`${moduleId}.${key}`); },
      async set(moduleId, key, value) {
        settings.set(`${moduleId}.${key}`, structuredClone(value));
        return value;
      }
    },
    i18n: {
      localize: (key) => key,
      format: (key, data = {}) => `${key}:${JSON.stringify(data)}`
    },
    time: { worldTime: 0 }
  };
  return { notifications, settings };
}

function actorWithItem(item) {
  return {
    uuid: "Actor.test",
    name: "Test Actor",
    items: item ? [item] : [],
    testUserPermission: () => true
  };
}

function stateStore(initial) {
  let state = structuredClone(initial);
  return {
    getState() { return structuredClone(state); },
    async updateStateFromAction(actor, mutator) {
      state = await mutator(structuredClone(state));
      return structuredClone(state);
    },
    current() { return structuredClone(state); }
  };
}

const cleanState = {
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

const soapMethod = {
  id: "soap",
  name: "Soap",
  enabled: true,
  playerUsable: true,
  time: { value: 1, unit: "hour" },
  cost: { amount: 1, currency: "Mark" },
  effect: { mode: "set", level: 0, body: true, clothing: true },
  temporaryEffects: [],
  itemRequirements: [{ integrationId: "soap", quantity: 1, optional: false }],
  settlementTypes: ["any"]
};

test("failed payment does not consume a validated cleaning item or change state", async () => {
  const { notifications } = setup({
    dailyUpkeep: { automaticDeduction: true },
    currency: { adapterId: "failing", defaultLabel: "Mark" }
  });
  const item = {
    id: "soap-item",
    uuid: "Actor.test.Item.soap-item",
    name: "Soap",
    system: { quantity: 1 },
    getFlag: () => "soap",
    async update(data) { this.system.quantity = data["system.quantity"]; }
  };
  const actor = actorWithItem(item);
  const store = stateStore(cleanState);
  const registry = {
    getCleaningMethod: () => structuredClone(soapMethod),
    getItemIntegration: () => ({ id: "soap", aliases: ["Soap"] }),
    getCurrencyAdapter: () => ({
      id: "failing",
      async canAfford() { return false; },
      async deduct() { throw new Error("must not deduct"); }
    })
  };
  const { ActionService } = await import(`../src/action-service.mjs?failed=${Date.now()}`);
  const service = new ActionService(registry, store, { getProfile: () => ({ serviceAvailability: ["soap"] }) });

  const result = await service.cleanActor(actor, "soap", {
    automaticDeduction: true,
    paymentMode: "automatic",
    chat: false
  });

  assert.equal(result.success, false);
  assert.equal(item.system.quantity, 1);
  assert.equal(store.current().dirtLevel, 2);
  assert.equal(notifications.some((entry) => entry.type === "warn"), true);
});

test("successful cleaning deducts custom Mark currency, consumes once, and cleans both parts", async () => {
  setup({
    dailyUpkeep: { automaticDeduction: true },
    currency: { adapterId: "mark", defaultLabel: "Mark" }
  });
  let balance = 3;
  const item = {
    id: "soap-item",
    uuid: "Actor.test.Item.soap-item",
    name: "Soap",
    system: { quantity: 2 },
    getFlag: () => "soap",
    async update(data) { this.system.quantity = data["system.quantity"]; }
  };
  const actor = actorWithItem(item);
  const store = stateStore(cleanState);
  const registry = {
    getCleaningMethod: () => structuredClone(soapMethod),
    getItemIntegration: () => ({ id: "soap", aliases: ["Soap"] }),
    getCurrencyAdapter: () => ({
      id: "mark",
      async canAfford(actorValue, amount, currency) { return currency === "Mark" && balance >= amount; },
      async deduct(actorValue, amount) {
        balance -= amount;
        return { success: true, deducted: true, balance };
      }
    })
  };
  const { ActionService } = await import(`../src/action-service.mjs?success=${Date.now()}`);
  const service = new ActionService(registry, store, { getProfile: () => ({ serviceAvailability: ["soap"] }) });

  const result = await service.cleanActor(actor, "soap", {
    automaticDeduction: true,
    paymentMode: "automatic",
    chat: false
  });

  assert.equal(result.success, true);
  assert.equal(balance, 2);
  assert.equal(item.system.quantity, 1);
  assert.equal(store.current().body.level, 0);
  assert.equal(store.current().clothing.level, 0);
});

test("record-only daily upkeep accrues debt and cannot run twice in one day", async () => {
  setup({
    dailyUpkeep: {
      enabled: true,
      cost: 2,
      currency: "Mark",
      paymentMode: "record",
      automaticDeduction: false,
      promptBeforePayment: false,
      settlementRequired: false,
      methodId: "daily-upkeep"
    },
    currency: { adapterId: "record-only", defaultLabel: "Mark" }
  });
  const upkeepMethod = {
    id: "daily-upkeep",
    name: "Daily upkeep",
    enabled: true,
    playerUsable: false,
    time: { value: 1, unit: "day" },
    cost: { amount: 2, currency: "Mark" },
    effect: { mode: "set", level: 0, body: true, clothing: true },
    temporaryEffects: [],
    itemRequirements: [],
    settlementTypes: ["settlement"]
  };
  const actor = actorWithItem(null);
  const store = stateStore({ ...cleanState, autoMaintenance: true });
  const registry = {
    getCleaningMethod: () => structuredClone(upkeepMethod),
    getCurrencyAdapter: () => null
  };
  const { ActionService } = await import(`../src/action-service.mjs?upkeep=${Date.now()}`);
  const service = new ActionService(registry, store, { getProfile: () => ({ serviceAvailability: ["daily-upkeep"] }) });

  const first = await service.processDailyMaintenance(actor, { day: 42 });
  const second = await service.processDailyMaintenance(actor, { day: 42 });

  assert.equal(first.success, true);
  assert.equal(store.current().maintenanceDebt, 2);
  assert.equal(store.current().lastMaintenanceDay, 42);
  assert.deepEqual(second, { success: false, skipped: true, reason: "daily-limit" });
});

test("settlement tags make a bound cleaning method available without an explicit method id", async () => {
  setup({
    dailyUpkeep: { automaticDeduction: false },
    currency: { adapterId: "none", defaultLabel: "Mark" }
  });
  const method = {
    id: "city-laundry",
    name: "City laundry",
    enabled: true,
    playerUsable: true,
    time: { value: 2, unit: "hour" },
    cost: { amount: 0, currency: "Mark" },
    effect: { mode: "set", level: 0, body: true, clothing: true },
    temporaryEffects: [],
    itemRequirements: [],
    settlementTypes: ["city"]
  };
  const store = stateStore(cleanState);
  const registry = {
    getCleaningMethod: () => structuredClone(method),
    getCurrencyAdapter: () => null
  };
  const { ActionService } = await import(`../src/action-service.mjs?settlement-match=${Date.now()}`);
  const service = new ActionService(registry, store, {
    getProfile: () => ({ id: "custom-capital", name: "Capital", settlementTypes: ["city"], serviceAvailability: [] })
  });

  const result = await service.cleanActor(actorWithItem(null), method.id, {
    enforceAvailability: true,
    chat: false
  });

  assert.equal(result.success, true);
  assert.equal(store.current().dirtLevel, 0);
});

test("a settlement-bound cleaning method is rejected when neither tags nor method ids match", async () => {
  setup({
    dailyUpkeep: { automaticDeduction: false },
    currency: { adapterId: "none", defaultLabel: "Mark" }
  });
  const method = {
    id: "city-laundry",
    name: "City laundry",
    enabled: true,
    playerUsable: true,
    time: { value: 2, unit: "hour" },
    cost: { amount: 0, currency: "Mark" },
    effect: { mode: "set", level: 0, body: true, clothing: true },
    temporaryEffects: [],
    itemRequirements: [],
    settlementTypes: ["city"]
  };
  const store = stateStore(cleanState);
  const registry = {
    getCleaningMethod: () => structuredClone(method),
    getCurrencyAdapter: () => null
  };
  const { ActionService } = await import(`../src/action-service.mjs?settlement-mismatch=${Date.now()}`);
  const service = new ActionService(registry, store, {
    getProfile: () => ({ id: "wilderness", name: "Wilderness", settlementTypes: [], serviceAvailability: [] })
  });

  await assert.rejects(
    () => service.cleanActor(actorWithItem(null), method.id, { enforceAvailability: true, chat: false }),
    /GAG\.Errors\.ServiceUnavailable/
  );
  assert.equal(store.current().dirtLevel, 2);
});

function soapFixture({ stock = [], soapQuantity = 1, consumeSoap = true, requireSoap = true, legacyOptional = true } = {}) {
  setup({
    cleaning: { requireSoap, consumeSoap, soapQuantity },
    dailyUpkeep: { automaticDeduction: false },
    currency: { adapterId: "record-only", defaultLabel: "Mark" }
  });
  const items = stock.map((quantity, index) => ({
    id: `soap-${index}`, uuid: `Actor.test.Item.soap-${index}`, name: index % 2 ? "Seife" : "Soap",
    actor: { uuid: "Actor.test" }, system: { quantity },
    getFlag: () => index % 2 ? null : "soap",
    async update(data) { this.system.quantity = data["system.quantity"]; }
  }));
  const actor = { ...actorWithItem(), items };
  for (const item of items) item.actor = actor;
  const store = stateStore(cleanState);
  const method = structuredClone(soapMethod);
  method.cost.amount = 0;
  method.itemRequirements = [{ integrationId: "soap", quantity: 1, optional: legacyOptional }];
  const registry = {
    getCleaningMethod: () => structuredClone(method),
    getItemIntegration: () => ({ id: "soap", aliases: ["soap", "seife"] })
  };
  return { items, actor, store, registry };
}

test("enforced soap: missing or empty stock denies the wash without changing cleanliness or charging", async () => {
  for (const stock of [[], [0]]) {
    const { ActionService } = await import("../src/action-service.mjs");
    const { actor, store, registry } = soapFixture({ stock });
    const actions = new ActionService(registry, store, null);
    await assert.rejects(() => actions.cleanActor(actor, "soap", { chat: false }), /GAG\.Errors\.RequiredItemMissing/);
    assert.equal(store.current().dirtLevel, 2);
    assert.equal(game.settings.get("runyth-garb-and-grime", "transactionLog")?.length ?? 0, 0);
  }
});

test("enforced soap: matching Soap/Seife stacks combine; exactly the configured quantity is consumed", async () => {
  const { ActionService } = await import("../src/action-service.mjs");
  const { items, actor, store, registry } = soapFixture({ stock: [1, 2], soapQuantity: 3 });
  const actions = new ActionService(registry, store, null);
  const result = await actions.cleanActor(actor, "soap", { chat: false });
  assert.equal(result.success, true);
  assert.deepEqual(items.map((item) => item.system.quantity), [0, 0]);
  assert.equal(store.current().dirtLevel, 0);
  assert.equal(result.consumed.length, 2);
});

test("enforced soap: non-consuming possession mode denies absence but never modifies inventory", async () => {
  const { ActionService } = await import("../src/action-service.mjs");
  const { items, actor, store, registry } = soapFixture({ stock: [2], soapQuantity: 2, consumeSoap: false });
  const result = await new ActionService(registry, store, null).cleanActor(actor, "soap", { chat: false });
  assert.equal(result.success, true);
  assert.equal(items[0].system.quantity, 2);
  assert.equal(result.consumed.length, 0);
  assert.equal(store.current().dirtLevel, 0);
});

test("enforced soap: pre-reserved soap Item-sheet consumption satisfies the requirement without double deduction", async () => {
  const { ActionService } = await import("../src/action-service.mjs");
  const { items, actor, store, registry } = soapFixture({ stock: [1], soapQuantity: 1 });
  const service = new ActionService(registry, store, null);
  globalThis.foundry.utils.fromUuid = async () => items[0];
  const result = await service.cleanActor(actor, "soap", {
    chat: false, skipItemRequirements: true,
    consumeItemUuid: items[0].uuid, consumeItemQuantity: 1
  });
  assert.equal(result.success, true);
  assert.equal(items[0].system.quantity, 0);
});

test("enforced soap: repeat action cannot reuse a depleted soap stack", async () => {
  const { ActionService } = await import("../src/action-service.mjs");
  const { items, actor, store, registry } = soapFixture({ stock: [1] });
  const service = new ActionService(registry, store, null);
  const [first, second] = await Promise.allSettled([
    service.cleanActor(actor, "soap", { chat: false }),
    service.cleanActor(actor, "soap", { chat: false })
  ]);
  assert.equal(first.status, "fulfilled");
  assert.equal(second.status, "rejected");
  assert.match(second.reason.message, /GAG\.Errors\.RequiredItemMissing/);
  assert.equal(items[0].system.quantity, 0);
  assert.equal(store.current().dirtLevel, 0);
});

test("soap enforcement remains opt-in; old campaigns can wash without inventory", async () => {
  const { ActionService } = await import("../src/action-service.mjs");
  const { actor, store, registry } = soapFixture({ stock: [], requireSoap: false });
  const result = await new ActionService(registry, store, null).cleanActor(actor, "soap", { chat: false });
  assert.equal(result.success, true);
  assert.equal(store.current().dirtLevel, 0);
});

test("a player cannot bypass enabled soap enforcement with an API skipItemRequirements option", async () => {
  const { ActionService } = await import("../src/action-service.mjs");
  const { actor, store, registry } = soapFixture({ stock: [], requireSoap: true });
  const permissions = {
    roleMinimums: { modifyOwnActions: 1, useServices: 1, consumeItems: 1 },
    userOverrides: {}
  };
  await game.settings.set("runyth-garb-and-grime", "permissions", permissions);
  game.user = { id: "player-1", name: "Player", role: 1, isGM: false };
  await assert.rejects(
    () => new ActionService(registry, store, null).cleanActor(actor, "soap", { skipItemRequirements: true, chat: false }),
    /GAG\.Errors\.RequiredItemMissing/
  );
  assert.equal(store.current().dirtLevel, 2);
});
