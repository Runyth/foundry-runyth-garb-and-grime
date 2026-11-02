import assert from "node:assert/strict";
import test from "node:test";

import { DefinitionRegistry } from "../src/registry.mjs";

test("registry contains required built-in definitions", () => {
  const registry = new DefinitionRegistry();
  assert.equal(registry.getCleaningMethod("water").effect.amount, 1);
  assert.equal(registry.getCleaningMethod("soap").cost.currency, "Mark");
  assert.equal(registry.getEnvironmentProfile("sewer").automaticDirtGain, 2);
  assert.equal(registry.getContamination("blood").effectivePenalty, 1);
});

test("returned definitions cannot mutate registry state", () => {
  const registry = new DefinitionRegistry();
  const method = registry.getCleaningMethod("water");
  method.effect.amount = 3;
  assert.equal(registry.getCleaningMethod("water").effect.amount, 1);
});

test("extension definitions require stable ids and reject duplicates", () => {
  const registry = new DefinitionRegistry();
  registry.registerCleaningMethod({
    id: "custom-rinse",
    name: "Custom rinse",
    cost: { amount: 0, currency: "Mark" },
    time: { value: 10, unit: "minute" },
    effect: { mode: "reduce", amount: 1, body: true, clothing: true }
  });
  assert.throws(() => registry.registerCleaningMethod({
    id: "custom-rinse",
    name: "Duplicate",
    cost: { amount: 0, currency: "Mark" },
    effect: { mode: "set", level: 0 }
  }));
  assert.throws(() => registry.registerContamination({ id: "Bad ID", name: "Bad" }));
});

test("currency adapters require the complete contract", () => {
  const registry = new DefinitionRegistry();
  assert.throws(() => registry.registerCurrencyAdapter({ id: "broken" }));
  const adapter = {
    id: "marks",
    async getBalance() { return 10; },
    async canAfford(actor, amount) { return amount <= 10; },
    async deduct(actor, amount) { return { success: true, deducted: true, balance: 10 - amount }; }
  };
  registry.registerCurrencyAdapter(adapter);
  assert.equal(registry.getCurrencyAdapter("marks"), adapter);
});

test("extension definitions survive world-definition reloads", () => {
  const registry = new DefinitionRegistry();
  registry.registerContamination({ id: "custom-smoke", name: "Smoke", effectivePenalty: 0, scent: true });
  registry.resetDefinitions();
  registry.replaceWorldDefinitions({ profiles: [{ id: "custom-district", name: "District", expected: { min: 0, max: 3 } }] });
  assert.equal(registry.getContamination("custom-smoke").source, "extension");
  assert.equal(registry.getEnvironmentProfile("custom-district").source, "world");
});
