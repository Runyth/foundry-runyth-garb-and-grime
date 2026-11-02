import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_CONFIGURATION, DEFAULT_PERMISSIONS } from "../garb-and-grime/src/defaults.mjs";
import { resolveCleanlinessActor, resolveTokenCleanlinessActor } from "../garb-and-grime/src/actor-resolution.mjs";
import { StateService } from "../garb-and-grime/src/state-service.mjs";
import { TokenLabelService } from "../garb-and-grime/src/integrations/token-labels.mjs";

const MODULE_ID = "garb-and-grime";

function getProperty(object, path) {
  return String(path).split(".").reduce((value, part) => value?.[part], object);
}

class Container {
  constructor() {
    this.children = [];
    this.position = { set: (x, y) => { this.x = x; this.y = y; } };
  }
  addChild(child) {
    child.parent?.removeChild?.(child);
    child.parent = this;
    this.children.push(child);
    return child;
  }
  removeChild(child) {
    this.children = this.children.filter((item) => item !== child);
    child.parent = null;
  }
  destroy({ children = false } = {}) {
    if (children) for (const child of [...this.children]) child.destroy?.({ children: true });
    this.parent?.removeChild?.(this);
    this.destroyed = true;
  }
}
class Graphics extends Container {
  clear() { return this; }
  roundRect() { return this; }
  fill() { return this; }
  stroke() { return this; }
}
class Text extends Container {
  static getTextStyle() { return {}; }
  constructor(value, style) {
    super();
    this.text = value;
    this.style = style;
    this.width = String(value).length * 8;
    this.height = Number(style.fontSize);
    this.anchor = { set() {} };
  }
}

function dirtyState(level) {
  return { dirtLevel: level, body: { level, clean: level === 0 }, clothing: { level, clean: level === 0 } };
}

function setup({ player = false } = {}) {
  const configuration = structuredClone(DEFAULT_CONFIGURATION);
  configuration.tokenLabels.enabled = true;
  configuration.tokenLabels.visibilityMode = "always";
  configuration.effects.enabled = false;
  const permissions = structuredClone(DEFAULT_PERMISSIONS);
  permissions.userOverrides = { p1: { modifyOwnActions: true, viewTokenLabels: true } };
  const values = new Map([
    [`${MODULE_ID}.configuration`, configuration],
    [`${MODULE_ID}.permissions`, permissions],
    [`${MODULE_ID}.tokenLabelsVisible`, true],
    [`${MODULE_ID}.tokenLabelViewerMode`, "inherit"],
    [`${MODULE_ID}.tokenLabelViewerPosition`, "inherit"]
  ]);
  const hooks = new Map();
  globalThis.Hooks = {
    on(event, callback) { hooks.set(event, [...(hooks.get(event) ?? []), callback]); },
    call() { return true; },
    callAll(event, ...args) { for (const callback of hooks.get(event) ?? []) callback(...args); }
  };
  globalThis.foundry = {
    utils: {
      deepClone: structuredClone, getProperty,
      mergeObject(original, other, { inplace = true } = {}) {
        const output = inplace ? original : structuredClone(original);
        function merge(target, patch) {
          for (const [key, value] of Object.entries(patch ?? {})) {
            if (value && typeof value === "object" && !Array.isArray(value)) {
              target[key] = merge(target[key] && typeof target[key] === "object" ? target[key] : {}, value);
            } else target[key] = structuredClone(value);
          }
          return target;
        }
        return merge(output, other);
      },
      hasProperty: (object, path) => getProperty(object, path) !== undefined
    },
    canvas: { containers: { PreciseText: Text } }
  };
  globalThis.PIXI = { Container, Graphics };
  globalThis.CONFIG = { Canvas: { groups: { interface: { zIndexScrollingText: 400 } } } };
  globalThis.CONST = { KEYBINDING_PRECEDENCE: { NORMAL: 0 } };
  globalThis.canvas = { scene: { id: "scene1" }, interface: new Container(), tokens: { placeables: [], controlled: [] } };
  globalThis.ui = { notifications: { info() {}, warn() {}, error() {} }, controls: { render() {} } };
  globalThis.game = {
    user: player ? { id: "p1", isGM: false, role: 1 } : { id: "gm", isGM: true, role: 4 },
    actors: new Map(),
    settings: { get(moduleId, key) { return values.get(`${moduleId}.${key}`); } },
    keybindings: { register() {} },
    i18n: {
      localize: (key) => ({ "GAG.Levels.0.Name": "Clean", "GAG.Levels.1.Name": "Worn", "GAG.Levels.2.Name": "Dirty", "GAG.Levels.3.Name": "Stinking" })[key] ?? key,
      format: (key) => key
    }
  };
  return { hooks, configuration, values };
}

function actor({ id, type = "character", level = 2, userOwns = true }) {
  let stored = dirtyState(level);
  const writes = [];
  return {
    id, uuid: `Actor.${id}`, type, name: id, documentName: "Actor", effects: [], writes,
    testUserPermission: () => userOwns,
    getFlag(moduleId, key) { return moduleId === MODULE_ID && key === "state" ? structuredClone(stored) : undefined; },
    async setFlag(moduleId, key, value) {
      assert.equal(moduleId, MODULE_ID);
      assert.equal(key, "state");
      stored = structuredClone(value);
      writes.push(structuredClone(value));
      Hooks.callAll("updateActor", this, { flags: { [MODULE_ID]: { state: structuredClone(value) } } });
      return this;
    }
  };
}

function token(worldActor, { id, linked = false, level = 2 } = {}) {
  const tokenDocument = {
    documentName: "Token", id, uuid: `Scene.scene1.Token.${id}`,
    actorId: worldActor.id, actorLink: linked, baseActor: worldActor,
    x: 100, y: 200, width: 1, height: 1,
    getFlag: () => undefined
  };
  const tokenActor = linked ? worldActor : actor({ id: worldActor.id, type: worldActor.type, level });
  if (!linked) {
    tokenActor.uuid = `Scene.scene1.Token.${id}.Actor.${worldActor.id}`;
    tokenActor.token = tokenDocument;
  }
  const object = {
    document: tokenDocument, actor: tokenActor,
    isVisible: true, alpha: 1, w: 100, h: 100,
    position: { x: 100, y: 200 }
  };
  tokenDocument.actor = tokenActor;
  tokenDocument.object = object;
  return { object, tokenActor, tokenDocument };
}

async function flush() { await new Promise((resolve) => setTimeout(resolve, 0)); }

test("unlinked PC Tokens read the world Actor's live cleanliness, not their stale ActorDelta snapshot", async () => {
  setup();
  const world = actor({ id: "pc", level: 2 });
  game.actors.set(world.id, world);
  const first = token(world, { id: "pc1", level: 2 });
  const second = token(world, { id: "pc2", level: 2 });
  canvas.tokens.placeables = [first.object, second.object];
  const stateService = new StateService({});
  const labelService = new TokenLabelService(stateService);
  labelService.registerHooks();
  labelService.refreshAll();
  assert.equal(labelService.labels.size, 2);
  assert.ok([...labelService.labels.values()].every((label) => label.gagText.text === "2 · Dirty"));

  await stateService.setDirtLevel(world, 0, { chat: false });
  await flush();
  assert.equal(stateService.getState(first.tokenActor).dirtLevel, 0);
  assert.equal(stateService.getState(second.tokenActor).dirtLevel, 0);
  assert.ok([...labelService.labels.values()].every((label) => label.gagText.text === "0 · Clean"), "both deployed, unlinked Token labels refresh immediately after the world Actor update");
  assert.equal(first.tokenActor.getFlag(MODULE_ID, "state").dirtLevel, 2, "synthetic ActorDelta is never rewritten");
  assert.equal(second.tokenActor.writes.length, 0);

  const drawnLater = token(world, { id: "pc3", level: 2 });
  canvas.tokens.placeables.push(drawnLater.object);
  Hooks.callAll("drawToken", drawnLater.object);
  await flush();
  assert.equal(labelService.labels.size, 3);
  assert.ok([...labelService.labels.values()].every((label) => label.gagText.text === "0 · Clean"), "newly drawn Tokens also read the authoritative state");

  await stateService.adjustDirt(world, 1, { chat: false });
  await flush();
  assert.ok([...labelService.labels.values()].every((label) => label.gagText.text === "1 · Worn"));
});

test("washing via an unlinked PC Token updates the world Actor and all deployed PC Tokens", async () => {
  setup({ player: true });
  const world = actor({ id: "pc", level: 3 });
  game.actors.set(world.id, world);
  const one = token(world, { id: "pc1", level: 3 });
  const two = token(world, { id: "pc2", level: 3 });
  canvas.tokens.placeables = [one.object, two.object];
  const stateService = new StateService({});
  const labels = new TokenLabelService(stateService);
  labels.registerHooks();
  labels.refreshAll();
  await stateService.updateStateFromAction(one.tokenActor, (state) => {
    state.dirtLevel = 0;
    state.body = { level: 0, clean: true };
    state.clothing = { level: 0, clean: true };
    return state;
  }, { chat: false });
  await flush();
  assert.equal(world.getFlag(MODULE_ID, "state").dirtLevel, 0);
  assert.equal(one.tokenActor.writes.length, 0, "TokenActor never becomes the persisted source");
  assert.equal(two.tokenActor.writes.length, 0);
  assert.ok([...labels.labels.values()].every((label) => label.gagText.text === "0 · Clean"));
});

test("unlinked NPC Tokens retain their deliberately independent cleanliness", async () => {
  setup();
  const world = actor({ id: "npc", type: "npc", level: 3 });
  game.actors.set(world.id, world);
  const npc = token(world, { id: "npc1", level: 1 });
  const service = new StateService({});
  assert.equal(resolveCleanlinessActor(npc.tokenActor), npc.tokenActor);
  assert.equal(service.getState(npc.tokenActor).dirtLevel, 1);
  await service.setDirtLevel(world, 0, { chat: false });
  assert.equal(service.getState(npc.tokenActor).dirtLevel, 1);
  assert.equal(npc.tokenActor.writes.length, 0);
});

test("PC canonicalization does not cross to an invalid or unrelated Actor", () => {
  setup();
  const world = actor({ id: "pc1", level: 0 });
  const synthetic = token(world, { id: "token1", level: 2 });
  synthetic.tokenDocument.actorId = "another-actor";
  assert.equal(resolveCleanlinessActor(synthetic.tokenActor), synthetic.tokenActor);
  synthetic.tokenDocument.actorId = "pc1";
  synthetic.tokenDocument.baseActor = actor({ id: "pc1", type: "npc" });
  assert.equal(resolveCleanlinessActor(synthetic.tokenActor), synthetic.tokenActor);
  synthetic.tokenDocument.baseActor = null;
  assert.equal(resolveCleanlinessActor(synthetic.tokenActor), synthetic.tokenActor);
});

test("an unlinked PC Token cannot use its own ownership to change a world Actor without permission", async () => {
  setup({ player: true });
  const world = actor({ id: "pc", level: 2, userOwns: false });
  const synthetic = token(world, { id: "pc1", level: 2 });
  const service = new StateService({});
  await assert.rejects(() => service.setDirtLevel(synthetic.tokenActor, 0, { chat: false }), /PermissionDenied/);
  assert.equal(world.writes.length, 0);
});

test("canvas Token base-Actor resolution works when a synthetic Actor does not expose .token", async () => {
  setup();
  const world = actor({ id: "pc", level: 1 });
  const deployed = token(world, { id: "pc1", level: 3 });
  delete deployed.tokenActor.token;
  assert.equal(resolveTokenCleanlinessActor(deployed.object), world);
  const labels = new TokenLabelService(new StateService({}));
  labels.refreshToken(deployed.object);
  assert.equal([...labels.labels.values()][0].gagText.text, "1 · Worn");
});

test("hovering a deployed PC Token updates its cached label text even when updateActor is not received", async () => {
  const { configuration } = setup();
  configuration.tokenLabels.visibilityMode = "hovered";
  const world = actor({ id: "hoverpc", level: 3 });
  game.actors.set(world.id, world);
  const deployed = token(world, { id: "hoverToken", level: 3 });
  deployed.object.hover = true;
  canvas.tokens.placeables = [deployed.object];
  const state = new StateService({});
  const labels = new TokenLabelService(state);
  labels.registerHooks();
  labels.refreshAll();
  const label = [...labels.labels.values()][0];
  assert.equal(label.gagText.text, "3 · Stinking");
  deployed.object.hover = false;
  Hooks.callAll("hoverToken", deployed.object, false);
  await flush();
  assert.equal(label.visible, false);
  // Simulate a state change received without the local updateActor event.
  // A hover refresh must consult the authoritative world Actor rather than
  // merely positioning the previously cached text object.
  const replacement = dirtyState(0);
  const originalCall = Hooks.callAll;
  Hooks.callAll = (event, ...args) => {
    if (event !== "updateActor" && event !== "garb-and-grime.stateChanged") originalCall(event, ...args);
  };
  try { await world.setFlag(MODULE_ID, "state", replacement); }
  finally { Hooks.callAll = originalCall; }
  deployed.object.hover = true;
  Hooks.callAll("hoverToken", deployed.object, true);
  await flush();
  assert.equal(label.visible, true);
  assert.equal(label.gagText.text, "0 · Clean", "existing hovered Token must not retain stale label text");
});

test("a flattened Foundry Actor flag update also refreshes already deployed PC labels", async () => {
  setup();
  const world = actor({ id: "flatpc", level: 2 });
  game.actors.set(world.id, world);
  const deployed = token(world, { id: "flattened", level: 2 });
  canvas.tokens.placeables = [deployed.object];
  const labels = new TokenLabelService(new StateService({}));
  labels.registerHooks();
  labels.refreshAll();
  await world.setFlag(MODULE_ID, "state", dirtyState(0));
  Hooks.callAll("updateActor", world, { [`flags.${MODULE_ID}.state`]: dirtyState(0) });
  await flush();
  assert.equal([...labels.labels.values()][0].gagText.text, "0 · Clean");
});
