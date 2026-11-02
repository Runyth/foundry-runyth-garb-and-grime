// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import { API_VERSION, FLAGS, HOOKS, MODULE_ID, MODULE_VERSION, PERMISSIONS, SETTINGS } from "../src/constants.mjs";
import { DefinitionRegistry } from "../src/registry.mjs";
import { registerSettings } from "../src/settings.mjs";
import { StateService } from "../src/state-service.mjs";
import { ActionService } from "../src/action-service.mjs";
import { ContextService } from "../src/context-service.mjs";
import { RollService } from "../src/roll-service.mjs";
import { AutomationService } from "../src/automation.mjs";
import { registerBuiltInCurrencyAdapters } from "../src/currency.mjs";
import { CleanlinessManager, configureManagerServices } from "../src/apps/manager.mjs";
import { ActorCleanlinessPanel, configureActorPanelServices } from "../src/apps/actor-panel.mjs";
import { GarbAndGrimeSettings, configureSettingsServices } from "../src/apps/settings-hub.mjs";
import { SceneCleanlinessGuide, configureSceneGuideServices } from "../src/apps/scene-guide.mjs";
import { registerActorSheetIntegration } from "../src/integrations/actor-sheets.mjs";
import { registerTokenHudIntegration } from "../src/integrations/token-hud.mjs";
import { registerTokenLabelIntegration, TokenLabelService } from "../src/integrations/token-labels.mjs";
import { registerSceneControls } from "../src/integrations/scene-controls.mjs";
import { registerSidebarLauncher } from "../src/integrations/sidebar.mjs";
import { registerItemIntegrationHooks, useItemIntegration } from "../src/integrations/items.mjs";
import { runMigrations, showFirstRunGuide } from "../src/migration.mjs";
import { deepClone } from "../src/domain/state.mjs";
import { getConfiguration } from "../src/settings.mjs";
import { scheduleApplicationRender } from "../src/util.mjs";

const registry = new DefinitionRegistry();
registerBuiltInCurrencyAdapters(registry);
const stateService = new StateService(registry);
const tokenLabelService = new TokenLabelService(stateService);
const contextService = new ContextService(registry);
const actionService = new ActionService(registry, stateService, contextService, { onTransactionRecorded: () => refreshManager() });
const rollService = new RollService(registry, stateService, contextService);
const automationService = new AutomationService(stateService, actionService, contextService);

let manager = null;
const actorPanels = new Map();
let settingsHub = null;
let sceneGuide = null;
const initializationErrors = [];

function openManager(options = {}) {
  if (!manager) manager = new CleanlinessManager(options);
  manager.render({ force: true });
  return manager;
}

function openActorPanel(actor, options = {}) {
  if (!actor) throw new Error(game.i18n.localize("GAG.Errors.ActorMissing"));
  let app = actorPanels.get(actor.uuid);
  if (!app) {
    app = new ActorCleanlinessPanel({ ...options, actor });
    actorPanels.set(actor.uuid, app);
    app.addEventListener("close", () => actorPanels.delete(actor.uuid), { once: true });
  }
  app.render({ force: true });
  return app;
}

function openSettings(options = {}) {
  if (!game.user.isGM) throw new Error(game.i18n.localize("GAG.Errors.PermissionDenied"));
  if (!settingsHub) {
    settingsHub = new GarbAndGrimeSettings(options);
    settingsHub.addEventListener("close", () => { settingsHub = null; }, { once: true });
  }
  settingsHub.render({ force: true });
  return settingsHub;
}

async function openSceneGuide(options = {}) {
  if (!game.user.isGM) throw new Error(game.i18n.localize("GAG.Errors.PermissionDenied"));
  if (!getConfiguration().sceneGuide.enabled) {
    ui.notifications.warn(game.i18n.localize("GAG.SceneGuide.Disabled"));
    return null;
  }
  if (!sceneGuide) {
    sceneGuide = new SceneCleanlinessGuide(options);
    sceneGuide.addEventListener("close", () => { sceneGuide = null; }, { once: true });
  }
  await game.settings.set(MODULE_ID, SETTINGS.SCENE_GUIDE_VISIBLE, true);
  sceneGuide.render({ force: true });
  return sceneGuide;
}

async function toggleSceneGuide() {
  if (sceneGuide) {
    await sceneGuide.close();
    return null;
  }
  return openSceneGuide();
}

function refreshManager({ invalidateActors = false } = {}) {
  if (invalidateActors) manager?.invalidateActorCache?.();
  scheduleApplicationRender(manager);
}

function reloadWorldDefinitions() {
  registry.resetDefinitions();
  registry.replaceWorldDefinitions({
    methods: game.settings.get(MODULE_ID, SETTINGS.CLEANING_METHODS) ?? [],
    contaminations: game.settings.get(MODULE_ID, SETTINGS.CONTAMINATIONS) ?? [],
    profiles: game.settings.get(MODULE_ID, SETTINGS.PROFILES) ?? []
  });
  registerBuiltInCurrencyAdapters(registry);
  manager?.invalidateActorCache?.();
  scheduleApplicationRender(manager);
  for (const panel of actorPanels.values()) scheduleApplicationRender(panel);
}

const services = {
  registry,
  stateService,
  actionService,
  contextService,
  rollService,
  automationService,
  tokenLabelService,
  openManager,
  openActorPanel,
  openSettings,
  openSceneGuide,
  toggleSceneGuide,
  reloadWorldDefinitions,
  refreshManager,
  getConfiguration
};
configureManagerServices(services);
configureActorPanelServices(services);
configureSettingsServices(services);
configureSceneGuideServices(services);

const api = Object.freeze({
  version: API_VERSION,
  moduleVersion: MODULE_VERSION,
  hooks: HOOKS,
  permissions: PERMISSIONS,
  getState: (actor, options) => stateService.getState(actor, options),
  setDirtLevel: (actor, level, options) => stateService.setDirtLevel(actor, level, options),
  adjustDirt: (actor, amount, options) => stateService.adjustDirt(actor, amount, options),
  setBodyCleanliness: (actor, state, options) => stateService.setBodyCleanliness(actor, state, options),
  setClothingCleanliness: (actor, state, options) => stateService.setClothingCleanliness(actor, state, options),
  applyContamination: (actor, contaminationId, options) => stateService.applyContamination(actor, contaminationId, options),
  removeContamination: (actor, contaminationId, options) => stateService.removeContamination(actor, contaminationId, options),
  cleanActor: (actor, methodId, options) => actionService.cleanActor(actor, methodId, options),
  settleMaintenanceDebt: (actor, options) => actionService.settleMaintenanceDebt(actor, options),
  registerCleaningMethod: (definition) => registry.registerCleaningMethod(definition),
  registerContamination: (definition) => registry.registerContamination(definition),
  registerEnvironmentProfile: (definition) => registry.registerEnvironmentProfile(definition),
  registerItemIntegration: (definition) => registry.registerItemIntegration(definition),
  registerCurrencyAdapter: (adapter) => registry.registerCurrencyAdapter(adapter),
  getSceneContext: (scene) => contextService.getSceneContext(scene),
  setSceneContext: (scene, contextId, options) => contextService.setSceneContext(scene, contextId, options),
  getSceneLevelRatings: (scene) => contextService.getLevelRatings(scene),
  setSceneLevelRatings: (scene, ratings, options) => contextService.setSceneLevelRatings(scene, ratings, options),
  evaluateRollContext: (actor, rollType, options) => rollService.evaluateRollContext(actor, rollType, options),
  promptRollContext: (actor, rollType, options) => rollService.promptRollContext(actor, rollType, options),
  applyContextExposure: (actors, options) => automationService.applyContextExposure(actors, options),
  openManager,
  openActorPanel,
  openSettings,
  openSceneGuide,
  toggleSceneGuide,
  useItemIntegration: (item) => useItemIntegration(item, services),
  setTokenLabelMode: (token, mode, options) => tokenLabelService.setTokenMode(token, mode, options),
  setSelectedTokenLabelMode: (mode, options) => tokenLabelService.setSelectedTokenMode(mode, options),
  setTokenLabelPosition: (token, position, options) => tokenLabelService.setTokenPosition(token, position, options),
  setSelectedTokenLabelPosition: (position, options) => tokenLabelService.setSelectedTokenPosition(position, options),
  toggleTokenLabels: (options) => tokenLabelService.toggleGlobalVisibility(options),
  setTokenLabelsVisible: (visible, options) => tokenLabelService.setGlobalVisibility(visible, options),
  refreshTokenLabels: () => tokenLabelService.refreshAll(),
  getCleaningMethods: () => registry.listCleaningMethods(),
  getContaminations: () => registry.listContaminations(),
  getEnvironmentProfiles: () => registry.listEnvironmentProfiles(),
  getVersion: () => MODULE_VERSION,
  getApiVersion: () => API_VERSION,
  getConfiguration: () => deepClone(getConfiguration())
});

Hooks.once("init", () => {
  exposeApi();

  // Register settings first. Every remaining integration is isolated so a custom
  // sheet or optional interface cannot prevent the essential settings menus from loading.
  initialize("GAG.Initialization.Areas.Settings", () => registerSettings({ managerClass: CleanlinessManager, settingsClass: GarbAndGrimeSettings }));
  initialize("GAG.Initialization.Areas.ActorSheets", () => registerActorSheetIntegration({ stateService, registry, openActorPanel }));
  initialize("GAG.Initialization.Areas.TokenHud", () => registerTokenHudIntegration(services));
  initialize("GAG.Initialization.Areas.TokenLabels", () => registerTokenLabelIntegration(tokenLabelService));
  initialize("GAG.Initialization.Areas.SceneControls", () => registerSceneControls(services));
  initialize("GAG.Initialization.Areas.Sidebar", () => registerSidebarLauncher({ openManager, openSettings, stateService }));
  initialize("GAG.Initialization.Areas.Items", () => registerItemIntegrationHooks(services));
  initialize("GAG.Initialization.Areas.Rolls", () => rollService.registerHooks());
  initialize("GAG.Initialization.Areas.Automation", () => automationService.registerHooks());

  Hooks.callAll(HOOKS.API_READY, api);
  console.info(`[${MODULE_ID}] Initialized v${MODULE_VERSION}.`);
});

Hooks.once("ready", async () => {
  try {
    actionService.registerSocketHandlers();
    reloadWorldDefinitions();
    const migration = await runMigrations(stateService);
    if (migration.definitionsChanged) reloadWorldDefinitions();
    refreshEntryPointApplications();
    if (game.user.isGM && getConfiguration().general.firstRunGuide) await showFirstRunGuide(openManager, openSettings);
    if (game.user.isGM && getConfiguration().sceneGuide.enabled
      && (getConfiguration().sceneGuide.openOnSceneChange || game.settings.get(MODULE_ID, SETTINGS.SCENE_GUIDE_VISIBLE))) {
      await openSceneGuide();
    }
    if (initializationErrors.length) {
      const message = game.i18n.format("GAG.Errors.PartialInitialization", { count: initializationErrors.length });
      ui.notifications.error(message, { permanent: true });
    }
  } catch (error) {
    reportInitializationError("GAG.Initialization.Areas.Ready", error, { notify: true });
  }
});

Hooks.on("updateActor", (actor, changes) => {
  manager?.invalidateActor?.(actor);
  const moduleStateChanged = foundry.utils.hasProperty(changes, `flags.${MODULE_ID}`);
  const directoryDisplayChanged = ["name", "img", "type", "folder", "ownership", "prototypeToken.texture.src"]
    .some((path) => foundry.utils.hasProperty(changes, path));
  if (moduleStateChanged || directoryDisplayChanged) scheduleApplicationRender(manager);
  if (moduleStateChanged) scheduleApplicationRender(actorPanels.get(actor.uuid));
});

Hooks.on("createActor", () => {
  manager?.invalidateActorCache?.();
  scheduleApplicationRender(manager);
});

Hooks.on("deleteActor", () => {
  manager?.invalidateActorCache?.();
  scheduleApplicationRender(manager);
});

Hooks.on("createUser", () => {
  refreshManager({ invalidateActors: true });
});

Hooks.on("updateUser", (user, changes) => {
  const dashboardLinkChanged = ["character", "role"]
    .some((path) => foundry.utils.hasProperty(changes, path));
  if (!dashboardLinkChanged) return;
  refreshManager({ invalidateActors: true });
});

Hooks.on("deleteUser", () => {
  refreshManager({ invalidateActors: true });
});

Hooks.on("updateFolder", (folder) => {
  if (folder?.type !== "Actor") return;
  manager?.invalidateActorCache?.();
  scheduleApplicationRender(manager);
});

Hooks.on("createFolder", (folder) => {
  if (folder?.type !== "Actor") return;
  manager?.invalidateActorCache?.();
  scheduleApplicationRender(manager);
});

Hooks.on("deleteFolder", (folder) => {
  if (folder?.type !== "Actor") return;
  manager?.invalidateActorCache?.();
  scheduleApplicationRender(manager);
});

Hooks.on("updateScene", (scene, changes) => {
  if (!foundry.utils.hasProperty(changes, `flags.${MODULE_ID}.${FLAGS.SCENE_CONTEXT}`)) return;
  scheduleApplicationRender(manager);
  scheduleApplicationRender(sceneGuide);
});

Hooks.on("canvasReady", () => {
  if (!game.user.isGM || !getConfiguration().sceneGuide.enabled) return;
  if (getConfiguration().sceneGuide.openOnSceneChange || game.settings.get(MODULE_ID, SETTINGS.SCENE_GUIDE_VISIBLE)) {
    void openSceneGuide().catch((error) => reportInitializationError("GAG.Initialization.Areas.SceneGuide", error));
  } else scheduleApplicationRender(sceneGuide);
});

Hooks.on("closeCleanlinessManager", () => { manager = null; });
Hooks.on("closeSceneCleanlinessGuide", () => { sceneGuide = null; });

function exposeApi() {
  try {
    const module = game?.modules?.get(MODULE_ID);
    if (!module) throw new Error(game.i18n.localize("GAG.Errors.ModuleRecordMissing"));
    module.api = api;
  } catch (error) {
    reportInitializationError("GAG.Initialization.Areas.Api", error);
  }
}

function initialize(label, callback) {
  try {
    callback();
  } catch (error) {
    reportInitializationError(label, error);
  }
}

function reportInitializationError(areaKey, error, { notify = false } = {}) {
  const area = game.i18n.localize(areaKey);
  initializationErrors.push({ areaKey, error });
  console.error(`[${MODULE_ID}] Failed to initialize ${area}.`, error);
  if (notify && globalThis.ui?.notifications) {
    ui.notifications.error(game.i18n.format("GAG.Errors.InitializationFailed", { area }), { permanent: true });
  }
}

function refreshEntryPointApplications() {
  const tabs = ui?.sidebar?.tabs;
  tabs?.actors?.render?.({ force: true });
  tabs?.settings?.render?.({ force: true });
}
