// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_CONFIGURATION, DEFAULT_PERMISSIONS } from "../src/defaults.mjs";
import { TokenLabelService, formatLabel } from "../src/integrations/token-labels.mjs";

function getProperty(object, path) {
  return String(path).split(".").reduce((value, key) => value?.[key], object);
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

class MockContainer {
  constructor() {
    this.children = [];
    this.destroyed = false;
    this.position = { set: (x, y) => { this.x = x; this.y = y; } };
  }
  addChild(child) {
    if (child.parent?.removeChild) child.parent.removeChild(child);
    child.parent = this;
    this.children.push(child);
    return child;
  }
  removeChild(child) {
    this.children = this.children.filter((entry) => entry !== child);
    child.parent = null;
  }
  destroy({ children = false } = {}) {
    if (children) for (const child of [...this.children]) child.destroy?.({ children: true });
    this.parent?.removeChild?.(this);
    this.destroyed = true;
  }
}

class MockGraphics extends MockContainer {
  constructor() {
    super();
    this.commands = [];
  }
  clear() { this.commands = []; return this; }
  roundRect(x, y, width, height, radius) { this.commands.push(["roundRect", x, y, width, height, radius]); return this; }
  fill(options) { this.commands.push(["fill", options]); return this; }
  stroke(options) { this.commands.push(["stroke", options]); return this; }
}

class MockText extends MockContainer {
  static constructorCalls = [];
  static getTextStyle() { return {}; }
  constructor(first, second) {
    super();
    MockText.constructorCalls.push([first, second]);
    this.style = second;
    this.text = first;
    this.height = Number(this.style?.fontSize ?? 22);
    this.anchor = { set() {} };
  }
  set text(value) {
    this._text = String(value ?? "");
    this.width = Math.max(20, this._text.length * 9);
  }
  get text() { return this._text; }
}

function setupFoundry() {
  const values = new Map([
    ["runyth-garb-and-grime.configuration", structuredClone(DEFAULT_CONFIGURATION)],
    ["runyth-garb-and-grime.permissions", structuredClone(DEFAULT_PERMISSIONS)],
    ["runyth-garb-and-grime.tokenLabelsVisible", true],
    ["runyth-garb-and-grime.tokenLabelViewerMode", "inherit"],
    ["runyth-garb-and-grime.tokenLabelViewerPosition", "inherit"]
  ]);
  globalThis.game = {
    settings: {
      get(moduleId, key) { return values.get(`${moduleId}.${key}`); },
      async set(moduleId, key, value) { values.set(`${moduleId}.${key}`, value); return value; }
    },
    i18n: {
      localize(key) {
        const names = { "GAG.Levels.0.Name": "Clean", "GAG.Levels.1.Name": "Worn", "GAG.Levels.2.Name": "Dirty", "GAG.Levels.3.Name": "Stinking", "GAG.Common.BodyShort": "B", "GAG.Common.ClothingShort": "C" };
        return names[key] ?? key;
      },
      format: (key) => key
    },
    user: { id: "gm", isGM: true, role: 4 }
  };
  globalThis.ui = { notifications: { info() {}, warn() {}, error() {} }, controls: { render() {} } };
  globalThis.PIXI = { Container: MockContainer, Graphics: MockGraphics };
  globalThis.CONFIG = { Canvas: { groups: { interface: { zIndexScrollingText: 500 } } } };
  globalThis.canvas = { interface: new MockContainer(), tokens: { placeables: [], controlled: [] } };
  MockText.constructorCalls = [];
  globalThis.foundry = {
    utils: { deepClone: structuredClone, mergeObject, getProperty },
    canvas: { containers: { PreciseText: MockText } }
  };
  return values;
}

function makeToken(mode = "inherit", position = "inherit") {
  const flags = new Map();
  if (mode !== "inherit") flags.set("tokenLabelMode", mode);
  if (position !== "inherit") flags.set("tokenLabelPosition", position);
  const document = {
    documentName: "Token",
    id: "t1",
    uuid: "Scene.s1.Token.t1",
    name: "Ada",
    x: 100,
    y: 200,
    actor: null,
    object: null,
    getFlag(_moduleId, key) { return flags.get(key); },
    async setFlag(_moduleId, key, value) { flags.set(key, value); },
    async unsetFlag(_moduleId, key) { flags.delete(key); }
  };
  const actor = { documentName: "Actor", id: "a1", uuid: "Actor.a1", name: "Ada", type: "character", isOwner: true, testUserPermission: () => true };
  document.actor = actor;
  const token = {
    actor,
    document,
    isVisible: true,
    alpha: 1,
    w: 100,
    h: 100,
    position: { x: 100, y: 200 }
  };
  document.object = token;
  return { token, document, flags };
}

const state = {
  dirtLevel: 2,
  body: { level: 3, clean: false },
  clothing: { level: 1, clean: false }
};

test("token label formats are localized and include optional body/clothing detail", () => {
  setupFoundry();
  assert.equal(formatLabel(state, { format: "level-name" }), "2 · Dirty");
  assert.equal(formatLabel(state, { format: "name" }), "Dirty");
  assert.equal(formatLabel(state, { format: "level" }), "2");
  assert.equal(formatLabel(state, { format: "detailed" }), "2 · Dirty · B3/C1");
});

test("labels render once in a high interface layer with clear configurable styling", () => {
  const values = setupFoundry();
  const { token } = makeToken();
  canvas.tokens.placeables = [token];
  const service = new TokenLabelService({ getState: () => structuredClone(state) });

  service.refreshToken(token);
  assert.equal(canvas.interface.children.length, 1, "one dedicated interface layer is created");
  const layer = canvas.interface.children[0];
  assert.ok(layer.zIndex >= 10_000, "the label layer is above Token rendering");
  assert.equal(layer.children.length, 1);
  assert.equal(token.children, undefined, "the Token display tree is not mutated");

  const label = layer.children[0];
  assert.equal(typeof MockText.constructorCalls[0]?.[0], "string", "PreciseText receives a string-first constructor argument");
  assert.equal(MockText.constructorCalls[0]?.[0], "2 · Dirty");
  assert.equal(label.gagText.text, "2 · Dirty");
  assert.equal(label.gagText.style.fill, "#ffffff");
  assert.equal(label.gagText.style.fontSize, 18, "default label font is compact");
  assert.equal(label.gagBounds.height, 24, "default label background uses compact vertical padding");
  assert.deepEqual(label.gagBackground.commands.find(([name]) => name === "fill")?.[1], { color: 0x111318, alpha: 0.92 });
  assert.ok(label.y < token.document.y, "default position is above the Token");

  service.refreshToken(token);
  assert.equal(layer.children.length, 1, "refreshing does not duplicate labels");

  const configuration = structuredClone(DEFAULT_CONFIGURATION);
  configuration.tokenLabels.fontColor = "#00ff00";
  configuration.tokenLabels.backgroundColor = "#0000ff";
  configuration.tokenLabels.backgroundOpacity = 0.75;
  values.set("runyth-garb-and-grime.configuration", configuration);
  service.refreshToken(token);
  assert.equal(label.gagText.style.fill, "#00ff00");
  assert.deepEqual(label.gagBackground.commands.find(([name]) => name === "fill")?.[1], { color: 0x0000ff, alpha: 0.75 });
});

test("global display and per-token overrides control one idempotent canvas label", () => {
  const values = setupFoundry();
  const { token, flags } = makeToken();
  canvas.tokens.placeables = [token];
  const service = new TokenLabelService({ getState: () => structuredClone(state) });

  service.refreshToken(token);
  const label = canvas.interface.children[0].children[0];
  assert.equal(label.visible, true);

  values.set("runyth-garb-and-grime.tokenLabelsVisible", false);
  service.refreshToken(token);
  assert.equal(label.visible, false);

  flags.set("tokenLabelMode", "show");
  service.refreshToken(token);
  assert.equal(label.visible, true);

  flags.set("tokenLabelMode", "hide");
  service.refreshToken(token);
  assert.equal(label.visible, false);
});

test("global and per-token positions support all four sides", () => {
  const values = setupFoundry();
  const { token, flags } = makeToken();
  canvas.tokens.placeables = [token];
  const service = new TokenLabelService({ getState: () => structuredClone(state) });
  service.refreshToken(token);
  const label = canvas.interface.children[0].children[0];

  const configuration = structuredClone(DEFAULT_CONFIGURATION);
  configuration.tokenLabels.position = "below";
  values.set("runyth-garb-and-grime.configuration", configuration);
  service.refreshToken(token);
  assert.ok(label.y > token.document.y + token.h);

  flags.set("tokenLabelPosition", "left");
  service.refreshToken(token);
  assert.ok(label.x < token.document.x);

  flags.set("tokenLabelPosition", "right");
  service.refreshToken(token);
  assert.ok(label.x > token.document.x + token.w);

  flags.set("tokenLabelPosition", "above");
  service.refreshToken(token);
  assert.ok(label.y < token.document.y);
});

test("per-token display and position overrides persist only Token flags and support inherit cleanup", async () => {
  setupFoundry();
  const { token, document, flags } = makeToken();
  const service = new TokenLabelService({ getState: () => structuredClone(state) });

  await service.setTokenMode(document, "show");
  assert.equal(flags.get("tokenLabelMode"), "show");
  await service.setTokenMode(token, "inherit");
  assert.equal(flags.has("tokenLabelMode"), false);

  await service.setTokenPosition(document, "right");
  assert.equal(flags.get("tokenLabelPosition"), "right");
  await service.setTokenPosition(token, "inherit");
  assert.equal(flags.has("tokenLabelPosition"), false);
});


test("persistent labels deny players by default and allow explicit per-user permission", () => {
  const values = setupFoundry();
  game.user = { id: "player-1", isGM: false, role: 1 };
  const configuration = structuredClone(DEFAULT_CONFIGURATION);
  configuration.tokenLabels.visibilityMode = "always";
  configuration.tokenLabels.playerScope = "characters";
  values.set("runyth-garb-and-grime.configuration", configuration);
  const permissions = structuredClone(DEFAULT_PERMISSIONS);
  values.set("runyth-garb-and-grime.permissions", permissions);
  const { token } = makeToken();
  canvas.tokens.placeables = [token];
  const service = new TokenLabelService({ getState: () => structuredClone(state) });

  service.refreshToken(token);
  assert.equal(canvas.interface.children.length, 0, "default player permission exposes no persistent label");

  permissions.userOverrides["player-1"] = { viewTokenLabels: true };
  values.set("runyth-garb-and-grime.permissions", permissions);
  service.refreshToken(token);
  assert.equal(canvas.interface.children.length, 1);
  assert.equal(canvas.interface.children[0].children[0].visible, true, "explicitly permitted player sees the constant PC label");
});

test("automatic visibility modes follow control and hover state without the manual client toggle", () => {
  const values = setupFoundry();
  values.set("runyth-garb-and-grime.tokenLabelsVisible", false);
  const configuration = structuredClone(DEFAULT_CONFIGURATION);
  configuration.tokenLabels.visibilityMode = "controlled";
  values.set("runyth-garb-and-grime.configuration", configuration);
  const { token } = makeToken();
  token.controlled = false;
  token.hover = false;
  canvas.tokens.placeables = [token];
  const service = new TokenLabelService({ getState: () => structuredClone(state) });

  service.refreshToken(token);
  assert.equal(canvas.interface.children.length, 0);
  token.controlled = true;
  service.refreshToken(token);
  const label = canvas.interface.children[0].children[0];
  assert.equal(label.visible, true);

  configuration.tokenLabels.visibilityMode = "hovered";
  token.controlled = false;
  token.hover = false;
  service.refreshToken(token);
  assert.equal(label.visible, false);
  token.hover = true;
  service.refreshToken(token);
  assert.equal(label.visible, true);

  configuration.tokenLabels.visibilityMode = "controlled-or-hovered";
  token.hover = false;
  token.controlled = true;
  service.refreshToken(token);
  assert.equal(label.visible, true);
});

test("character-only actor scope excludes NPC labels while preserving character labels", () => {
  const values = setupFoundry();
  const configuration = structuredClone(DEFAULT_CONFIGURATION);
  configuration.tokenLabels.visibilityMode = "always";
  configuration.tokenLabels.actorScope = "characters";
  values.set("runyth-garb-and-grime.configuration", configuration);
  const { token } = makeToken();
  token.actor.type = "npc";
  token.document.actor.type = "npc";
  const service = new TokenLabelService({ getState: () => structuredClone(state) });
  service.refreshToken(token);
  assert.equal(canvas.interface.children.length, 0);
  token.actor.type = "character";
  service.refreshToken(token);
  assert.equal(canvas.interface.children.length, 1);
});

test("per-token Always show never bypasses player permission or owned-actor scope", () => {
  const values = setupFoundry();
  game.user = { id: "player-2", isGM: false, role: 1 };
  const configuration = structuredClone(DEFAULT_CONFIGURATION);
  configuration.tokenLabels.visibilityMode = "always";
  configuration.tokenLabels.playerScope = "owned";
  values.set("runyth-garb-and-grime.configuration", configuration);
  const permissions = structuredClone(DEFAULT_PERMISSIONS);
  const { token, flags } = makeToken();
  flags.set("tokenLabelMode", "show");
  token.actor.testUserPermission = () => false;
  token.actor.isOwner = false;
  token.document.actor = token.actor;
  canvas.tokens.placeables = [token];
  const service = new TokenLabelService({ getState: () => structuredClone(state) });

  service.refreshToken(token);
  assert.equal(canvas.interface.children.length, 0, "Token override cannot bypass denied persistent-status permission");

  permissions.userOverrides["player-2"] = { viewTokenLabels: true };
  values.set("runyth-garb-and-grime.permissions", permissions);
  service.refreshToken(token);
  assert.equal(canvas.interface.children.length, 0, "permission alone does not bypass owned-actor scope");

  token.actor.testUserPermission = () => true;
  token.actor.isOwner = true;
  service.refreshToken(token);
  assert.equal(canvas.interface.children.length, 1);
});


test("authorized players control their own persistent-label display mode without changing world configuration", async () => {
  const values = setupFoundry();
  game.user = { id: "player-pref", isGM: false, role: 1 };
  const permissions = structuredClone(DEFAULT_PERMISSIONS);
  permissions.userOverrides["player-pref"] = { viewTokenLabels: true };
  values.set("runyth-garb-and-grime.permissions", permissions);
  const configuration = structuredClone(DEFAULT_CONFIGURATION);
  configuration.tokenLabels.visibilityMode = "controlled";
  configuration.tokenLabels.playerScope = "characters";
  values.set("runyth-garb-and-grime.configuration", configuration);
  const { token } = makeToken();
  token.controlled = false;
  canvas.tokens.placeables = [token];
  const service = new TokenLabelService({ getState: () => structuredClone(state) });

  service.refreshToken(token);
  assert.equal(canvas.interface.children.length, 0, "inherited GM default is respected initially");

  await service.setViewerMode("always");
  service.refreshToken(token);
  assert.equal(canvas.interface.children[0].children[0].visible, true, "authorized player can choose Always for their own client");
  assert.equal(values.get("runyth-garb-and-grime.configuration").tokenLabels.visibilityMode, "controlled", "world presentation is unchanged");

  await service.setViewerMode("hidden");
  service.refreshToken(token);
  assert.equal(canvas.interface.children[0].children[0].visible, false, "authorized player can hide labels for their own client");
});

test("player label preferences never bypass the authoritative Permissions tab", async () => {
  const values = setupFoundry();
  game.user = { id: "player-denied", isGM: false, role: 1 };
  values.set("runyth-garb-and-grime.tokenLabelViewerMode", "always");
  const configuration = structuredClone(DEFAULT_CONFIGURATION);
  configuration.tokenLabels.visibilityMode = "always";
  configuration.tokenLabels.playerScope = "characters";
  values.set("runyth-garb-and-grime.configuration", configuration);
  const { token } = makeToken();
  canvas.tokens.placeables = [token];
  const service = new TokenLabelService({ getState: () => structuredClone(state) });

  assert.equal(service.canUseViewerControls(), false);
  service.refreshToken(token);
  assert.equal(canvas.interface.children.length, 0);
  await assert.rejects(() => service.setViewerMode("always"), /GAG\.TokenLabels\.PermissionDenied/);

  const permissions = structuredClone(DEFAULT_PERMISSIONS);
  permissions.userOverrides["player-denied"] = { viewTokenLabels: true };
  values.set("runyth-garb-and-grime.permissions", permissions);
  assert.equal(service.canUseViewerControls(), true);
  service.refreshToken(token);
  assert.equal(canvas.interface.children[0].children[0].visible, true);
});

// v1.2.7: scoped local shortcut must not persist flags/world visibility.
function setupShortcutWorld({ scope = "scene-pcs", visibilityMode = "manual", visible = false } = {}) {
  const values = setupFoundry();
  values.set("runyth-garb-and-grime.tokenLabelsVisible", visible);
  const configuration = structuredClone(DEFAULT_CONFIGURATION);
  configuration.tokenLabels.visibilityMode = visibilityMode;
  configuration.tokenLabels.shortcutScope = scope;
  values.set("runyth-garb-and-grime.configuration", configuration);
  canvas.ready = true;
  canvas.scene = { id: "scene-1" };
  const player = { id: "player-1", isGM: false, role: 1, character: "a1" };
  game.users = [game.user, player];
  const pc = makeToken();
  const extraPc = makeToken();
  extraPc.token.document.id = "t2";
  extraPc.token.document.uuid = "Scene.s1.Token.t2";
  extraPc.token.actor.id = "a2";
  extraPc.token.actor.uuid = "Actor.a2";
  extraPc.token.actor.name = "Other";
  extraPc.token.document.name = "Other";
  extraPc.token.document.actor = extraPc.token.actor;
  game.users.push({ id: "player-2", isGM: false, role: 1, character: "a2" });
  const npc = makeToken();
  npc.token.document.id = "t3";
  npc.token.document.uuid = "Scene.s1.Token.t3";
  npc.token.actor.id = "npc1";
  npc.token.actor.type = "npc";
  npc.token.document.actor = npc.token.actor;
  const unassignedPc = makeToken();
  unassignedPc.token.document.id = "t4";
  unassignedPc.token.document.uuid = "Scene.s1.Token.t4";
  unassignedPc.token.actor.id = "unassigned";
  unassignedPc.token.document.actor = unassignedPc.token.actor;
  unassignedPc.token.actor.testUserPermission = () => false;
  canvas.tokens.placeables = [pc.token, extraPc.token, npc.token, unassignedPc.token];
  const service = new TokenLabelService({ getState: () => structuredClone(state) });
  return { values, configuration, pc, extraPc, npc, unassignedPc, service };
}

test("shortcut defaults to all scene PC Tokens without selection and toggles only locally", () => {
  const { values, pc, extraPc, npc, unassignedPc, service } = setupShortcutWorld();
  assert.equal(canvas.tokens.controlled.length, 0);
  assert.equal(service.toggleSceneTokenLabels(), 2);
  assert.equal(service.shouldDisplay(pc.token), true);
  assert.equal(service.shouldDisplay(extraPc.token), true);
  assert.equal(service.shouldDisplay(npc.token), false);
  assert.equal(service.shouldDisplay(unassignedPc.token), false);
  assert.equal(values.get("runyth-garb-and-grime.tokenLabelsVisible"), false, "global setting was not modified");
  assert.equal(pc.flags.size, 0, "Token document flags were not modified");
  assert.equal(service.toggleSceneTokenLabels(), 2);
  assert.equal(service.shouldDisplay(pc.token), false);
  assert.equal(service.shouldDisplay(extraPc.token), false);
});

test("selected PC mode requires selection and only changes the selected PC", () => {
  const { configuration, values, pc, extraPc, npc, service } = setupShortcutWorld({ scope: "selected-pcs" });
  assert.equal(service.toggleSceneTokenLabels(), 0, "no selection does not silently select all");
  canvas.tokens.controlled = [pc.token, npc.token];
  assert.equal(service.toggleSceneTokenLabels(), 1);
  assert.equal(service.shouldDisplay(pc.token), true);
  assert.equal(service.shouldDisplay(extraPc.token), false);
  assert.equal(service.shouldDisplay(npc.token), false);
  assert.equal(values.get("runyth-garb-and-grime.configuration").tokenLabels.shortcutScope, configuration.tokenLabels.shortcutScope);
});

test("eligible scope can include NPCs, but respects GM Always hide and scope permissions", () => {
  const { values, pc, npc, service } = setupShortcutWorld({ scope: "scene-eligible" });
  npc.flags.set("tokenLabelMode", "hide");
  assert.equal(service.toggleSceneTokenLabels(), 3, "eligible world characters count including unassigned PC, but not GM-hidden NPC");
  assert.equal(service.shouldDisplay(npc.token), false);
  npc.flags.delete("tokenLabelMode");
  const configuration = structuredClone(values.get("runyth-garb-and-grime.configuration"));
  configuration.tokenLabels.shortcutScope = "selected-eligible";
  values.set("runyth-garb-and-grime.configuration", configuration);
  canvas.tokens.controlled = [npc.token];
  assert.equal(service.toggleSceneTokenLabels(), 1);
  assert.equal(service.shouldDisplay(npc.token), true);
  assert.equal(service.shouldDisplay(pc.token), true, "unselected Token state unchanged");
});

test("shortcut works for automatic label modes and mixed states converge to visible", () => {
  const { pc, extraPc, service } = setupShortcutWorld({ visibilityMode: "always" });
  assert.equal(service.shouldDisplay(pc.token), true);
  assert.equal(service.toggleSceneTokenLabels(), 2);
  assert.equal(service.shouldDisplay(pc.token), false);
  assert.equal(service.shouldDisplay(extraPc.token), false);
  assert.equal(service.toggleSceneTokenLabels(), 2);
  assert.equal(service.shouldDisplay(pc.token), true);
  assert.equal(service.shouldDisplay(extraPc.token), true);
  // In a mixed state, next press restores both, not an unpredictable inversion.
  service.shortcutOverrides.set(pc.document.uuid, false);
  assert.equal(service.toggleSceneTokenLabels(), 2);
  assert.equal(service.shouldDisplay(pc.token), true);
});

test("token redraw preserves shortcut state, scene changes clear it, and hidden Tokens stay hidden", () => {
  const { pc, service } = setupShortcutWorld();
  service.toggleSceneTokenLabels();
  const replacement = { ...pc.token, document: { ...pc.document, object: null } };
  replacement.document.object = replacement;
  assert.equal(service.shouldDisplay(replacement), true, "same Token UUID survives Token redraw");
  replacement.isVisible = false;
  assert.equal(service.shouldDisplay(replacement), false, "hidden tokens remain hidden");
  canvas.scene = { id: "scene-2" };
  assert.equal(service.shouldDisplay(pc.token), false, "scene switch discards stale local override");
  assert.equal(service.shortcutOverrides.size, 0);
});

test("player permission denies scoped shortcut even with personal Always, allowed player gets only local labels", () => {
  const { values, pc, service } = setupShortcutWorld();
  game.user = { id: "player-denied", isGM: false, role: 1 };
  values.set("runyth-garb-and-grime.tokenLabelViewerMode", "always");
  assert.equal(service.toggleSceneTokenLabels(), 0);
  assert.equal(service.shouldDisplay(pc.token), false);
  const permissions = structuredClone(DEFAULT_PERMISSIONS);
  permissions.userOverrides["player-denied"] = { viewTokenLabels: true };
  values.set("runyth-garb-and-grime.permissions", permissions);
  values.set("runyth-garb-and-grime.tokenLabelViewerMode", "manual");
  assert.equal(service.toggleSceneTokenLabels(), 2);
  assert.equal(service.shouldDisplay(pc.token), true);
  values.set("runyth-garb-and-grime.tokenLabelViewerMode", "hidden");
  assert.equal(service.toggleSceneTokenLabels(), 0);
  assert.equal(service.shouldDisplay(pc.token), false);
});

test("disabled shortcut and absent canvas are safe no-ops", () => {
  const { values, configuration, service } = setupShortcutWorld();
  configuration.tokenLabels.shortcutEnabled = false;
  values.set("runyth-garb-and-grime.configuration", configuration);
  assert.equal(service.toggleSceneTokenLabels(), 0);
  configuration.tokenLabels.shortcutEnabled = true;
  canvas.ready = false;
  assert.equal(service.toggleSceneTokenLabels(), 0);
  assert.equal(service.shortcutOverrides.size, 0);
});

test("Foundry native keybinding remains editable and invokes the scoped shortcut", async () => {
  const { pc, service } = setupShortcutWorld();
  let binding;
  globalThis.CONST = { KEYBINDING_PRECEDENCE: { NORMAL: 0 } };
  globalThis.Hooks = { on() {} };
  game.keybindings = { register(namespace, key, data) { binding = { namespace, key, ...data }; } };
  service.registerHooks();
  assert.equal(binding.namespace, "runyth-garb-and-grime");
  assert.equal(binding.key, "toggleTokenCleanlinessLabels");
  assert.deepEqual(binding.editable, [{ key: "KeyG", modifiers: ["SHIFT", "ALT"] }]);
  assert.equal(binding.restricted, false);
  assert.equal(binding.repeat, undefined);
  assert.equal(binding.onDown(), true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(service.shouldDisplay(pc.token), true);
});

test("shortcuts never bypass GM per-Token hidden flags, even for permitted players", () => {
  const { values, pc, service } = setupShortcutWorld({ visibilityMode: "always" });
  game.user = { id: "player-1", isGM: false, role: 1 };
  const permissions = structuredClone(DEFAULT_PERMISSIONS);
  permissions.userOverrides["player-1"] = { viewTokenLabels: true };
  values.set("runyth-garb-and-grime.permissions", permissions);
  pc.flags.set("tokenLabelMode", "hide");
  assert.equal(service.toggleSceneTokenLabels(), 1);
  assert.equal(service.shouldDisplay(pc.token), false);
  pc.flags.delete("tokenLabelMode");
  assert.equal(service.shouldDisplay(pc.token), true, "removing GM hide restores currently allowed player label");
});

test("viewer-mode change clears session shortcut state to honor explicit preference", async () => {
  const { values, pc, service } = setupShortcutWorld();
  game.user = { id: "player-1", isGM: false, role: 1 };
  const permissions = structuredClone(DEFAULT_PERMISSIONS);
  permissions.userOverrides["player-1"] = { viewTokenLabels: true };
  values.set("runyth-garb-and-grime.permissions", permissions);
  service.toggleSceneTokenLabels();
  assert.equal(service.shouldDisplay(pc.token), true);
  await service.setViewerMode("hidden");
  assert.equal(service.shortcutOverrides.size, 0);
  assert.equal(service.shouldDisplay(pc.token), false);
});

test("disabling shortcut resets local overrides instead of leaving a hidden persistent effect", () => {
  const { values, configuration, pc, service } = setupShortcutWorld();
  service.toggleSceneTokenLabels();
  assert.equal(service.shouldDisplay(pc.token), true);
  configuration.tokenLabels.shortcutEnabled = false;
  values.set("runyth-garb-and-grime.configuration", configuration);
  assert.equal(service.shouldDisplay(pc.token), false);
  assert.equal(service.shortcutOverrides.size, 0);
  configuration.tokenLabels.shortcutEnabled = true;
  assert.equal(service.shouldDisplay(pc.token), false, "re-enabling does not resurrect previous overrides");
});
