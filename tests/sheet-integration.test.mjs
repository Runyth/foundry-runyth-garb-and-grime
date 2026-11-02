import assert from "node:assert/strict";
import test from "node:test";

const moduleUrl = new URL("../src/integrations/actor-sheets.mjs", import.meta.url);

test("Actor-sheet integration registers only semantic sheet hooks", async () => {
  const registrations = [];
  globalThis.Hooks = {
    on(name, callback) {
      registrations.push({ name, callback });
    }
  };

  const { registerActorSheetIntegration } = await import(`${moduleUrl.href}?test=${Date.now()}`);
  registerActorSheetIntegration({
    stateService: {},
    registry: {},
    openActorPanel() {}
  });

  assert.deepEqual(registrations.map((entry) => entry.name), [
    "renderActorSheet",
    "renderActorSheetV2",
    "tidy5e-sheet.renderActorSheet"
  ]);
  assert.equal(registrations.some((entry) => entry.name === "renderApplicationV2"), false);
  assert.equal(registrations.some((entry) => entry.name === "renderApplicationV1"), false);
  assert.equal(registrations.some((entry) => entry.name === "getHeaderControlsApplicationV2"), false);
  assert.equal(registrations.some((entry) => entry.name === "getApplicationV1HeaderButtons"), false);
});
