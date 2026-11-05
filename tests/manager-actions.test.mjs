// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const managerSource = fs.readFileSync(path.resolve(here, "../src/apps/manager.mjs"), "utf8");

function mergeObject(original, other, { inplace = true } = {}) {
  return Object.assign(inplace ? original : structuredClone(original), structuredClone(other));
}

async function setupManagerTest() {
  class MockApplicationV2 {
    constructor() {
      this.rendered = false;
      this.element = { querySelectorAll: () => [] };
    }
    render() { return this; }
  }

  const actors = [
    { id: "a", uuid: "Actor.a", name: "Alice", documentName: "Actor", type: "character" },
    { id: "b", uuid: "Actor.b", name: "Borin", documentName: "Actor", type: "character" }
  ];
  const byId = new Map(actors.flatMap((actor) => [[actor.id, actor], [actor.uuid, actor]]));
  let uiState = {
    activeTab: "actors",
    search: "Alice",
    folderId: "party",
    level: "all",
    selectedActorUuids: actors.map((actor) => actor.uuid)
  };
  const notices = { info: [], warn: [], error: [] };
  const calls = [];
  const moduleSettings = { selectionButtonsOneShot: false };

  globalThis.foundry = {
    applications: {
      api: {
        ApplicationV2: MockApplicationV2,
        HandlebarsApplicationMixin: (Base) => class extends Base {}
      }
    },
    utils: {
      deepClone: structuredClone,
      mergeObject,
      async fromUuid(uuid) { return byId.get(uuid) ?? null; }
    }
  };
  globalThis.game = {
    user: { id: "gm", isGM: true, role: 4 },
    actors: {
      get(id) { return byId.get(id) ?? null; },
      filter() { return actors; }
    },
    settings: {
      get(_moduleId, key) {
        if (key in moduleSettings) return moduleSettings[key];
        return structuredClone(uiState);
      },
      async set(_moduleId, _key, value) {
        if (_key === "selectionButtonsOneShot") {
          moduleSettings.selectionButtonsOneShot = Boolean(value);
          return value;
        }
        uiState = structuredClone(value);
        return value;
      }
    },
    i18n: {
      localize(key) { return key; },
      format(key, data = {}) { return `${key}:${JSON.stringify(data)}`; }
    }
  };
  globalThis.canvas = { tokens: { controlled: [] }, scene: null };
  globalThis.ui = {
    notifications: {
      info(message) { notices.info.push(message); },
      warn(message) { notices.warn.push(message); },
      error(message) { notices.error.push(message); }
    }
  };

  const nonce = `${Date.now()}-${Math.random()}`;
  const module = await import(`../src/apps/manager.mjs?manager-actions=${nonce}`);
  module.configureManagerServices({
    actionService: {
      async cleanActor(actor, methodId, options) { calls.push(["clean", actor.uuid, methodId, options]); }
    },
    stateService: {
      async adjustDirt(actor, amount, options) { calls.push(["adjust", actor.uuid, amount, options]); },
      async setAutomaticMaintenance(actor, enabled, options) { calls.push(["maintenance", actor.uuid, enabled, options]); }
    }
  });

  return {
    CleanlinessManager: module.CleanlinessManager,
    actors,
    calls,
    notices,
    getUiState: () => structuredClone(uiState),
    setUiState: (value) => { uiState = structuredClone(value); },
    getModuleSetting: key => moduleSettings[key],
    setModuleSetting: (key, value) => { moduleSettings[key] = value; }
  };
}

test("ApplicationV2 instance-bound bulk Actor actions never require a class receiver", async () => {
  const { CleanlinessManager, actors, calls, notices, setUiState } = await setupManagerTest();
  const actions = CleanlinessManager.DEFAULT_OPTIONS.actions;
  const manager = new CleanlinessManager();

  await assert.doesNotReject(() => actions.bulkActorAdjust.call(manager, {}, { dataset: { amount: "1" } }));
  await assert.doesNotReject(() => actions.bulkActorAdjust.call(manager, {}, { dataset: { amount: "-1" } }));
  for (const actorAction of ["water", "clean", "maintenance-on", "maintenance-off"]) {
    await assert.doesNotReject(() => actions.bulkActorAction.call(manager, {}, { dataset: { actorAction } }));
  }

  assert.equal(calls.filter(([kind]) => kind === "adjust").length, actors.length * 2);
  assert.equal(calls.filter(([kind, , method]) => kind === "clean" && method === "water").length, actors.length);
  assert.equal(calls.filter(([kind, , method]) => kind === "clean" && method === "soap").length, actors.length);
  assert.equal(calls.filter(([kind, , enabled]) => kind === "maintenance" && enabled === true).length, actors.length);
  assert.equal(calls.filter(([kind, , enabled]) => kind === "maintenance" && enabled === false).length, actors.length);
  assert.equal(notices.error.length, 0);

  const beforeRepeated = calls.length;
  await assert.doesNotReject(() => Promise.all([
    actions.bulkActorAdjust.call(manager, {}, { dataset: { amount: "1" } }),
    actions.bulkActorAdjust.call(manager, {}, { dataset: { amount: "1" } })
  ]));
  assert.equal(calls.length - beforeRepeated, actors.length * 2, "rapid repeated clicks must both execute");

  setUiState({ activeTab: "actors", search: "nobody-visible", selectedActorUuids: actors.map((actor) => actor.uuid) });
  const beforeFiltered = calls.length;
  await actions.bulkActorAction.call(manager, {}, { dataset: { actorAction: "water" } });
  assert.equal(calls.length - beforeFiltered, actors.length, "persisted selection remains actionable even when filtered off the current list");

  setUiState({ activeTab: "actors", selectedActorUuids: [] });
  const beforeEmpty = calls.length;
  await assert.doesNotReject(() => actions.bulkActorAction.call(manager, {}, { dataset: { actorAction: "clean" } }));
  assert.equal(calls.length, beforeEmpty);
  assert.ok(notices.warn.includes("GAG.Notifications.SelectActors"));

  setUiState({ activeTab: "actors", selectedActorUuids: [actors[0].uuid] });
  const reopened = new CleanlinessManager();
  await assert.doesNotReject(() => actions.bulkActorAction.call(reopened, {}, { dataset: { actorAction: "clean" } }));
  assert.deepEqual(calls.at(-1).slice(0, 3), ["clean", actors[0].uuid, "soap"]);
});

test("Actor-browser selection actions serialize settings writes and survive reopen", async () => {
  const { CleanlinessManager, actors, getUiState, setUiState } = await setupManagerTest();
  const actions = CleanlinessManager.DEFAULT_OPTIONS.actions;
  const manager = new CleanlinessManager();
  manager.element = {
    querySelectorAll() {
      return actors.map((actor) => ({ dataset: { gagSelectActor: actor.uuid } }));
    }
  };

  setUiState({ activeTab: "actors", selectedActorUuids: [] });
  await assert.doesNotReject(() => actions.selectAllActors.call(manager));
  assert.deepEqual(new Set(getUiState().selectedActorUuids), new Set(actors.map((actor) => actor.uuid)));

  await assert.doesNotReject(() => actions.clearActorSelection.call(manager));
  assert.deepEqual(getUiState().selectedActorUuids, []);

  const group = {
    querySelectorAll() { return [{ dataset: { gagSelectActor: actors[1].uuid } }]; }
  };
  await assert.doesNotReject(() => actions.selectActorGroup.call(manager, {}, { closest: () => group }));
  assert.deepEqual(getUiState().selectedActorUuids, [actors[1].uuid]);

  const reopened = new CleanlinessManager();
  reopened.element = manager.element;
  await assert.doesNotReject(() => actions.clearActorSelection.call(reopened));
  assert.deepEqual(getUiState().selectedActorUuids, []);
});

test("selection buttons toggle with coverage highlights and preserve the scroll", async () => {
  const { CleanlinessManager, actors, notices, getUiState, setUiState } = await setupManagerTest();
  const actions = CleanlinessManager.DEFAULT_OPTIONS.actions;
  const manager = new CleanlinessManager();
  setUiState({ activeTab: "actors", selectedActorUuids: [] });

  const makeRowStub = actor => {
    const state = { classes: new Set() };
    return {
      dataset: { gagSelectActor: actor.uuid },
      checked: false,
      closest: () => ({ classList: { toggle: (name, on) => { if (on) state.classes.add(name); else state.classes.delete(name); } }, state })
    };
  };
  const makeButton = () => ({ classList: { toggle() {} }, setAttribute(attr, value) { this[attr] = value; } });
  const visibleButton = makeButton();
  const rows = actors.map(makeRowStub);
  manager.element = {
    querySelector(selector) {
      if (selector === "button[data-action='selectAllActors']") return visibleButton;
      if (selector === "[data-gag-selected-actor-count]") return { textContent: "" };
      return null;
    },
    querySelectorAll(selector) {
      if (selector === "[data-gag-select-actor]:not(:disabled)") return rows;
      return [];
    }
  };
  let renderCalls = 0;
  manager.render = () => { renderCalls += 1; return Promise.resolve(manager); };

  await actions.selectAllActors.call(manager);
  assert.deepEqual(new Set(getUiState().selectedActorUuids), new Set(actors.map(actor => actor.uuid)));
  assert.ok(notices.info.at(-1).startsWith("GAG.Notifications.ActorsSelectedCount"));
  assert.equal(renderCalls, 0, "selection actions never re-render, the scroll stays put");
  assert.equal(visibleButton["aria-pressed"], "true", "covered select-visible paints pressed");
  assert.ok(rows.every(row => row.checked === true), "checkboxes sync without a re-render");

  await actions.selectAllActors.call(manager);
  assert.deepEqual(getUiState().selectedActorUuids, [], "second press on a covered button empties it");
  assert.ok(notices.info.at(-1).startsWith("GAG.Notifications.ActorsDeselectedCount"));
  assert.equal(visibleButton["aria-pressed"], "false");
  assert.ok(rows.every(row => row.checked === false));

  await actions.selectActorGroup.call(manager, {}, { closest: () => ({ querySelectorAll: () => rows.slice(0, 1) }) });
  assert.deepEqual(getUiState().selectedActorUuids, [actors[0].uuid]);
  assert.equal(visibleButton["aria-pressed"], "false", "one selected row does not cover the list");

  await actions.selectActorGroup.call(manager, {}, { closest: () => ({ querySelectorAll: () => rows.slice(0, 1) }) });
  assert.deepEqual(getUiState().selectedActorUuids, [], "a covered folder button empties exactly its own group");

  setUiState({ activeTab: "actors", selectedActorUuids: [actors[0].uuid, actors[1].uuid] });
  const manualRow = rows.find(row => row.dataset.gagSelectActor === actors[1].uuid);
  manualRow.checked = false;
  await manager.updateActorSelection(manualRow);
  assert.deepEqual(getUiState().selectedActorUuids, [actors[0].uuid]);
  assert.equal(visibleButton["aria-pressed"], "false", "manual deselection un-presses the visible button");
  manualRow.checked = true;
  await manager.updateActorSelection(manualRow);
  assert.deepEqual(new Set(getUiState().selectedActorUuids), new Set(actors.map(actor => actor.uuid)));
  assert.equal(visibleButton["aria-pressed"], "true", "manual re-selection re-presses the visible button");

  await actions.clearActorSelection.call(manager);
  assert.deepEqual(getUiState().selectedActorUuids, []);
  assert.equal(visibleButton["aria-pressed"], "false");
});

test("the accessibility one-shot option keeps selection buttons press-only", async () => {
  const { CleanlinessManager, actors, getUiState, setUiState, setModuleSetting } = await setupManagerTest();
  const actions = CleanlinessManager.DEFAULT_OPTIONS.actions;
  const manager = new CleanlinessManager();
  setUiState({ activeTab: "actors", selectedActorUuids: [] });
  setModuleSetting("selectionButtonsOneShot", true);
  const makeRowStub = actor => ({ dataset: { gagSelectActor: actor.uuid }, checked: false, closest: null });
  const rows = actors.map(makeRowStub);
  const visibleButton = { classList: { toggle() {} }, setAttribute() {} };
  manager.element = {
    querySelector(selector) {
      if (selector === "button[data-action='selectAllActors']") return visibleButton;
      if (selector === "[data-gag-selected-actor-count]") return { textContent: "" };
      return null;
    },
    querySelectorAll(selector) { return selector === "[data-gag-select-actor]:not(:disabled)" ? rows : []; }
  };
  const banners = [];
  const originalInfo = ui.notifications.info;
  ui.notifications.info = message => banners.push(message);
  try {
    await actions.selectAllActors.call(manager);
    await actions.selectAllActors.call(manager);
  } finally {
    ui.notifications.info = originalInfo;
  }
  assert.deepEqual(new Set(getUiState().selectedActorUuids), new Set(actors.map(actor => actor.uuid)), "second one-shot press never deselects");
  assert.equal(banners.filter(b => b.startsWith("GAG.Notifications.ActorsSelectedCount")).length, 2);
  setModuleSetting("selectionButtonsOneShot", false);
  await actions.clearActorSelection.call(manager);
  assert.deepEqual(getUiState().selectedActorUuids, []);
});

test("Actor-browser action rejection boundary contains service failures", async () => {
  const { CleanlinessManager, actors, notices, setUiState } = await setupManagerTest();
  const manager = new CleanlinessManager();
  const actions = CleanlinessManager.DEFAULT_OPTIONS.actions;
  setUiState({ activeTab: "actors", selectedActorUuids: [actors[0].uuid] });

  // Make a persisted-selection write fail to verify the action-level rejection boundary.
  const originalSet = game.settings.set;
  game.settings.set = async () => { throw new Error("simulated settings failure"); };
  const originalConsoleError = console.error;
  const errors = [];
  console.error = (...args) => errors.push(args);
  try {
    await assert.doesNotReject(() => actions.clearActorSelection.call(manager));
  } finally {
    console.error = originalConsoleError;
    game.settings.set = originalSet;
  }
  assert.equal(notices.error.at(-1), "GAG.Errors.ActorManagerActionFailed");
  assert.match(String(errors.at(-1)?.[0] ?? ""), /\[runyth-garb-and-grime\] Actor dashboard action failed/);
});


test("Manager ApplicationV2 action handlers contain no private-static receiver trap", () => {
  assert.doesNotMatch(managerSource, /static\s+(?:async\s+)?#[A-Za-z_$][\w$]*\s*\(/);
  assert.doesNotMatch(managerSource, /onBulkActorAction[\s\S]{0,900}?this\.#[A-Za-z_$]/);
  assert.match(managerSource, /const actors = await selectedModifiableActors\(\)/);
  assert.match(managerSource, /runActorManagerOperation\(this, async \(\) =>/);
});
