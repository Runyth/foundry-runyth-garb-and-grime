// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
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

function createEnvironment(mode, dialogChoice = "normal") {
  const handlers = new Map();
  const notifications = [];
  globalThis.Hooks = {
    on(name, callback) { handlers.set(name, callback); },
    callAll() {}
  };
  globalThis.canvas = { scene: { id: "scene" } };
  globalThis.ui = { notifications: { info(value) { notifications.push(value); }, error() {} } };
  globalThis.foundry = {
    utils: {
      deepClone: structuredClone,
      mergeObject,
      escapeHTML: (value) => String(value)
    },
    applications: {
      api: {
        DialogV2: {
          async wait() { return dialogChoice; }
        }
      }
    }
  };
  globalThis.game = {
    user: { id: "gm", isGM: true, role: 4 },
    modules: new Map([["runyth-garb-and-grime", { title: "Runyth Garb & Grime" }]]),
    settings: {
      get(moduleId, key) {
        if (moduleId === "runyth-garb-and-grime" && key === "configuration") {
          return {
            rolls: {
              enabled: true,
              mode,
              skills: ["per"],
              dedupeSeconds: 10,
              notifyPlayers: true,
              notifyGm: true
            }
          };
        }
        return {};
      }
    },
    i18n: {
      localize: (key) => key,
      format: (key) => key
    }
  };
  return { handlers, notifications };
}

function createService(RollService) {
  const registry = { listContaminations: () => [] };
  const stateService = {
    getState: () => ({
      dirtLevel: 2,
      body: { level: 2, clean: false },
      clothing: { level: 2, clean: false },
      contaminations: [],
      masking: []
    })
  };
  const contextService = {
    getProfile: () => ({
      id: "clean",
      social: { level2: "disadvantage-social" },
      tracking: {}
    })
  };
  return new RollService(registry, stateService, contextService);
}

test("D&D 5e v5.2+ roll integration uses the process-configuration V2 hook", async () => {
  const { handlers, notifications } = createEnvironment("automatic");
  const { RollService } = await import(`../src/roll-service.mjs?automatic=${Date.now()}`);
  const service = createService(RollService);
  service.registerHooks();

  assert.equal(handlers.has("dnd5e.preRollSkillV2"), true);
  const config = {
    subject: { uuid: "Actor.gm", name: "Example" },
    skill: "per"
  };
  const response = handlers.get("dnd5e.preRollSkillV2")(config, {}, {});
  assert.equal(response, undefined);
  assert.equal(config.disadvantage, true);
  assert.equal(notifications.length, 1);
});

test("the visible roll chooser repeats a roll with an explicit resolved marker", async () => {
  createEnvironment("prompt", "normal");
  const { RollService } = await import(`../src/roll-service.mjs?prompt=${Date.now()}`);
  const service = createService(RollService);
  let received;
  const actor = {
    uuid: "Actor.gm",
    name: "Example",
    async rollSkill(config, dialog, message) {
      received = { config, dialog, message };
      return ["roll"];
    }
  };

  const result = await service.promptRollContext(actor, "per", {
    originalConfig: { skill: "per", advantage: true, custom: "preserved" },
    originalDialog: { configure: false },
    originalMessage: { create: true }
  });

  assert.equal(result.choice, "normal");
  assert.deepEqual(result.rolls, ["roll"]);
  assert.equal(received.config.advantage, false);
  assert.equal(received.config.disadvantage, false);
  assert.equal(received.config.custom, "preserved");
  assert.equal(received.config.garbAndGrime.resolved, true);
  assert.equal(received.dialog.configure, false);
  assert.equal(received.message.create, true);
});
