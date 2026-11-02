import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const moduleRoot = path.resolve(here, "../garb-and-grime");
const read = (name) => fs.readFileSync(path.join(moduleRoot, name), "utf8");

test("feature release exposes redundant dashboard launchers including a dedicated left Scene Control", () => {
  const settings = read("templates/settings-hub.hbs");
  const settingsApp = read("src/apps/settings-hub.mjs");
  const sidebar = read("src/integrations/sidebar.mjs");
  const controls = read("src/integrations/scene-controls.mjs");

  assert.match(settings, /gag-dashboard-launch-card/);
  assert.match(settings, /data-action="openManager"/);
  assert.match(settingsApp, /openManager:\s*GarbAndGrimeSettings\.onOpenManager/);
  assert.match(sidebar, /renderActorDirectory/);
  assert.match(sidebar, /renderSettings/);
  assert.match(controls, /controls\[MODULE_ID\]\s*=\s*\{/);
  assert.match(controls, /title:\s*"GAG\.SceneControls\.Group"/);
  assert.match(controls, /garb-and-grime-manager/);
});

test("Actor dashboard includes scalable hierarchical, regex, type, selection, and bulk workflows", () => {
  const source = read("src/apps/manager.mjs");
  const scope = read("src/actor-scope.mjs");
  const template = read("templates/manager.hbs");

  for (const marker of [
    "buildActorFolderOptions", "groupActorRows", "includeSubfolders",
    "selectionMode", "selectActorGroup", "bulkActorAction"
  ]) assert.match(source, new RegExp(marker));
  assert.match(scope, /actorFolderPath/);
  assert.match(scope, /new RegExp/);

  for (const marker of [
    'data-gag-filter="searchMode"', 'data-gag-filter="folderId"',
    'data-gag-filter="includeSubfolders"', 'data-gag-filter="actorType"',
    'data-gag-filter="selectionMode"', 'data-action="selectActorGroup"',
    'data-action="bulkActorAction"'
  ]) assert.match(template, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("Scene classification stores four validated ratings and derives profile defaults", async () => {
  globalThis.game = {
    user: { id: "gm", isGM: true, role: 4 },
    i18n: { localize: (key) => key, format: (key) => key },
    settings: { get: () => ({ roleMinimums: {}, userOverrides: {} }) }
  };
  globalThis.CONST = { USER_ROLES: { GAMEMASTER: 4 } };
  globalThis.Hooks = { callAll() {} };
  globalThis.foundry = {
    utils: {
      mergeObject: (left, right) => structuredClone({ ...left, ...right }),
      deepClone: structuredClone
    }
  };
  globalThis.canvas = { scene: null };

  const { ContextService, deriveLevelRatings, normalizeLevelRatings } = await import(`../garb-and-grime/src/context-service.mjs?feature=${Date.now()}`);
  assert.deepEqual(deriveLevelRatings({ min: 0, max: 0 }), ["expected", "accepted", "disliked", "hated"]);
  assert.deepEqual(deriveLevelRatings({ min: 2, max: 2 }), ["disliked", "accepted", "expected", "accepted"]);
  assert.deepEqual(normalizeLevelRatings(["expected", "accepted", "tolerated", "hated"]), ["expected", "accepted", "tolerated", "hated"]);
  assert.equal(normalizeLevelRatings(["expected", "invalid", "tolerated", "hated"]), null);

  let stored = null;
  const scene = {
    getFlag: () => stored,
    async setFlag(_module, _key, value) { stored = structuredClone(value); return value; }
  };
  const profile = { id: "ordinary", expected: { min: 1, max: 1 }, levelRatings: ["accepted", "expected", "accepted", "disliked"] };
  const registry = {
    getEnvironmentProfile: (id) => id === "ordinary" ? profile : null
  };
  const service = new ContextService(registry);
  await service.setSceneContext(scene, "ordinary", {
    useProfileDefaults: false,
    levelRatings: ["hated", "disliked", "accepted", "expected"]
  });
  assert.deepEqual(service.getLevelRatings(scene), ["hated", "disliked", "accepted", "expected"]);
  await service.setSceneLevelRatings(scene, null, { useProfileDefaults: true });
  assert.deepEqual(service.getLevelRatings(scene), profile.levelRatings);
});

test("GM Scene guide is optional, movable, persistent, and purely advisory", () => {
  const main = read("scripts/main.mjs");
  const guide = read("src/apps/scene-guide.mjs");
  const template = read("templates/scene-guide.hbs");
  const context = read("src/context-service.mjs");

  assert.match(guide, /extends PersistentApplication/);
  assert.match(guide, /resizable:\s*true/);
  assert.match(guide, /SCENE_GUIDE_VISIBLE/);
  assert.match(template, /each rows/);
  assert.match(template, /gag-scene-rating__status/);
  assert.match(main, /openSceneGuide/);
  assert.match(main, /getSceneLevelRatings/);
  assert.match(main, /setSceneLevelRatings/);
  assert.doesNotMatch(context, /stateService|adjustDirt|cleanActor|ActiveEffect|ChatMessage/);
});
