import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const moduleRoot = path.resolve(here, "..");

function setupGlobals() {
  globalThis.game = {
    user: { id: "gm", isGM: true, role: 4 },
    i18n: {
      localize: (key) => key,
      format: (key, data = {}) => `${key}:${JSON.stringify(data)}`
    },
    settings: { get: () => ({ roleMinimums: {}, userOverrides: {} }) }
  };
  globalThis.CONST = { USER_ROLES: { GAMEMASTER: 4 } };
  globalThis.Hooks = { callAll() {} };
  globalThis.canvas = { scene: null };
  globalThis.ui = { notifications: { info() {}, error() {} } };
  globalThis.foundry = {
    utils: {
      deepClone: structuredClone,
      escapeHTML: (value) => String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;"),
      mergeObject: (left, right) => structuredClone({ ...(left ?? {}), ...(right ?? {}) })
    },
    applications: { api: { DialogV2: { wait: async () => null } } }
  };
}

function registry(profiles = [
  { id: "ordinary", nameKey: "ordinary", expected: { min: 0, max: 2 }, levelRatings: ["accepted", "expected", "tolerated", "disliked"] },
  { id: "clean", nameKey: "clean", expected: { min: 0, max: 1 }, levelRatings: ["expected", "accepted", "disliked", "hated"] }
]) {
  return {
    listEnvironmentProfiles: () => profiles,
    getEnvironmentProfile: (id) => profiles.find((profile) => profile.id === id) ?? null
  };
}

function sceneWith(initial = null, { failWrite = false } = {}) {
  let stored = initial === null ? null : structuredClone(initial);
  let writes = 0;
  return {
    id: "scene-1",
    name: "Test Scene",
    getFlag: () => stored,
    async setFlag(_module, _key, value) {
      writes += 1;
      if (failWrite) throw new Error("storage failed");
      stored = structuredClone(value);
      return value;
    },
    inspect: () => ({ stored: structuredClone(stored), writes })
  };
}

function fakeButton(values) {
  const elements = new Map(Object.entries(values).map(([name, value]) => [name, typeof value === "boolean" ? { checked: value } : { value }]));
  return { form: { elements: { namedItem: (name) => elements.get(name) ?? null } } };
}

test("Scene Context fresh Scene defaults deterministically and never passes undefined", async () => {
  setupGlobals();
  const { ContextService } = await import(`../src/context-service.mjs?fresh=${Date.now()}`);
  const service = new ContextService(registry());
  const scene = sceneWith();
  const status = service.getSceneContextStatus(scene);
  assert.equal(status.status, "unset");
  assert.equal(status.context.id, "ordinary");
  assert.equal(scene.inspect().writes, 0, "reading a fresh Scene must not migrate or write flags");
  await service.setSceneContext(scene, "ordinary");
  assert.equal(scene.inspect().stored.id, "ordinary");
});

test("stale Scene profile remains visible as stale until the GM explicitly replaces it", async () => {
  setupGlobals();
  const { ContextService } = await import(`../src/context-service.mjs?stale=${Date.now()}`);
  const service = new ContextService(registry());
  const scene = sceneWith({
    id: "deleted-profile",
    overrides: { old: true },
    levelRatings: ["hated", "disliked", "accepted", "expected"],
    futureField: { preserve: true }
  });
  const status = service.getSceneContextStatus(scene);
  assert.equal(status.status, "stale");
  assert.equal(status.staleProfileId, "deleted-profile");
  assert.equal(status.context.id, "ordinary", "mechanics retain a safe deterministic fallback");
  assert.equal(scene.inspect().writes, 0, "stale references are not silently remapped");

  await service.setSceneContext(scene, "clean", {
    useProfileDefaults: false,
    levelRatings: ["expected", "accepted", "disliked", "hated"]
  });
  assert.equal(scene.inspect().stored.id, "clean");
  assert.deepEqual(scene.inspect().stored.futureField, { preserve: true }, "unrelated Scene Context fields survive replacement");
});

test("Scene Context validation distinguishes missing selection, unavailable registry, invalid Scene, and persistence failure", async () => {
  setupGlobals();
  const { ContextService, SceneContextError } = await import(`../src/context-service.mjs?errors=${Date.now()}`);
  const service = new ContextService(registry());
  const scene = sceneWith();

  await assert.rejects(() => service.setSceneContext(scene, undefined), (error) => error instanceof SceneContextError && error.code === "selection-missing");
  await assert.rejects(() => service.setSceneContext(null, "ordinary"), (error) => error instanceof SceneContextError && error.code === "scene-invalid");
  await assert.rejects(
    () => new ContextService(registry([])).setSceneContext(scene, "ordinary"),
    (error) => error instanceof SceneContextError && error.code === "registry-unavailable"
  );
  await assert.rejects(
    () => service.setSceneContext(sceneWith(null, { failWrite: true }), "ordinary"),
    (error) => error instanceof SceneContextError && error.code === "persistence-failed" && error.cause?.message === "storage failed"
  );
});

test("Foundry V13 Scene Context dialog reads the owning DialogV2 form and survives cancel/reopen", async () => {
  setupGlobals();
  const serviceModule = await import(`../src/context-service.mjs?dialog-service=${Date.now()}`);
  const dialogModule = await import(`../src/apps/scene-context-dialog.mjs?dialog=${Date.now()}`);
  const source = fs.readFileSync(path.join(moduleRoot, "src/apps/scene-context-dialog.mjs"), "utf8");
  assert.doesNotMatch(source, /<form class="gag-dialog-form gag-context-dialog"/);
  assert.match(source, /button\?\.form\?\.elements/);

  const profiles = registry();
  const contextService = new serviceModule.ContextService(profiles);
  const scene = sceneWith();
  const services = { registry: profiles, contextService };
  let calls = 0;
  foundry.applications.api.DialogV2.wait = async (config) => {
    calls += 1;
    if (calls === 1) return null;
    return config.buttons[0].callback(null, fakeButton({
      contextId: "ordinary",
      useProfileDefaults: true,
      "rating.0": "accepted",
      "rating.1": "expected",
      "rating.2": "tolerated",
      "rating.3": "disliked"
    }));
  };

  assert.equal(await dialogModule.openSceneContextDialog(services, scene), null);
  assert.equal(scene.inspect().writes, 0);
  const result = await dialogModule.openSceneContextDialog(services, scene);
  assert.equal(result.contextId, "ordinary");
  assert.equal(scene.inspect().stored.id, "ordinary");
});

test("stale profile is shown as unavailable in the dialog and is not rewritten before Save", async () => {
  setupGlobals();
  const serviceModule = await import(`../src/context-service.mjs?dialog-stale-service=${Date.now()}`);
  const dialogModule = await import(`../src/apps/scene-context-dialog.mjs?dialog-stale=${Date.now()}`);
  const profiles = registry();
  const contextService = new serviceModule.ContextService(profiles);
  const scene = sceneWith({ id: "removed-profile", futureField: 42 });
  const services = { registry: profiles, contextService };
  let capturedContent = "";
  foundry.applications.api.DialogV2.wait = async (config) => {
    capturedContent = config.content;
    assert.equal(scene.inspect().writes, 0, "opening a stale Scene must not auto-migrate it");
    return config.buttons[0].callback(null, fakeButton({
      contextId: "clean",
      useProfileDefaults: true,
      "rating.0": "expected",
      "rating.1": "accepted",
      "rating.2": "disliked",
      "rating.3": "hated"
    }));
  };
  await dialogModule.openSceneContextDialog(services, scene);
  assert.match(capturedContent, /removed-profile/);
  assert.equal(scene.inspect().stored.id, "clean");
  assert.equal(scene.inspect().stored.futureField, 42);
});
