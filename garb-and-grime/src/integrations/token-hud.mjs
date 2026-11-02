import { getConfiguration } from "../settings.mjs";
import { canModifyActor, canViewActor } from "../permissions.mjs";
import { getRootElement } from "../util.mjs";

export function registerTokenHudIntegration(services) {
  const render = (hud, html) => {
    const configuration = getConfiguration();
    if (!configuration.tokenHud.enabled) return;

    const token = resolveHudToken(hud);
    const actor = token?.actor ?? resolveHudActor(hud);
    if (!actor || !canViewActor(actor)) return;

    const root = getRootElement(html) ?? getRootElement(hud?.element);
    if (!root || root.querySelector("[data-gag-token-hud]")) return;

    const column = root.querySelector(".col.right")
      ?? root.querySelector("[data-side='right']")
      ?? root.querySelector(".right")
      ?? root.querySelector(".col.left")
      ?? root.querySelector("[data-side='left']")
      ?? root;

    const wrapper = document.createElement("div");
    wrapper.className = "control-icon gag-token-hud";
    wrapper.dataset.gagTokenHud = "true";
    wrapper.title = game.i18n.localize("GAG.TokenHud.Tooltip");
    wrapper.setAttribute("role", "button");
    wrapper.setAttribute("tabindex", "0");
    wrapper.setAttribute("aria-label", game.i18n.localize("GAG.TokenHud.Tooltip"));
    wrapper.innerHTML = `<i class="fa-solid fa-shirt" aria-hidden="true"></i>`;

    const menu = document.createElement("div");
    menu.className = "gag-token-menu";
    menu.hidden = true;
    menu.innerHTML = tokenMenuHtml(
      actor,
      canModifyActor(actor),
      game.user.isGM,
      configuration.tokenHud.showQuickActions,
      token ? services.tokenLabelService.getTokenMode(token) : "inherit",
      token ? services.tokenLabelService.getTokenPosition(token) : "inherit"
    );
    wrapper.append(menu);

    const toggleMenu = (event) => {
      if (event.target.closest("button")) return;
      if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      menu.hidden = !menu.hidden;
    };
    wrapper.addEventListener("click", toggleMenu);
    wrapper.addEventListener("keydown", toggleMenu);

    menu.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      try {
        if (button.dataset.action === "panel") services.openActorPanel(actor);
        else if (button.dataset.action === "clean") await services.actionService.cleanActor(actor, button.dataset.methodId);
        else if (button.dataset.action === "adjust") await services.stateService.adjustDirt(actor, Number(button.dataset.amount), { reason: game.i18n.localize("GAG.Actions.TokenHud") });
        else if (button.dataset.action === "reset") await services.stateService.setDirtLevel(actor, 0, { reason: game.i18n.localize("GAG.Actions.Reset") });
        else if (button.dataset.action === "toggle-maintenance") {
          const state = services.stateService.getState(actor, { includeHidden: true });
          await services.stateService.setAutomaticMaintenance(actor, !state.autoMaintenance, { reason: game.i18n.localize("GAG.Actions.ToggleMaintenance") });
        }
        else if (button.dataset.action === "token-label" && token) {
          await services.tokenLabelService.setTokenMode(token, button.dataset.mode);
        }
        else if (button.dataset.action === "token-label-position" && token) {
          await services.tokenLabelService.setTokenPosition(token, button.dataset.position);
        }
        ui.notifications.info(game.i18n.format("GAG.Notifications.TokenActionComplete", { actor: actor.name }));
        hud.render?.({ force: true });
      } catch (error) {
        console.error(`[garb-and-grime] Token HUD action failed`, error);
        ui.notifications.error(error.message ?? game.i18n.localize("GAG.Errors.Unexpected"));
      }
    });

    column.append(wrapper);
  };

  // Foundry's semantic Token HUD hook avoids inspecting unrelated applications.
  Hooks.on("renderTokenHUD", render);
}

function resolveHudToken(hud) {
  const candidate = hud?.object ?? hud?.token ?? hud?.document?.object ?? null;
  if (candidate?.document?.documentName === "Token") return candidate;
  if (candidate?.documentName === "Token") return candidate.object ?? null;
  return null;
}

function resolveHudActor(hud) {
  return hud?.object?.actor
    ?? hud?.object?.document?.actor
    ?? hud?.token?.actor
    ?? hud?.document?.actor
    ?? null;
}

function tokenMenuHtml(actor, canModify, isGm, showQuickActions, tokenLabelMode, tokenLabelPosition) {
  const action = (icon, label, attrs) => `<button type="button" ${attrs} title="${escape(label)}"><i class="${icon}" aria-hidden="true"></i><span>${escape(label)}</span></button>`;
  const buttons = [action("fa-solid fa-eye", game.i18n.localize("GAG.Actions.View"), 'data-action="panel"')];
  if (canModify && showQuickActions) {
    buttons.push(action("fa-solid fa-water", game.i18n.localize("GAG.Methods.Water.Name"), 'data-action="clean" data-method-id="water"'));
    buttons.push(action("fa-solid fa-soap", game.i18n.localize("GAG.Methods.Soap.Name"), 'data-action="clean" data-method-id="soap"'));
    buttons.push(action("fa-solid fa-shirt", game.i18n.localize("GAG.Methods.SpareClothing.Name"), 'data-action="clean" data-method-id="spare-clothing"'));
  }
  if (isGm) {
    buttons.push("<hr>");
    buttons.push(action("fa-solid fa-plus", game.i18n.localize("GAG.Actions.Increase"), 'data-action="adjust" data-amount="1"'));
    buttons.push(action("fa-solid fa-minus", game.i18n.localize("GAG.Actions.Reduce"), 'data-action="adjust" data-amount="-1"'));
    buttons.push(action("fa-solid fa-rotate-left", game.i18n.localize("GAG.Actions.Reset"), 'data-action="reset"'));
    buttons.push(action("fa-solid fa-coins", game.i18n.localize("GAG.Actions.ToggleMaintenance"), 'data-action="toggle-maintenance"'));
    buttons.push("<hr>");
    buttons.push(action("fa-solid fa-eye", game.i18n.localize("GAG.TokenLabels.Modes.show"), `data-action="token-label" data-mode="show" ${tokenLabelMode === "show" ? 'aria-current="true"' : ""}`));
    buttons.push(action("fa-solid fa-globe", game.i18n.localize("GAG.TokenLabels.Modes.inherit"), `data-action="token-label" data-mode="inherit" ${tokenLabelMode === "inherit" ? 'aria-current="true"' : ""}`));
    buttons.push(action("fa-solid fa-eye-slash", game.i18n.localize("GAG.TokenLabels.Modes.hide"), `data-action="token-label" data-mode="hide" ${tokenLabelMode === "hide" ? 'aria-current="true"' : ""}`));
    buttons.push("<hr>");
    buttons.push(action("fa-solid fa-arrows-up-down-left-right", game.i18n.localize("GAG.TokenLabels.Position.inherit"), `data-action="token-label-position" data-position="inherit" ${tokenLabelPosition === "inherit" ? 'aria-current="true"' : ""}`));
    buttons.push(action("fa-solid fa-arrow-up", game.i18n.localize("GAG.TokenLabels.Position.above"), `data-action="token-label-position" data-position="above" ${tokenLabelPosition === "above" ? 'aria-current="true"' : ""}`));
    buttons.push(action("fa-solid fa-arrow-right", game.i18n.localize("GAG.TokenLabels.Position.right"), `data-action="token-label-position" data-position="right" ${tokenLabelPosition === "right" ? 'aria-current="true"' : ""}`));
    buttons.push(action("fa-solid fa-arrow-down", game.i18n.localize("GAG.TokenLabels.Position.below"), `data-action="token-label-position" data-position="below" ${tokenLabelPosition === "below" ? 'aria-current="true"' : ""}`));
    buttons.push(action("fa-solid fa-arrow-left", game.i18n.localize("GAG.TokenLabels.Position.left"), `data-action="token-label-position" data-position="left" ${tokenLabelPosition === "left" ? 'aria-current="true"' : ""}`));
  }
  return buttons.join("");
}

function escape(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}
