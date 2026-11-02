// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import { FLAGS, MODULE_ID } from "./constants.mjs";
import { getConfiguration } from "./settings.mjs";

const ICONS = {
  1: `modules/${MODULE_ID}/assets/icons/worn.svg`,
  2: `modules/${MODULE_ID}/assets/icons/dirty.svg`,
  3: `modules/${MODULE_ID}/assets/icons/stinking.svg`,
  groomed: `modules/${MODULE_ID}/assets/icons/groomed.svg`,
  mixed: `modules/${MODULE_ID}/assets/icons/clothing-clean.svg`
};

/**
 * Reconcile module-owned Active Effects without deleting and recreating every
 * effect after each state change. The Actor flag remains the source of truth.
 */
export async function syncEffects(actor, state, registry) {
  const configuration = getConfiguration().effects;
  const existing = actor.effects.filter((effect) => effect.getFlag(MODULE_ID, FLAGS.EFFECT_KIND));
  const desired = configuration.enabled ? buildDesiredEffects(state, registry, configuration) : [];

  const existingByKind = new Map();
  const staleIds = [];
  for (const effect of existing) {
    const kind = effect.getFlag(MODULE_ID, FLAGS.EFFECT_KIND);
    if (!kind || existingByKind.has(kind)) staleIds.push(effect.id);
    else existingByKind.set(kind, effect);
  }

  const creates = [];
  const updates = [];
  for (const data of desired) {
    const kind = data.flags[MODULE_ID][FLAGS.EFFECT_KIND];
    const effect = existingByKind.get(kind);
    if (!effect) {
      creates.push(data);
      continue;
    }
    existingByKind.delete(kind);
    const update = effectUpdate(effect, data);
    if (update) updates.push({ _id: effect.id, ...update });
  }

  staleIds.push(...[...existingByKind.values()].map((effect) => effect.id));
  if (staleIds.length) await actor.deleteEmbeddedDocuments("ActiveEffect", staleIds, { garbAndGrime: true });
  if (updates.length) await actor.updateEmbeddedDocuments("ActiveEffect", updates, { garbAndGrime: true });
  if (creates.length) await actor.createEmbeddedDocuments("ActiveEffect", creates, { garbAndGrime: true });
}

function buildDesiredEffects(state, registry, configuration) {
  const effects = [];
  if (state.dirtLevel > 0) {
    effects.push(effectData(`GAG.Levels.${state.dirtLevel}.Name`, ICONS[state.dirtLevel], `dirt-${state.dirtLevel}`));
  }
  if (state.clothing.clean && !state.body.clean) {
    effects.push(effectData("GAG.Effects.CleanClothesDirtyBody", ICONS.mixed, "mixed-cleanliness"));
  }
  if (state.groomedUntil && Number(state.groomedUntil) > Date.now()) {
    const expiresAt = Number(state.groomedUntil);
    const seconds = Math.max(1, Math.floor((expiresAt - Date.now()) / 1000));
    effects.push(effectData("GAG.Effects.Groomed", ICONS.groomed, "groomed", { seconds, expiresAt }));
  }
  if (configuration.includeContaminations) {
    for (const entry of state.contaminations) {
      // Active Effects are visible Actor documents. Never mirror a hidden
      // contamination into a player-visible effect.
      if (entry.hidden) continue;
      const definition = registry.getContamination(entry.id, { clone: false });
      if (!definition?.createEffect) continue;
      effects.push(effectData(
        definition.nameKey ?? definition.name,
        normalizeAssetPath(definition.icon ?? "assets/icons/chemical.svg"),
        `contamination-${entry.id}`
      ));
    }
  }
  return effects;
}

function effectData(nameKeyOrName, icon, kind, duration = null) {
  const moduleFlags = { [FLAGS.EFFECT_KIND]: kind };
  if (duration?.expiresAt) moduleFlags.expiresAt = duration.expiresAt;
  return {
    name: nameKeyOrName.includes(".") ? game.i18n.localize(nameKeyOrName) : nameKeyOrName,
    img: icon,
    disabled: false,
    changes: [],
    duration: duration?.seconds ? { seconds: duration.seconds, startTime: game.time.worldTime } : {},
    flags: { [MODULE_ID]: moduleFlags }
  };
}

function effectUpdate(effect, desired) {
  const update = {};
  if (effect.name !== desired.name) update.name = desired.name;
  if (effect.img !== desired.img) update.img = desired.img;
  if (Boolean(effect.disabled) !== Boolean(desired.disabled)) update.disabled = desired.disabled;
  if (!sameValue(effect.changes ?? [], desired.changes ?? [])) update.changes = desired.changes;

  const desiredFlags = desired.flags[MODULE_ID];
  const currentExpiresAt = effect.getFlag(MODULE_ID, "expiresAt") ?? null;
  const desiredExpiresAt = desiredFlags.expiresAt ?? null;
  if (currentExpiresAt !== desiredExpiresAt) {
    update.flags = { [MODULE_ID]: desiredFlags };
    update.duration = desired.duration;
  }
  return Object.keys(update).length ? update : null;
}

function normalizeAssetPath(path) {
  const value = String(path ?? "").trim();
  if (/^(?:\/|https?:|data:|modules\/|systems\/|worlds\/|icons\/)/i.test(value)) return value;
  return `modules/${MODULE_ID}/${value}`;
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
