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

test("disabled permissions and per-user overrides are enforced", async () => {
  let permissionSetting = {
    roleMinimums: { viewOwn: 5, viewGmDetails: 5 },
    userOverrides: {}
  };
  globalThis.foundry = { utils: { deepClone: structuredClone, mergeObject } };
  globalThis.game = {
    user: { id: "player-1", role: 1, isGM: false },
    settings: { get: () => permissionSetting },
    i18n: { localize: (key) => key }
  };
  const actor = {
    testUserPermission: () => true,
    getFlag: () => ({
      dirtLevel: 2,
      body: { level: 2 },
      clothing: { level: 2 },
      contaminations: [
        { id: "mud", hidden: false },
        { id: "secret-decay", hidden: true }
      ],
      gmNotes: "Hidden note"
    })
  };

  const { hasPermission } = await import(`../garb-and-grime/src/permissions.mjs?permissions=${Date.now()}`);
  const { StateService } = await import(`../garb-and-grime/src/state-service.mjs?permissions=${Date.now()}`);

  assert.equal(hasPermission("viewOwn", { actor }), false);
  permissionSetting = {
    roleMinimums: { viewOwn: 5, viewGmDetails: 5 },
    userOverrides: { "player-1": { viewOwn: true } }
  };
  assert.equal(hasPermission("viewOwn", { actor }), true);

  const service = new StateService({});
  const publicState = service.getState(actor, { includeHidden: true });
  assert.equal(publicState.gmNotes, "");
  assert.deepEqual(publicState.contaminations.map((entry) => entry.id), ["mud"]);

  permissionSetting.userOverrides["player-1"].viewGmDetails = true;
  const privilegedState = service.getState(actor, { includeHidden: true });
  assert.equal(privilegedState.gmNotes, "Hidden note");
  assert.deepEqual(privilegedState.contaminations.map((entry) => entry.id), ["mud", "secret-decay"]);
});
