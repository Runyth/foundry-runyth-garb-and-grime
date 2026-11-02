import { FLAGS, MODULE_ID } from "./constants.mjs";
import { resolveCleanlinessActor } from "./actor-resolution.mjs";

/** Exact, case-insensitive aliases only; no partial matches such as soapstone. */
export function soapInventoryItems(actor, registry) {
  const source = resolveCleanlinessActor(actor);
  const aliases = new Set(["soap", "seife", ...(registry.getItemIntegration("soap", { clone: false })?.aliases ?? [])]
    .map((alias) => String(alias ?? "").trim().toLocaleLowerCase()).filter(Boolean));
  return [...(source?.items ?? [])].filter((item) => {
    const flagged = item.getFlag?.(MODULE_ID, FLAGS.ITEM_INTEGRATION);
    // An explicit mapping to another integration wins over name heuristics.
    if (flagged) return flagged === "soap";
    return aliases.has(String(item.name ?? "").trim().toLocaleLowerCase());
  });
}

export function itemStock(item) {
  const raw = item.system?.quantity ?? 1;
  const quantity = Number(raw);
  return Number.isSafeInteger(quantity) && quantity > 0 ? quantity : 0;
}

/** Plan across stacks, accounting for quantities already reserved by an Item button. */
export function planSoapRequirement(actor, registry, { quantity = 1, consume = true, reserved = [] } = {}) {
  const needed = Number(quantity);
  if (!Number.isSafeInteger(needed) || needed < 1 || needed > 100) throw new RangeError("Invalid soap requirement quantity");
  const items = soapInventoryItems(actor, registry);
  const stock = items.reduce((sum, item) => sum + itemStock(item), 0);
  if (stock < needed) return { success: false, available: stock, items: [], required: needed };
  if (!consume) return { success: true, available: stock, items: [], required: needed };

  let remaining = needed;
  const selected = [];
  // Pre-reserved soap counts toward the requirement: using Soap from its
  // Item sheet must not consume the same unit twice.
  for (const item of items) {
    const key = item.uuid ?? item.id;
    const already = reserved.find((entry) => (entry.item?.uuid ?? entry.item?.id) === key)?.quantity ?? 0;
    remaining -= Math.min(remaining, already);
  }
  for (const item of items) {
    if (!remaining) break;
    const key = item.uuid ?? item.id;
    const already = reserved.find((entry) => (entry.item?.uuid ?? entry.item?.id) === key)?.quantity ?? 0;
    const take = Math.min(remaining, Math.max(0, itemStock(item) - already));
    if (take) selected.push({ item, quantity: take });
    remaining -= take;
  }
  return { success: remaining === 0, available: stock, items: selected, required: needed };
}
