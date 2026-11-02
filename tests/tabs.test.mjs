import assert from "node:assert/strict";
import test from "node:test";

test("manager and settings tabs switch through module actions without calling ApplicationV2.changeTab", async () => {
  class MockApplicationV2 {
    render(options) {
      this.lastRenderOptions = options;
      return this;
    }
  }

  globalThis.foundry = {
    applications: {
      api: {
        ApplicationV2: MockApplicationV2,
        HandlebarsApplicationMixin: (Base) => class extends Base {}
      }
    },
    utils: {
      deepClone: structuredClone,
      mergeObject(original, other, { inplace = true } = {}) {
        return Object.assign(inplace ? original : structuredClone(original), structuredClone(other));
      }
    }
  };

  let uiState = { activeTab: "overview", search: "", level: "all", sort: "name", direction: "asc" };
  globalThis.game = {
    settings: {
      get() {
        return structuredClone(uiState);
      },
      async set(moduleId, key, value) {
        uiState = structuredClone(value);
        return value;
      }
    }
  };

  const nonce = Date.now();
  const { CleanlinessManager } = await import(`../src/apps/manager.mjs?tabs=${nonce}`);
  const { GarbAndGrimeSettings } = await import(`../src/apps/settings-hub.mjs?tabs=${nonce}`);

  assert.equal(CleanlinessManager.DEFAULT_OPTIONS.actions.tab, undefined);
  assert.equal(GarbAndGrimeSettings.DEFAULT_OPTIONS.actions.tab, undefined);
  assert.equal(typeof CleanlinessManager.DEFAULT_OPTIONS.actions.switchTab, "function");
  assert.equal(typeof GarbAndGrimeSettings.DEFAULT_OPTIONS.actions.switchTab, "function");

  let managerPrevented = false;
  const manager = new CleanlinessManager();
  manager.changeTab = () => {
    throw new Error("The reserved ApplicationV2 changeTab method must not be used");
  };
  await CleanlinessManager.DEFAULT_OPTIONS.actions.switchTab.call(
    manager,
    { preventDefault() { managerPrevented = true; } },
    { dataset: { tab: "actors" } }
  );
  assert.equal(managerPrevented, true);
  assert.equal(uiState.activeTab, "actors");
  assert.deepEqual(manager.lastRenderOptions, { force: true });

  let settingsPrevented = false;
  const settings = new GarbAndGrimeSettings();
  settings.changeTab = () => {
    throw new Error("The reserved ApplicationV2 changeTab method must not be used");
  };
  GarbAndGrimeSettings.DEFAULT_OPTIONS.actions.switchTab.call(
    settings,
    { preventDefault() { settingsPrevented = true; } },
    { dataset: { tab: "cleaning" } }
  );
  assert.equal(settingsPrevented, true);
  assert.equal(settings.activeTab, "cleaning");
  assert.deepEqual(settings.lastRenderOptions, { force: true });
});
