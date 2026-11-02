import assert from "node:assert/strict";
import test from "node:test";

import { evaluateRoll, effectiveDirtLevel } from "../src/domain/rules.mjs";
import { getDefaultState, setStateDirt } from "../src/domain/state.mjs";

const clean = { id: "clean", social: { level2: "disadvantage-social", level3: "entry-refusal-or-disadvantage" }, tracking: {} };
const lawless = { id: "poor-lawless", social: { level0: "possible-disadvantage-blend", level2: "possible-advantage-blend" }, tracking: {} };

test("clean context advises disadvantage for dirty social rolls", () => {
  const result = evaluateRoll({ state: setStateDirt(getDefaultState(), 2), profile: clean, skillId: "per" });
  assert.equal(result.mode, "disadvantage");
  assert.equal(result.reasonKey, "GAG.RollAdvice.DirtyCleanContext");
});

test("lawless context can reward appropriate grime", () => {
  const result = evaluateRoll({ state: setStateDirt(getDefaultState(), 2), profile: lawless, skillId: "dec" });
  assert.equal(result.mode, "possible-advantage");
});

test("intimidation is not blanket-penalized", () => {
  const result = evaluateRoll({ state: setStateDirt(getDefaultState(), 2), profile: clean, skillId: "itm" });
  assert.equal(result.mode, "normal");
});

test("level three can block scent stealth", () => {
  const profile = { id: "wilderness", social: {}, tracking: { level3: "scent-stealth-impossible" } };
  const result = evaluateRoll({ state: setStateDirt(getDefaultState(), 3), profile, skillId: "ste", enhancedSmell: true });
  assert.equal(result.mode, "blocked");
  assert.equal(result.blocksScentStealth, true);
});

test("contamination counts as one effective level and masking suppresses it", () => {
  const definitions = [{ id: "blood", effectivePenalty: 1 }];
  const state = setStateDirt(getDefaultState(), 1);
  state.contaminations.push({ id: "blood" });
  assert.equal(effectiveDirtLevel(state, definitions), 2);
  state.masking.push({ id: "perfume", expiresAt: Date.now() + 60000 });
  assert.equal(effectiveDirtLevel(state, definitions), 1);
});

test("custom profile rules are evaluated by level", () => {
  const profile = { id: "custom-court", social: { level1: "possible-disadvantage" }, tracking: {} };
  const result = evaluateRoll({ state: setStateDirt(getDefaultState(), 1), profile, skillId: "prf" });
  assert.equal(result.mode, "possible-disadvantage");
  assert.equal(result.configuredRule, "possible-disadvantage");
});
