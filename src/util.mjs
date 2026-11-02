// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import { MODULE_ID } from "./constants.mjs";

export function localize(key, data = {}) {
  return game.i18n.format(key, data);
}

export function label(definition) {
  if (!definition) return "";
  return definition.nameKey ? game.i18n.localize(definition.nameKey) : definition.name;
}

export function escapeHtml(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}

export function resolveActor(value) {
  if (!value) return null;
  if (value.documentName === "Actor") return value;
  if (value.actor?.documentName === "Actor") return value.actor;
  if (typeof value === "string") {
    return game.actors.get(value) ?? canvas?.tokens?.get(value)?.actor ?? null;
  }
  return null;
}

export async function resolveActorAsync(value) {
  const direct = resolveActor(value);
  if (direct) return direct;
  if (typeof value === "string" && value.includes(".")) {
    const document = await foundry.utils.fromUuid(value);
    return resolveActor(document);
  }
  return null;
}

export function ownedActors({ includeNpcs = true } = {}) {
  return game.actors.filter((actor) => {
    if (!includeNpcs && actor.type !== "character") return false;
    return game.user.isGM || actor.isOwner;
  });
}

export function selectedActors() {
  return uniqueActors((canvas?.tokens?.controlled ?? []).map((token) => token.actor));
}

export function selectedActorDirectoryActors(root) {
  if (!root?.querySelectorAll) return [];
  const items = new Set(root.querySelectorAll([
    ".directory-item.selected",
    ".directory-item.mds-selected",
    ".directory-item[data-selected='true']",
    ".directory-item[aria-selected='true']"
  ].join(",")));
  for (const checkbox of root.querySelectorAll(".directory-item input[type='checkbox']:checked")) {
    const item = checkbox.closest(".directory-item");
    if (item) items.add(item);
  }
  const actors = [];
  for (const item of items) {
    const id = item.dataset.documentId ?? item.dataset.entryId ?? item.dataset.actorId ?? item.dataset.entityId;
    const uuid = item.dataset.uuid ?? item.dataset.documentUuid;
    const actor = (id ? game.actors.get(id) : null)
      ?? (uuid && foundry.utils.fromUuidSync ? resolveActor(foundry.utils.fromUuidSync(uuid)) : null);
    if (actor) actors.push(actor);
  }
  return uniqueActors(actors);
}

export function uniqueActors(values) {
  const actors = [];
  const seen = new Set();
  for (const actor of values ?? []) {
    if (!actor || actor.documentName !== "Actor" || seen.has(actor.uuid)) continue;
    seen.add(actor.uuid);
    actors.push(actor);
  }
  return actors;
}

export function activeGm() {
  let primary = null;
  for (const user of game.users ?? []) {
    if (!user.active || !user.isGM) continue;
    if (!primary || user.id.localeCompare(primary.id) < 0) primary = user;
  }
  return primary;
}

/**
 * Process independent asynchronous work with a conservative concurrency cap.
 * Foundry document updates remain responsive without flooding the server.
 */
export async function mapWithConcurrency(values, mapper, { concurrency = 4 } = {}) {
  const items = Array.from(values ?? []);
  if (!items.length) return [];
  const results = new Array(items.length);
  let cursor = 0;
  const workerCount = Math.min(items.length, Math.max(1, Math.trunc(Number(concurrency) || 1)));
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

const pendingApplicationRenders = new WeakSet();

/** Coalesce repeated reactive ApplicationV2 renders into one browser frame. */
export function scheduleApplicationRender(app) {
  if (!app || app.rendered === false || pendingApplicationRenders.has(app)) return false;
  pendingApplicationRenders.add(app);
  const callback = () => {
    pendingApplicationRenders.delete(app);
    if (!app || app.rendered === false) return;
    const rendered = app.render({ force: true });
    if (rendered?.catch) void rendered.catch((error) => console.error(`[${MODULE_ID}] Application render failed.`, error));
  };
  if (typeof globalThis.requestAnimationFrame === "function") requestAnimationFrame(callback);
  else queueMicrotask(callback);
  return true;
}

export function notify(level, key, data = {}) {
  const message = localize(key, data);
  const method = ui.notifications[level] ?? ui.notifications.info;
  method.call(ui.notifications, message);
}

export function debug(...args) {
  if (!game.settings?.get(MODULE_ID, "debug")) return;
  console.debug(`[${MODULE_ID}]`, ...args);
}

export function now() {
  return Date.now();
}

export function worldDay() {
  const seconds = Number(game.time?.worldTime ?? 0);
  return Math.floor(seconds / 86400);
}

export function isActorSupported(actor, configuration) {
  return actor?.documentName === "Actor" && configuration.general.supportedActorTypes.includes(actor.type);
}

export function actorDisplayName(actor) {
  return actor?.name || game.i18n.localize("GAG.Common.UnknownActor");
}

export function getRootElement(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  return null;
}

export function parseJsonSetting(value, fallback) {
  try {
    if (typeof value === "string") return JSON.parse(value);
    return foundry.utils.deepClone(value ?? fallback);
  } catch {
    return foundry.utils.deepClone(fallback);
  }
}
