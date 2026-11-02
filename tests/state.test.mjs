import assert from "node:assert/strict";
import test from "node:test";

import {
  adjustStateDirt,
  applyCleaningEffect,
  getDefaultState,
  normalizeState,
  setStateDirt
} from "../src/domain/state.mjs";

test("water reduces body and clothing by exactly one level", () => {
  const dirty = setStateDirt(getDefaultState(), 3);
  const cleaned = applyCleaningEffect(dirty, { mode: "reduce", amount: 1, body: true, clothing: true });
  assert.equal(cleaned.body.level, 2);
  assert.equal(cleaned.clothing.level, 2);
  assert.equal(cleaned.dirtLevel, 2);
});

test("soap fully cleans body and clothing", () => {
  const dirty = setStateDirt(getDefaultState(), 3);
  const cleaned = applyCleaningEffect(dirty, { mode: "set", level: 0, body: true, clothing: true });
  assert.equal(cleaned.body.level, 0);
  assert.equal(cleaned.clothing.level, 0);
  assert.equal(cleaned.dirtLevel, 0);
});

test("spare clothing does not remove body odor", () => {
  const dirty = setStateDirt(getDefaultState(), 2);
  const changed = applyCleaningEffect(dirty, { mode: "set", level: 0, body: false, clothing: true });
  assert.equal(changed.body.level, 2);
  assert.equal(changed.clothing.level, 0);
  assert.equal(changed.clothing.clean, true);
  assert.equal(changed.body.clean, false);
  assert.equal(changed.dirtLevel, 2);
});

test("dirt is clamped and part-specific changes derive the overall level", () => {
  const state = setStateDirt(getDefaultState(), 2);
  const bodyOnly = adjustStateDirt(state, 9, { body: true, clothing: false });
  assert.equal(bodyOnly.body.level, 3);
  assert.equal(bodyOnly.clothing.level, 2);
  assert.equal(bodyOnly.dirtLevel, 3);
  const clothingOnly = setStateDirt(bodyOnly, 0, { body: false, clothing: true });
  assert.equal(clothingOnly.body.level, 3);
  assert.equal(clothingOnly.clothing.level, 0);
  assert.equal(clothingOnly.dirtLevel, 3);
});

test("malformed legacy state recovers without throwing", () => {
  const state = normalizeState({
    schema: -1,
    dirtLevel: "not-a-number",
    body: { level: 99 },
    clothing: null,
    contaminations: [null, { id: "blood" }],
    gmNotes: 123,
    maintenanceDebt: -5
  });
  assert.equal(state.schema, 1);
  assert.equal(state.body.level, 3);
  assert.equal(state.clothing.level, 0);
  assert.equal(state.dirtLevel, 3);
  assert.deepEqual(state.contaminations, [{ id: "blood" }]);
  assert.equal(state.gmNotes, "");
  assert.equal(state.maintenanceDebt, 0);
});
