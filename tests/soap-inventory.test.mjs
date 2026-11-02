import test from "node:test";
import assert from "node:assert/strict";
import { planSoapRequirement, soapInventoryItems } from "../garb-and-grime/src/soap-inventory.mjs";

const registry = {
  getItemIntegration: () => ({ id: "soap", aliases: ["Soap", "Seife", "Savon"] })
};
function item(id, name, quantity, integration = null) {
  return { id, uuid: `Actor.a.Item.${id}`, name, system: { quantity },
    getFlag() { return integration; } };
}
function actor(items) { return { id: "a", uuid: "Actor.a", type: "character", items }; }

test("soap lookup uses tagged items and exact localized aliases, not partial name matches", () => {
  const candidate = actor([
    item("a", "Soapstone", 20), item("b", "Seife", 2), item("c", "Savon", 1),
    item("d", "Soap", 9, "perfume"), item("e", "Custom packet", 2, "soap"),
    item("f", "Soap", 0)
  ]);
  assert.deepEqual(soapInventoryItems(candidate, registry).map((value) => value.id), ["b", "c", "e", "f"]);
  const plan = planSoapRequirement(candidate, registry, { quantity: 5, consume: true });
  assert.equal(plan.success, true);
  assert.deepEqual(plan.items.map((entry) => [entry.item.id, entry.quantity]), [["b",2],["c",1],["e",2]]);
  assert.equal(plan.available, 5);
});

test("soap planning reuses pre-reserved stock without double-counting", () => {
  const a = item("a", "Soap", 2);
  const plan = planSoapRequirement(actor([a]), registry, { quantity: 2, reserved: [{ item: a, quantity: 1 }] });
  assert.equal(plan.success, true);
  assert.deepEqual(plan.items.map((entry) => entry.quantity), [1]);
});

test("soap quantity enforcement rejects invalid configured quantities", () => {
  for (const quantity of [0, -1, 1.5, Number.NaN, 101]) {
    assert.throws(() => planSoapRequirement(actor([item("a", "Soap", 2)]), registry, { quantity }), RangeError);
  }
});
