// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import { MODULE_ID, PERMISSIONS } from "../constants.mjs";
import { canModifyActor, hasPermission } from "../permissions.mjs";
import { getRootElement, mapWithConcurrency, selectedActorDirectoryActors } from "../util.mjs";

/**
 * Register redundant, highly visible launchers in the Actor and Settings sidebars.
 * Use only the semantic sidebar hooks so unrelated ApplicationV2 windows are never
 * inspected or modified.
 */
export function registerSidebarLauncher({ openManager, openSettings, stateService }) {
  const render = (app, html) => {
    const root = getRootElement(html) ?? getRootElement(app?.element);
    if (!root) return;

    if (isActorDirectory(app, root)) injectActorDirectoryLauncher(root, { openManager, stateService });
    if (isSettingsSidebar(app, root)) injectSettingsLauncher(root, { openManager, openSettings });
  };

  Hooks.on("renderActorDirectory", render);
  Hooks.on("renderSettings", render);
}

function isActorDirectory(app, root) {
  const name = String(app?.constructor?.name ?? "");
  const tabName = String(app?.tabName ?? app?.options?.tabName ?? "");
  const collectionDocumentName = String(app?.collection?.documentName ?? app?.documents?.documentName ?? "");
  return name === "ActorDirectory"
    || tabName === "actors"
    || collectionDocumentName === "Actor"
    || root.id === "actors"
    || root.matches?.("[data-tab-name='actors']");
}

function isSettingsSidebar(app, root) {
  const name = String(app?.constructor?.name ?? "");
  const tabName = String(app?.tabName ?? app?.options?.tabName ?? "");
  const id = String(app?.id ?? app?.options?.id ?? root.id ?? "");
  return name === "Settings"
    || tabName === "settings"
    || id === "settings"
    || root.matches?.("[data-tab-name='settings']");
}

function injectActorDirectoryLauncher(root, { openManager, stateService }) {
  if (root.querySelector("[data-gag-actor-directory-launcher]")) return;

  const card = document.createElement("section");
  card.className = "gag-sidebar-card";
  card.dataset.gagActorDirectoryLauncher = "true";
  card.innerHTML = `
    <div class="gag-sidebar-card__heading">
      <i class="fa-solid fa-shirt" aria-hidden="true"></i>
      <strong>${escape(game.i18n.localize("GAG.Launchers.Title"))}</strong>
    </div>
    <p>${escape(game.i18n.localize("GAG.Launchers.ActorDirectoryHint"))}</p>
    <div class="gag-sidebar-card__actions">
      <button type="button" data-gag-open-manager>
        <i class="fa-solid fa-shirt" aria-hidden="true"></i>
        <span>${escape(game.i18n.localize("GAG.Manager.Open"))}</span>
      </button>
      ${game.user.isGM || hasPermission(PERMISSIONS.MODIFY_OTHERS) ? `<div class="gag-sidebar-card__bulk" role="group" aria-label="${escape(game.i18n.localize("GAG.Launchers.SelectedActorsActions"))}">
        <button type="button" data-gag-directory-adjust="1" title="${escape(game.i18n.localize("GAG.Actions.IncreaseSelected"))}"><i class="fa-solid fa-plus" aria-hidden="true"></i><span>${escape(game.i18n.localize("GAG.Actions.IncreaseSelected"))}</span></button>
        <button type="button" data-gag-directory-adjust="-1" title="${escape(game.i18n.localize("GAG.Actions.ReduceSelected"))}"><i class="fa-solid fa-minus" aria-hidden="true"></i><span>${escape(game.i18n.localize("GAG.Actions.ReduceSelected"))}</span></button>
      </div>` : ""}
    </div>`;
  card.querySelector("[data-gag-open-manager]")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openManager();
  });
  card.querySelectorAll("[data-gag-directory-adjust]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      try {
        const actors = selectedActorDirectoryActors(root).filter((actor) => canModifyActor(actor));
        if (!actors.length) return ui.notifications.warn(game.i18n.localize("GAG.Notifications.SelectActors"));
        const amount = Number(button.dataset.gagDirectoryAdjust);
        await mapWithConcurrency(actors, (actor) => stateService.adjustDirt(actor, amount, { reason: game.i18n.localize("GAG.Actions.BulkAdjustment") }));
        ui.notifications.info(game.i18n.format("GAG.Notifications.BulkActorsAdjusted", { count: actors.length, amount: amount > 0 ? `+${amount}` : String(amount) }));
      } catch (error) {
        console.error(`[${MODULE_ID}] Actor-directory bulk action failed.`, error);
        ui.notifications.error(error?.message ?? game.i18n.localize("GAG.Errors.Unexpected"));
      }
    });
  });

  insertSidebarCard(root, card);
}

function injectSettingsLauncher(root, { openManager, openSettings }) {
  if (root.querySelector("[data-gag-settings-sidebar-launcher]")) return;

  const card = document.createElement("section");
  card.className = "gag-sidebar-card gag-sidebar-card--prominent";
  card.dataset.gagSettingsSidebarLauncher = "true";
  card.innerHTML = `
    <div class="gag-sidebar-card__heading">
      <i class="fa-solid fa-shirt" aria-hidden="true"></i>
      <strong>${escape(game.i18n.localize("GAG.Launchers.Title"))}</strong>
    </div>
    <p>${escape(game.i18n.localize("GAG.Launchers.SettingsHint"))}</p>
    <div class="gag-sidebar-card__actions">
      <button type="button" data-gag-open-manager>
        <i class="fa-solid fa-users-viewfinder" aria-hidden="true"></i>
        <span>${escape(game.i18n.localize("GAG.Settings.OpenManager.Label"))}</span>
      </button>
      ${game.user.isGM ? `<button type="button" data-gag-open-settings>
        <i class="fa-solid fa-sliders" aria-hidden="true"></i>
        <span>${escape(game.i18n.localize("GAG.Settings.ConfigurationHub.Label"))}</span>
      </button>` : ""}
    </div>`;

  card.querySelector("[data-gag-open-manager]")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openManager();
  });
  card.querySelector("[data-gag-open-settings]")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openSettings();
  });

  const target = root.querySelector(".settings-sidebar")
    ?? root.querySelector(".scrollable")
    ?? root.querySelector(".tab[data-tab='settings']")
    ?? root.querySelector(".sidebar-tab")
    ?? root;
  target.prepend(card);
}

function insertSidebarCard(root, card) {
  const header = root.querySelector(".directory-header");
  if (header) {
    header.insertAdjacentElement("afterend", card);
    return;
  }
  const list = root.querySelector(".directory-list") ?? root.querySelector(".directory-items");
  if (list) {
    list.insertAdjacentElement("beforebegin", card);
    return;
  }
  root.prepend(card);
}

function escape(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}
