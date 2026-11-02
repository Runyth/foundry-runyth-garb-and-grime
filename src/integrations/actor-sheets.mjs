// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import { PERMISSIONS } from "../constants.mjs";
import { canViewActor, hasPermission } from "../permissions.mjs";
import { getConfiguration } from "../settings.mjs";
import { getRootElement, isActorSupported } from "../util.mjs";

/**
 * Add a cleanliness entry point only to genuine Actor sheets.
 *
 * Do not use global Application or header-control hooks here. Advancement,
 * level-up, rest, and roll dialogs may expose an Actor through app.actor or
 * app.document, but they are not Actor sheets and must remain untouched.
 *
 * Tidy 5e is integrated through its documented Actor-sheet render hook and
 * documented sheet-part selectors. Modern Tidy sheets also emit Foundry's
 * renderActorSheetV2 hook; the data attribute guard makes both paths safe and
 * idempotent during Tidy partial renders.
 */
export function registerActorSheetIntegration({ stateService, registry, openActorPanel }) {
  const canShow = (actor) => {
    const configuration = getConfiguration();
    if (!configuration.actorSheets.enabled || !configuration.general.showSheetIndicator) return false;
    if (!isActorSupported(actor, configuration) || !canViewActor(actor)) return false;
    if (!game.user.isGM && (!configuration.actorSheets.playerVisible || !configuration.general.showIndicatorToPlayers)) return false;
    return true;
  };

  const renderIndicator = (app, html) => {
    const actor = resolveSheetActor(app);
    if (!canShow(actor)) return;

    // Prefer the complete application root. Tidy can emit partial render hooks
    // whose HTML fragment does not contain an already-injected indicator.
    const root = getRootElement(app?.element) ?? getRootElement(html);
    if (!root || root.querySelector("[data-gag-sheet-indicator]")) return;

    const button = createIndicator(actor, { stateService, registry, openActorPanel });
    if (isTidySheetRoot(root)) insertIntoTidySheet(root, button);
    else insertIntoFoundrySheet(root, button);
  };

  // These hooks are scoped by Foundry and Tidy to actual Actor sheets.
  Hooks.on("renderActorSheet", renderIndicator);
  Hooks.on("renderActorSheetV2", renderIndicator);
  Hooks.on("tidy5e-sheet.renderActorSheet", renderIndicator);
}

function createIndicator(actor, { stateService, registry, openActorPanel }) {
  const state = stateService.getState(actor, {
    includeHidden: game.user.isGM || hasPermission(PERMISSIONS.VIEW_GM_DETAILS, { actor })
  });
  const contaminationLabels = state.contaminations.map((entry) => {
    const definition = registry.getContamination(entry.id);
    return definition?.nameKey ? game.i18n.localize(definition.nameKey) : definition?.name ?? entry.id;
  });
  const tooltip = game.i18n.format("GAG.SheetIndicator.Tooltip", {
    level: game.i18n.localize(`GAG.Levels.${state.dirtLevel}.Name`),
    body: game.i18n.localize(`GAG.Levels.${state.body.level}.Name`),
    clothing: game.i18n.localize(`GAG.Levels.${state.clothing.level}.Name`),
    contamination: contaminationLabels.join(", ") || game.i18n.localize("GAG.Common.None")
  });

  const button = document.createElement("button");
  button.type = "button";
  button.className = `gag-sheet-indicator gag-level-${state.dirtLevel}`;
  button.dataset.gagSheetIndicator = "true";
  button.title = tooltip;
  button.setAttribute("aria-label", tooltip);
  button.innerHTML = `<i class="fa-solid fa-shirt" aria-hidden="true"></i><span>${escape(game.i18n.localize(`GAG.Levels.${state.dirtLevel}.Name`))}</span><small>${escape(game.i18n.localize("GAG.Common.BodyShort"))} ${state.body.level} · ${escape(game.i18n.localize("GAG.Common.ClothingShort"))} ${state.clothing.level}</small>`;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openActorPanel(actor);
  });
  return button;
}

function resolveSheetActor(app) {
  const actor = app?.actor ?? app?.document;
  return actor?.documentName === "Actor" ? actor : null;
}

function isTidySheetRoot(root) {
  return root.classList?.contains("tidy5e-sheet")
    || Boolean(root.querySelector?.(".tidy5e-sheet, [data-tidy-sheet-part]"));
}

function insertIntoTidySheet(root, button) {
  button.classList.add("gag-sheet-indicator--tidy", "inline-transparent-button");
  button.dataset.tidyRenderScheme = "handlebars";

  // Official Tidy 5e integration points for modern and classic Actor sheets.
  const actorName = root.querySelector('[data-tidy-sheet-part="actor-name"]');
  const nameContainer = root.querySelector('[data-tidy-sheet-part="name-container"]');
  const target = actorName ?? nameContainer;
  if (target) {
    target.insertAdjacentElement("afterend", button);
    return;
  }

  // Graceful fallback for a future Tidy layout: remain inside the primary sheet
  // body rather than touching the application title bar or child dialogs.
  const sheetHeader = root.querySelector(".sheet-header, [data-tidy-sheet-part='header']");
  if (sheetHeader) sheetHeader.append(button);
}

function insertIntoFoundrySheet(root, button) {
  const header = root.querySelector(".window-header")
    ?? root.querySelector(".sheet-header")
    ?? root.querySelector("header");
  if (!header) return;

  // Scope all title-bar CSS to this exact header. Never alter controls in other
  // Foundry or module windows.
  header.classList.add("gag-sheet-header");
  insertBeforeWindowControls(header, button);
}

function insertBeforeWindowControls(header, button) {
  const anchor = header.querySelector(":scope > .window-controls")
    ?? header.querySelector(":scope > [data-action='toggleControls']")
    ?? header.querySelector(":scope > [data-action='close']")
    ?? header.querySelector(":scope > .header-control.close")
    ?? header.querySelector(":scope > .close");
  if (anchor) header.insertBefore(button, anchor);
  else header.append(button);
}

function escape(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}
