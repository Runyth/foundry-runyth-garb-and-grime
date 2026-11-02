// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import { MODULE_ID, PERMISSIONS, SETTINGS } from "../constants.mjs";
import { getConfiguration } from "../settings.mjs";
import { hasPermission } from "../permissions.mjs";
import { mapWithConcurrency, selectedActors } from "../util.mjs";
import { openSceneContextDialog } from "../apps/scene-context-dialog.mjs";

export function registerSceneControls(services) {
  Hooks.on("getSceneControlButtons", (controls) => {
    if (!getConfiguration().sceneControls.enabled) return;
    registerDedicatedControlGroup(controls, services);
    registerTokenControlTools(controls, services);
  });
}

function registerDedicatedControlGroup(controls, services) {
  const configuration = getConfiguration();
  const tools = {
    "garb-and-grime-manager": {
      name: "garb-and-grime-manager",
      title: "GAG.SceneControls.Manager",
      icon: "fa-solid fa-users-viewfinder",
      button: true,
      order: 0,
      visible: true,
      onChange: () => services.openManager()
    },
    "garb-and-grime-scene-guide": {
      name: "garb-and-grime-scene-guide",
      title: "GAG.SceneControls.SceneGuide",
      icon: "fa-solid fa-signs-post",
      toggle: true,
      active: Boolean(game.settings.get(MODULE_ID, SETTINGS.SCENE_GUIDE_VISIBLE)),
      order: 1,
      visible: game.user.isGM && configuration.sceneGuide.enabled && configuration.sceneGuide.showSceneControl,
      onChange: () => runSceneControl("scene guide", () => services.toggleSceneGuide())
    },
    "garb-and-grime-context": {
      name: "garb-and-grime-context",
      title: "GAG.SceneControls.Context",
      icon: "fa-solid fa-location-dot",
      button: true,
      order: 2,
      visible: game.user.isGM || hasPermission(PERMISSIONS.CONFIGURE_CONTEXTS),
      onChange: () => runSceneControl("scene context", () => openSceneContextDialog(services))
    },
    "garb-and-grime-bulk": {
      name: "garb-and-grime-bulk",
      title: "GAG.SceneControls.Bulk",
      icon: "fa-solid fa-users-gear",
      button: true,
      order: 3,
      visible: game.user.isGM || hasPermission(PERMISSIONS.MODIFY_OTHERS),
      onChange: () => runSceneControl("bulk action", () => openBulkDialog(services))
    },
    "garb-and-grime-token-label-preferences": {
      name: "garb-and-grime-token-label-preferences",
      title: "GAG.SceneControls.TokenLabelPreferences",
      icon: "fa-solid fa-eye",
      button: true,
      order: 4,
      visible: configuration.tokenLabels.enabled && services.tokenLabelService.canUseViewerControls(),
      onChange: () => runSceneControl("token-label preferences", () => openViewerLabelPreferencesDialog(services))
    }
  };
  controls[MODULE_ID] = {
    name: MODULE_ID,
    title: "GAG.SceneControls.Group",
    icon: "fa-solid fa-shirt",
    order: 45,
    activeTool: "garb-and-grime-manager",
    visible: true,
    tools
  };
}

function registerTokenControlTools(controls, services) {
  const tokenControl = controls.tokens;
  if (!tokenControl) return;
  const configuration = getConfiguration();
  tokenControl.tools["garb-and-grime-manager"] = {
    name: "garb-and-grime-manager",
    title: "GAG.SceneControls.Manager",
    icon: "fa-solid fa-shirt",
    button: true,
    order: 90,
    visible: true,
    onChange: () => services.openManager()
  };
  if (configuration.tokenLabels.enabled && services.tokenLabelService.canUseViewerControls()) {
    tokenControl.tools["garb-and-grime-token-label-preferences"] = {
      name: "garb-and-grime-token-label-preferences",
      title: "GAG.SceneControls.TokenLabelPreferences",
      icon: "fa-solid fa-eye",
      button: true,
      order: 91,
      visible: true,
      onChange: () => runSceneControl("token-label preferences", () => openViewerLabelPreferencesDialog(services))
    };
    if (services.tokenLabelService.getEffectiveViewerMode(configuration) === "manual") {
      tokenControl.tools["garb-and-grime-token-labels"] = {
        name: "garb-and-grime-token-labels",
        title: "GAG.SceneControls.TokenLabels",
        icon: "fa-solid fa-tag",
        toggle: true,
        active: services.tokenLabelService.isGlobalVisible(),
        order: 92,
        visible: true,
        onChange: (_event, active) => runSceneControl("token-label toggle", () => services.tokenLabelService.setGlobalVisibility(active, { notify: true }))
      };
    }
  }
  if (game.user.isGM && configuration.tokenLabels.enabled) {
    tokenControl.tools["garb-and-grime-selected-labels"] = {
      name: "garb-and-grime-selected-labels",
      title: "GAG.SceneControls.SelectedTokenLabels",
      icon: "fa-solid fa-tags",
      button: true,
      order: 93,
      visible: true,
      onChange: () => runSceneControl("selected Token labels", () => openSelectedLabelDialog(services))
    };
    tokenControl.tools["garb-and-grime-selected-label-position"] = {
      name: "garb-and-grime-selected-label-position",
      title: "GAG.SceneControls.SelectedTokenLabelPosition",
      icon: "fa-solid fa-arrows-up-down-left-right",
      button: true,
      order: 94,
      visible: true,
      onChange: () => runSceneControl("selected Token label position", () => openSelectedLabelPositionDialog(services))
    };
  }
  if (game.user.isGM || hasPermission(PERMISSIONS.MODIFY_OTHERS)) {
    tokenControl.tools["garb-and-grime-bulk"] = {
      name: "garb-and-grime-bulk",
      title: "GAG.SceneControls.Bulk",
      icon: "fa-solid fa-users-gear",
      button: true,
      order: 95,
      visible: true,
      onChange: () => runSceneControl("bulk action", () => openBulkDialog(services))
    };
  }
  if (game.user.isGM || hasPermission(PERMISSIONS.CONFIGURE_CONTEXTS)) {
    tokenControl.tools["garb-and-grime-context"] = {
      name: "garb-and-grime-context",
      title: "GAG.SceneControls.Context",
      icon: "fa-solid fa-location-dot",
      button: true,
      order: 96,
      visible: true,
      onChange: () => runSceneControl("scene context", () => openSceneContextDialog(services))
    };
  }
}

function runSceneControl(area, action) {
  void Promise.resolve().then(action).catch((error) => {
    console.error(`[${MODULE_ID}] Scene Control failed during ${area}.`, error);
    ui.notifications.error(error?.message ?? game.i18n.localize("GAG.Errors.Unexpected"));
  });
}

async function openBulkDialog(services) {
  const actors = selectedActors();
  if (!actors.length) return ui.notifications.warn(game.i18n.localize("GAG.Notifications.SelectTokens"));
  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("GAG.BulkDialog.Title") },
    content: `<p>${foundry.utils.escapeHTML(game.i18n.format("GAG.BulkDialog.Text", { count: actors.length }))}</p>`,
    buttons: [
      { action: "increase", label: game.i18n.localize("GAG.Actions.Increase"), icon: "fa-solid fa-plus", callback: () => "increase" },
      { action: "decrease", label: game.i18n.localize("GAG.Actions.Reduce"), icon: "fa-solid fa-minus", callback: () => "decrease" },
      { action: "water", label: game.i18n.localize("GAG.Methods.Water.Name"), icon: "fa-solid fa-water", callback: () => "water" },
      { action: "clean", label: game.i18n.localize("GAG.Actions.CleanFully"), icon: "fa-solid fa-soap", callback: () => "clean" },
      { action: "cancel", label: game.i18n.localize("Cancel"), callback: () => null }
    ]
  });
  if (choice === "increase") await mapWithConcurrency(actors, (actor) => services.stateService.adjustDirt(actor, 1, { reason: game.i18n.localize("GAG.Actions.BulkAdjustment") }));
  if (choice === "decrease") await mapWithConcurrency(actors, (actor) => services.stateService.adjustDirt(actor, -1, { reason: game.i18n.localize("GAG.Actions.BulkAdjustment") }));
  if (choice === "increase" || choice === "decrease") {
    const amount = choice === "increase" ? 1 : -1;
    ui.notifications.info(game.i18n.format("GAG.Notifications.BulkActorsAdjusted", { count: actors.length, amount: amount > 0 ? `+${amount}` : String(amount) }));
  }
  if (choice === "water") await mapWithConcurrency(actors, (actor) => services.actionService.cleanActor(actor, "water", { skipItemRequirements: true }));
  if (choice === "clean") await mapWithConcurrency(actors, (actor) => services.actionService.cleanActor(actor, "soap", { skipItemRequirements: true, waiveCost: true }));
}

async function openViewerLabelPreferencesDialog(services) {
  const service = services.tokenLabelService;
  if (!service.canUseViewerControls()) throw new Error(game.i18n.localize("GAG.TokenLabels.PermissionDenied"));
  const mode = service.getViewerMode();
  const position = service.getViewerPosition();
  const visible = service.isGlobalVisible();
  const option = (value, current, key) => `<option value="${value}" ${value === current ? "selected" : ""}>${foundry.utils.escapeHTML(game.i18n.localize(key))}</option>`;
  const content = `<div class="garb-and-grime gag-dialog-form gag-viewer-label-preferences">
    <p class="hint">${foundry.utils.escapeHTML(game.i18n.localize(game.user.isGM ? "GAG.TokenLabels.GmViewerPreferencesHint" : "GAG.TokenLabels.PlayerViewerPreferencesHint"))}</p>
    ${game.user.isGM ? "" : `<label><span>${foundry.utils.escapeHTML(game.i18n.localize("GAG.TokenLabels.ViewerModeLabel"))}</span><select name="viewerMode">
      ${option("inherit", mode, "GAG.TokenLabels.ViewerMode.inherit")}
      ${option("manual", mode, "GAG.TokenLabels.ViewerMode.manual")}
      ${option("always", mode, "GAG.TokenLabels.ViewerMode.always")}
      ${option("controlled", mode, "GAG.TokenLabels.ViewerMode.controlled")}
      ${option("hovered", mode, "GAG.TokenLabels.ViewerMode.hovered")}
      ${option("controlled-or-hovered", mode, "GAG.TokenLabels.ViewerMode.controlled-or-hovered")}
      ${option("hidden", mode, "GAG.TokenLabels.ViewerMode.hidden")}
    </select></label>
    <label><span>${foundry.utils.escapeHTML(game.i18n.localize("GAG.TokenLabels.ViewerPositionLabel"))}</span><select name="viewerPosition">
      ${option("inherit", position, "GAG.TokenLabels.Position.inherit")}
      ${option("above", position, "GAG.TokenLabels.Position.above")}
      ${option("right", position, "GAG.TokenLabels.Position.right")}
      ${option("below", position, "GAG.TokenLabels.Position.below")}
      ${option("left", position, "GAG.TokenLabels.Position.left")}
    </select></label>`}
    <label class="gag-checkbox"><input type="checkbox" name="manualVisible" ${visible ? "checked" : ""}><span>${foundry.utils.escapeHTML(game.i18n.localize("GAG.TokenLabels.ManualVisibleLabel"))}</span></label>
  </div>`;
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("GAG.TokenLabels.ViewerPreferencesTitle") },
    content,
    buttons: [
      {
        action: "save",
        label: game.i18n.localize("Save"),
        icon: "fa-solid fa-floppy-disk",
        default: true,
        callback: (_event, button) => ({
          mode: game.user.isGM ? "inherit" : String(button.form?.elements?.viewerMode?.value ?? mode),
          position: game.user.isGM ? "inherit" : String(button.form?.elements?.viewerPosition?.value ?? position),
          manualVisible: Boolean(button.form?.elements?.manualVisible?.checked)
        })
      },
      { action: "cancel", label: game.i18n.localize("Cancel"), callback: () => null }
    ]
  });
  if (!result) return;
  if (!game.user.isGM) {
    await service.setViewerMode(result.mode);
    await service.setViewerPosition(result.position);
  }
  const configuration = getConfiguration();
  if (service.getEffectiveViewerMode(configuration) === "manual") await service.setGlobalVisibility(result.manualVisible, { notify: false });
  service.scheduleRefreshAll();
  ui.controls?.render?.();
  ui.notifications.info(game.i18n.localize("GAG.TokenLabels.ViewerPreferencesSaved"));
}

async function openSelectedLabelDialog(services) {
  const tokens = canvas?.tokens?.controlled ?? [];
  if (!tokens.length) return ui.notifications.warn(game.i18n.localize("GAG.Notifications.SelectTokens"));
  const mode = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("GAG.TokenLabels.SelectedDialog.Title") },
    content: `<p>${foundry.utils.escapeHTML(game.i18n.format("GAG.TokenLabels.SelectedDialog.Text", { count: tokens.length }))}</p>`,
    buttons: [
      { action: "show", label: game.i18n.localize("GAG.TokenLabels.Modes.show"), icon: "fa-solid fa-eye", callback: () => "show" },
      { action: "inherit", label: game.i18n.localize("GAG.TokenLabels.Modes.inherit"), icon: "fa-solid fa-globe", callback: () => "inherit" },
      { action: "hide", label: game.i18n.localize("GAG.TokenLabels.Modes.hide"), icon: "fa-solid fa-eye-slash", callback: () => "hide" },
      { action: "cancel", label: game.i18n.localize("Cancel"), callback: () => null }
    ]
  });
  if (mode) await services.tokenLabelService.setSelectedTokenMode(mode);
}


async function openSelectedLabelPositionDialog(services) {
  const tokens = canvas?.tokens?.controlled ?? [];
  if (!tokens.length) return ui.notifications.warn(game.i18n.localize("GAG.Notifications.SelectTokens"));
  const position = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("GAG.TokenLabels.SelectedPositionDialog.Title") },
    content: `<p>${foundry.utils.escapeHTML(game.i18n.format("GAG.TokenLabels.SelectedPositionDialog.Text", { count: tokens.length }))}</p>`,
    buttons: [
      { action: "inherit", label: game.i18n.localize("GAG.TokenLabels.Position.inherit"), icon: "fa-solid fa-arrows-up-down-left-right", callback: () => "inherit" },
      { action: "above", label: game.i18n.localize("GAG.TokenLabels.Position.above"), icon: "fa-solid fa-arrow-up", callback: () => "above" },
      { action: "right", label: game.i18n.localize("GAG.TokenLabels.Position.right"), icon: "fa-solid fa-arrow-right", callback: () => "right" },
      { action: "below", label: game.i18n.localize("GAG.TokenLabels.Position.below"), icon: "fa-solid fa-arrow-down", callback: () => "below" },
      { action: "left", label: game.i18n.localize("GAG.TokenLabels.Position.left"), icon: "fa-solid fa-arrow-left", callback: () => "left" },
      { action: "cancel", label: game.i18n.localize("Cancel"), callback: () => null }
    ]
  });
  if (position) await services.tokenLabelService.setSelectedTokenPosition(position);
}
