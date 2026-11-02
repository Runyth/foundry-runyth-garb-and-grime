import { MODULE_ID, PERMISSIONS, SCENE_LEVEL_RATINGS, SETTINGS } from "../constants.mjs";
import { DEFAULT_CLEANING_METHODS, DEFAULT_CONFIGURATION, DEFAULT_CONTAMINATIONS, DEFAULT_ENVIRONMENT_PROFILES, DEFAULT_PERMISSIONS } from "../defaults.mjs";
import { deepClone } from "../domain/state.mjs";
import { validateContamination, validateMethod, validateProfile } from "../domain/validation.mjs";
import { getConfiguration, getPermissionsSetting, setConfiguration } from "../settings.mjs";
import { label, mapWithConcurrency, scheduleApplicationRender } from "../util.mjs";
import { getLocalizationStatus } from "../localization.mjs";
import { PersistentApplication } from "./persistent-app.mjs";
import { buildActorFolderOptions, compileActorScopeRegex } from "../actor-scope.mjs";
import { deriveLevelRatings, normalizeLevelRatings } from "../context-service.mjs";

let services;
export function configureSettingsServices(value) { services = value; }

const DEFAULT_PROFILE_BY_ID = new Map(DEFAULT_ENVIRONMENT_PROFILES.map((profile) => [profile.id, profile]));

function ratingsForProfileEditor(profile) {
  const preset = DEFAULT_PROFILE_BY_ID.get(profile?.id);
  const explicit = normalizeLevelRatings(profile?.levelRatings);
  const legacyAllExpected = explicit
    && profile?.levelRatingsSource !== "custom"
    && preset
    && explicit.every((rating) => rating === "expected");
  if (explicit && !legacyAllExpected) return explicit;
  if (preset) return [...preset.levelRatings];
  return deriveLevelRatings(profile?.expected);
}

function nextCustomId(prefix, values) {
  const existing = new Set((values ?? []).map((entry) => entry.id));
  let index = 1;
  while (existing.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}


function refreshActorScopeSelectionCount(root) {
  const output = root?.querySelector?.("[data-gag-actor-scope-selected-count]");
  if (!output) return;
  const count = root.querySelectorAll("[data-gag-actor-scope-folder]:checked").length;
  output.textContent = game.i18n.format("GAG.SettingsHub.General.ActorScopeFoldersSelected", { count });
}

function prepareMethod(method, index) {
  const requiredItems = [];
  const optionalItems = [];
  for (const entry of method.itemRequirements ?? []) {
    (entry.optional ? optionalItems : requiredItems).push(entry.integrationId);
  }
  return {
    ...method,
    index,
    removable: method.id.startsWith("custom-"),
    label: label(method),
    requiredItemsText: requiredItems.join(", "),
    optionalItemsText: optionalItems.join(", "),
    settlementTypesText: (method.settlementTypes ?? []).join(", "),
    temporaryId: method.temporaryEffects?.[0]?.id ?? "",
    temporaryDuration: method.temporaryEffects?.[0]?.durationSeconds ?? ""
  };
}

export class GarbAndGrimeSettings extends PersistentApplication {
  static DEFAULT_OPTIONS = {
    id: "garb-and-grime-settings",
    classes: ["runyth-garb-and-grime", "gag-window", "gag-settings"],
    position: { width: 1060, height: 760 },
    window: { icon: "fa-solid fa-sliders", title: "GAG.SettingsHub.Title", resizable: true },
    actions: {
      switchTab: GarbAndGrimeSettings.onSwitchTab,
      saveConfiguration: GarbAndGrimeSettings.onSaveConfiguration,
      saveMethods: GarbAndGrimeSettings.onSaveMethods,
      saveProfiles: GarbAndGrimeSettings.onSaveProfiles,
      saveContaminations: GarbAndGrimeSettings.onSaveContaminations,
      savePermissions: GarbAndGrimeSettings.onSavePermissions,
      resetCategory: GarbAndGrimeSettings.onResetCategory,
      openManager: GarbAndGrimeSettings.onOpenManager,
      openSceneGuide: GarbAndGrimeSettings.onOpenSceneGuide,
      addMethod: GarbAndGrimeSettings.onAddMethod,
      addProfile: GarbAndGrimeSettings.onAddProfile,
      addContamination: GarbAndGrimeSettings.onAddContamination,
      removeDefinition: GarbAndGrimeSettings.onRemoveDefinition,
      setPartyMaintenance: GarbAndGrimeSettings.onSetPartyMaintenance,
      toggleTokenLabels: GarbAndGrimeSettings.onToggleTokenLabels,
      selectVisibleActorScopeFolders: GarbAndGrimeSettings.onSelectVisibleActorScopeFolders,
      clearActorScopeFolders: GarbAndGrimeSettings.onClearActorScopeFolders
    }
  };

  static PARTS = { main: { template: `modules/${MODULE_ID}/templates/settings-hub.hbs` } };

  constructor(options = {}) {
    super(options);
    this.activeTab = options.activeTab ?? "general";
  }

  async _prepareContext() {
    const activeTab = this.activeTab;
    const configuration = getConfiguration();
    let permissions = null;
    let methods = [];
    let profiles = [];
    let contaminations = [];
    let permissionRows = [];
    let userOverrideRows = [];
    let adapters = [];
    let actorFolderRows = [];

    if (activeTab === "general") {
      const selectedFolders = new Set(Array.isArray(configuration.general.dashboardActorFolderIds) ? configuration.general.dashboardActorFolderIds : []);
      actorFolderRows = buildActorFolderOptions({ includeRoot: false }).map((entry) => ({
        ...entry,
        selected: selectedFolders.has(entry.id)
      }));
    }

    if (activeTab === "cleaning") {
      methods = (game.settings.get(MODULE_ID, SETTINGS.CLEANING_METHODS) ?? []).map(prepareMethod);
    }
    if (activeTab === "contexts") {
      profiles = (game.settings.get(MODULE_ID, SETTINGS.PROFILES) ?? []).map((profile, index) => ({
        ...profile,
        index,
        removable: profile.id.startsWith("custom-"),
        label: label(profile),
        descriptionText: profile.descriptionKey ? game.i18n.localize(profile.descriptionKey) : profile.description ?? "",
        socialJson: JSON.stringify(profile.social ?? {}, null, 2),
        trackingJson: JSON.stringify(profile.tracking ?? {}, null, 2),
        narrativeText: profile.narrativeKey ? game.i18n.localize(profile.narrativeKey) : profile.narrative ?? "",
        settlementTypesText: (profile.settlementTypes ?? []).join(", "),
        serviceText: (profile.serviceAvailability ?? []).join(", "),
        contaminationText: (profile.automaticContamination ?? []).join(", "),
        levelRatingRows: ratingsForProfileEditor(profile).map((rating, level) => {
          return {
            level,
            rating,
            expected: rating === "expected",
            accepted: rating === "accepted",
            tolerated: rating === "tolerated",
            disliked: rating === "disliked",
            hated: rating === "hated"
          };
        })
      }));
      contaminations = (game.settings.get(MODULE_ID, SETTINGS.CONTAMINATIONS) ?? []).map((entry, index) => ({
        ...entry,
        index,
        removable: entry.id.startsWith("custom-"),
        label: label(entry)
      }));
    }

    if (activeTab === "permissions") {
      permissions = getPermissionsSetting();
      const permissionIds = Object.values(PERMISSIONS);
      permissionRows = permissionIds.map((id) => ({
        id,
        label: game.i18n.localize(`GAG.Permissions.${id}`),
        value: permissions.roleMinimums[id] ?? 4
      }));
      userOverrideRows = game.users.filter((user) => !user.isGM).map((user) => ({
        id: user.id,
        name: user.name,
        permissions: permissionIds.map((id) => {
          const value = permissions.userOverrides?.[user.id]?.[id];
          return {
            id,
            label: game.i18n.localize(`GAG.Permissions.${id}`),
            value: value === true ? "allow" : value === false ? "deny" : "inherit",
            inherit: typeof value !== "boolean",
            allow: value === true,
            deny: value === false
          };
        })
      }));
    }
    if (activeTab === "currency") {
      adapters = services.registry.listCurrencyAdapters({ clone: false }).map((adapter) => ({
        ...adapter,
        selected: adapter.id === configuration.currency.adapterId
      }));
    }

    return {
      activeTab,
      tabs: ["general", "automation", "cleaning", "upkeep", "rolls", "contexts", "sheets", "permissions", "currency", "debug"].map((id) => ({
        id,
        label: game.i18n.localize(`GAG.SettingsHub.Tabs.${id}`),
        active: activeTab === id
      })),
      configuration,
      localization: activeTab === "general" ? getLocalizationStatus() : null,
      actorFolderRows,
      selectedActorFolderCount: actorFolderRows.filter((entry) => entry.selected).length,
      tokenLabelsVisible: activeTab === "sheets" ? services.tokenLabelService.isGlobalVisible() : false,
      tokenLabelsManual: activeTab === "sheets" ? configuration.tokenLabels.visibilityMode === "manual" : false,
      methods,
      profiles,
      contaminations,
      permissions,
      permissionRows,
      userOverrideRows,
      adapters
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this._gagSettingsListeners?.abort();
    this._gagSettingsListeners = new AbortController();
    const signal = this._gagSettingsListeners.signal;
    const search = this.element.querySelector("[data-gag-actor-scope-folder-search]");
    const rows = [...this.element.querySelectorAll("[data-gag-actor-scope-folder-row]")];
    search?.addEventListener("input", () => {
      const query = search.value.trim().toLocaleLowerCase();
      for (const row of rows) row.hidden = Boolean(query) && !String(row.dataset.gagActorScopeSearch ?? "").includes(query);
    }, { signal });
    this.element.addEventListener("change", (event) => {
      if (event.target?.matches?.("[data-gag-actor-scope-folder]")) refreshActorScopeSelectionCount(this.element);
    }, { signal });
  }

  async _onClose(options) {
    this._gagSettingsListeners?.abort();
    this._gagSettingsListeners = null;
    return super._onClose(options);
  }

  static onSwitchTab(event, target) {
    event.preventDefault();
    this.activeTab = target.dataset.tab;
    this.render({ force: true });
  }

  static async onSaveConfiguration(event, target) {
    const form = target.closest("form") ?? this.element.querySelector(`form[data-category="${target.dataset.category}"]`);
    if (!form) return;
    const data = Object.fromEntries(new FormData(form).entries());
    const previousConfiguration = deepClone(getConfiguration());
    const configuration = deepClone(previousConfiguration);
    const category = target.dataset.category;
    if (category === "general") {
      const compiled = compileActorScopeRegex(data["general.dashboardActorRegex"]);
      if (compiled.error) {
        ui.notifications.error(game.i18n.format("GAG.Errors.InvalidActorScopeRegex", { pattern: compiled.source }));
        return;
      }
      configuration.general.dashboardActorFolderIds = [...form.querySelectorAll("[data-gag-actor-scope-folder]:checked")].map((input) => input.value);
    }
    const booleans = new Set([...form.querySelectorAll("input[type=checkbox][name]")].map((input) => input.name));
    const numbers = new Set([...form.querySelectorAll("input[type=number]")].map((input) => input.name));
    if (category === "cleaning") {
      const requestedQuantity = Number(data["cleaning.soapQuantity"]);
      if (!Number.isSafeInteger(requestedQuantity) || requestedQuantity < 1 || requestedQuantity > 100) {
        ui.notifications.error(game.i18n.localize("GAG.SettingsHub.Cleaning.InvalidSoapQuantity"));
        return;
      }
    }
    for (const input of form.querySelectorAll("input[type=checkbox][name]")) data[input.name] = input.checked;
    for (const [path, raw] of Object.entries(data)) {
      let value = raw;
      if (booleans.has(path)) value = Boolean(raw);
      else if (numbers.has(path)) value = Number(raw);
      else if (path.endsWith("supportedActorTypes") || path.endsWith("skills")) value = String(raw).split(",").map((entry) => entry.trim()).filter(Boolean);
      foundry.utils.setProperty(configuration, path, value);
    }
    await setConfiguration(configuration);
    if (category === "general") services.refreshManager?.({ invalidateActors: false });
    if (category === "sheets") {
      services.tokenLabelService.refreshAll();
      // Scene/Token Control availability is determined when Foundry renders
      // its toolbar. Saving the toggle or label display policy must update
      // that toolbar immediately, without needing a canvas/scene reload.
      const sceneControlsChanged = JSON.stringify(previousConfiguration.sceneControls ?? {}) !== JSON.stringify(configuration.sceneControls ?? {});
      const labelControlsChanged = previousConfiguration.tokenLabels?.enabled !== configuration.tokenLabels?.enabled
        || previousConfiguration.tokenLabels?.visibilityMode !== configuration.tokenLabels?.visibilityMode;
      if (sceneControlsChanged || labelControlsChanged) ui.controls?.render?.();
    } else if (category === "general") services.tokenLabelService.scheduleRefreshAll();
    const effectsChanged = JSON.stringify(previousConfiguration.effects ?? {}) !== JSON.stringify(configuration.effects ?? {});
    if (category === "sheets" && effectsChanged) await services.stateService.refreshAllEffects();
    if (foundry.utils.hasProperty(configuration, "debugging.enabled")) await game.settings.set(MODULE_ID, SETTINGS.DEBUG, Boolean(configuration.debugging.enabled));
    ui.notifications.info(game.i18n.localize("GAG.Notifications.SettingsSaved"));
    scheduleApplicationRender(this);
  }

  static async onSaveMethods() {
    const form = this.element.querySelector("form[data-methods-form]");
    const data = new FormData(form);
    const current = deepClone(game.settings.get(MODULE_ID, SETTINGS.CLEANING_METHODS) ?? []);
    const methods = current.map((method, index) => {
      const prefix = `methods.${index}.`;
      const value = deepClone(method);
      value.name = String(data.get(`${prefix}name`) ?? value.name ?? label(value));
      delete value.nameKey;
      value.enabled = data.get(`${prefix}enabled`) === "on";
      value.playerUsable = data.get(`${prefix}playerUsable`) === "on";
      value.cost.amount = Number(data.get(`${prefix}costAmount`) ?? 0);
      value.cost.currency = String(data.get(`${prefix}currency`) ?? "Mark");
      value.time.value = Number(data.get(`${prefix}timeValue`) ?? 0);
      value.time.unit = String(data.get(`${prefix}timeUnit`) ?? "minute");
      value.effect.mode = String(data.get(`${prefix}effectMode`) ?? "set");
      value.effect.level = Number(data.get(`${prefix}effectLevel`) ?? 0);
      value.effect.amount = Number(data.get(`${prefix}effectAmount`) ?? 1);
      value.effect.body = data.get(`${prefix}body`) === "on";
      value.effect.clothing = data.get(`${prefix}clothing`) === "on";
      const requiredItems = String(data.get(`${prefix}requiredItems`) ?? "").split(",").map((entry) => entry.trim()).filter(Boolean).map((integrationId) => ({ integrationId, quantity: 1, optional: false }));
      const optionalItems = String(data.get(`${prefix}optionalItems`) ?? "").split(",").map((entry) => entry.trim()).filter(Boolean).map((integrationId) => ({ integrationId, quantity: 1, optional: true }));
      value.itemRequirements = [...requiredItems, ...optionalItems];
      value.settlementTypes = String(data.get(`${prefix}settlements`) ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
      const temporaryId = String(data.get(`${prefix}temporaryId`) ?? "").trim();
      value.temporaryEffects = temporaryId ? [{ id: temporaryId, durationSeconds: Number(data.get(`${prefix}temporaryDuration`) ?? 0) }] : [];
      validateMethod(value);
      return value;
    });
    await game.settings.set(MODULE_ID, SETTINGS.CLEANING_METHODS, methods);
    services.reloadWorldDefinitions();
    ui.notifications.info(game.i18n.localize("GAG.Notifications.SettingsSaved"));
    scheduleApplicationRender(this);
  }

  static async onSaveProfiles() {
    const form = this.element.querySelector("form[data-profiles-form]");
    const data = new FormData(form);
    const current = deepClone(game.settings.get(MODULE_ID, SETTINGS.PROFILES) ?? []);
    const profiles = current.map((profile, index) => {
      const prefix = `profiles.${index}.`;
      const value = deepClone(profile);
      value.name = String(data.get(`${prefix}name`) ?? label(value));
      delete value.nameKey;
      value.description = String(data.get(`${prefix}description`) ?? value.description ?? "");
      delete value.descriptionKey;
      value.expected = { min: Number(data.get(`${prefix}expectedMin`) ?? 0), max: Number(data.get(`${prefix}expectedMax`) ?? 3) };
      value.levelRatings = [0, 1, 2, 3].map((level) => {
        const rating = String(data.get(`${prefix}rating.${level}`) ?? "expected");
        return SCENE_LEVEL_RATINGS.includes(rating) ? rating : "expected";
      });
      value.levelRatingsSource = "custom";
      value.automaticDirtGain = Number(data.get(`${prefix}automaticDirtGain`) ?? 0);
      value.settlementTypes = String(data.get(`${prefix}settlementTypes`) ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
      value.serviceAvailability = String(data.get(`${prefix}services`) ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
      value.automaticContamination = String(data.get(`${prefix}contaminations`) ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
      try { value.social = JSON.parse(String(data.get(`${prefix}socialJson`) ?? "{}")); } catch { throw new Error(game.i18n.localize("GAG.Errors.InvalidSocialJson")); }
      try { value.tracking = JSON.parse(String(data.get(`${prefix}trackingJson`) ?? "{}")); } catch { throw new Error(game.i18n.localize("GAG.Errors.InvalidTrackingJson")); }
      value.narrative = String(data.get(`${prefix}narrative`) ?? "");
      delete value.narrativeKey;
      validateProfile(value);
      return value;
    });
    await game.settings.set(MODULE_ID, SETTINGS.PROFILES, profiles);
    services.reloadWorldDefinitions();
    ui.notifications.info(game.i18n.localize("GAG.Notifications.SettingsSaved"));
    scheduleApplicationRender(this);
  }

  static async onSaveContaminations() {
    const form = this.element.querySelector("form[data-contaminations-form]");
    const data = new FormData(form);
    const current = deepClone(game.settings.get(MODULE_ID, SETTINGS.CONTAMINATIONS) ?? []);
    const definitions = current.map((entry, index) => {
      const prefix = `contaminations.${index}.`;
      const value = deepClone(entry);
      value.name = String(data.get(`${prefix}name`) ?? label(value));
      delete value.nameKey;
      value.effectivePenalty = Number(data.get(`${prefix}effectivePenalty`) ?? 0);
      value.scent = data.get(`${prefix}scent`) === "on";
      value.hiddenByDefault = data.get(`${prefix}hiddenByDefault`) === "on";
      value.createEffect = data.get(`${prefix}createEffect`) === "on";
      validateContamination(value);
      return value;
    });
    await game.settings.set(MODULE_ID, SETTINGS.CONTAMINATIONS, definitions);
    services.reloadWorldDefinitions();
    ui.notifications.info(game.i18n.localize("GAG.Notifications.SettingsSaved"));
    scheduleApplicationRender(this);
  }

  static async onSavePermissions() {
    const form = this.element.querySelector("form[data-permissions-form]");
    const data = new FormData(form);
    const permissions = deepClone(getPermissionsSetting());
    for (const id of Object.values(PERMISSIONS)) permissions.roleMinimums[id] = Number(data.get(`permission.${id}`) ?? 4);
    permissions.userOverrides = {};
    for (const user of game.users.filter((entry) => !entry.isGM)) {
      const overrides = {};
      for (const id of Object.values(PERMISSIONS)) {
        const value = String(data.get(`userOverride.${user.id}.${id}`) ?? "inherit");
        if (value === "allow") overrides[id] = true;
        else if (value === "deny") overrides[id] = false;
      }
      if (Object.keys(overrides).length) permissions.userOverrides[user.id] = overrides;
    }
    await game.settings.set(MODULE_ID, SETTINGS.PERMISSIONS, permissions);
    ui.notifications.info(game.i18n.localize("GAG.Notifications.SettingsSaved"));
    scheduleApplicationRender(this);
  }

  static async onResetCategory(event, target) {
    const category = target.dataset.category;
    const confirmed = await foundry.applications.api.DialogV2.confirm({ window: { title: game.i18n.localize("GAG.Confirm.ResetCategoryTitle") }, content: `<p>${foundry.utils.escapeHTML(game.i18n.localize("GAG.Confirm.ResetCategoryText"))}</p>` });
    if (!confirmed) return;
    if (category === "methods") await game.settings.set(MODULE_ID, SETTINGS.CLEANING_METHODS, deepClone(DEFAULT_CLEANING_METHODS));
    else if (category === "profiles") await game.settings.set(MODULE_ID, SETTINGS.PROFILES, deepClone(DEFAULT_ENVIRONMENT_PROFILES));
    else if (category === "contaminations") await game.settings.set(MODULE_ID, SETTINGS.CONTAMINATIONS, deepClone(DEFAULT_CONTAMINATIONS));
    else if (category === "permissions") await game.settings.set(MODULE_ID, SETTINGS.PERMISSIONS, deepClone(DEFAULT_PERMISSIONS));
    else await setConfiguration(deepClone(DEFAULT_CONFIGURATION));
    services.reloadWorldDefinitions();
    if (category === "configuration") {
      services.tokenLabelService.refreshAll();
      await services.stateService.refreshAllEffects();
    }
    scheduleApplicationRender(this);
  }

  static async onToggleTokenLabels() {
    await services.tokenLabelService.toggleGlobalVisibility({ notify: true });
    scheduleApplicationRender(this);
  }

  static async onSetPartyMaintenance(event, target) {
    const enabled = target.dataset.enabled === "true";
    const actors = game.actors.filter((actor) => actor.type === "character");
    await mapWithConcurrency(actors, (actor) => services.stateService.setAutomaticMaintenance(actor, enabled, {
      system: true,
      reason: game.i18n.localize("GAG.Actions.ToggleMaintenance")
    }));
    ui.notifications.info(game.i18n.format("GAG.Notifications.PartyMaintenanceSet", { count: actors.length, state: enabled ? game.i18n.localize("GAG.Common.Enabled") : game.i18n.localize("GAG.Common.Disabled") }));
    services.openManager()?.render({ force: true });
  }

  static onSelectVisibleActorScopeFolders() {
    this.element.querySelectorAll("[data-gag-actor-scope-folder-row]:not([hidden]) [data-gag-actor-scope-folder]").forEach((input) => { input.checked = true; });
    refreshActorScopeSelectionCount(this.element);
  }

  static onClearActorScopeFolders() {
    this.element.querySelectorAll("[data-gag-actor-scope-folder]").forEach((input) => { input.checked = false; });
    refreshActorScopeSelectionCount(this.element);
  }

  static onOpenManager() { services.openManager(); }

  static onOpenSceneGuide() {
    void services.openSceneGuide().catch((error) => {
      console.error(`[${MODULE_ID}] Failed to open the Scene cleanliness guide.`, error);
      ui.notifications.error(error?.message ?? game.i18n.localize("GAG.Errors.Unexpected"));
    });
  }

  static async onAddMethod() {
    const methods = deepClone(game.settings.get(MODULE_ID, SETTINGS.CLEANING_METHODS) ?? []);
    const id = nextCustomId("custom-method", methods);
    methods.push({ id, name: game.i18n.localize("GAG.Common.NewMethod"), time: { value: 30, unit: "minute" }, cost: { amount: 0, currency: "Mark" }, effect: { mode: "set", level: 0, body: true, clothing: true }, temporaryEffects: [], itemRequirements: [], settlementTypes: ["any"], playerUsable: false, enabled: true });
    await game.settings.set(MODULE_ID, SETTINGS.CLEANING_METHODS, methods);
    services.reloadWorldDefinitions();
    scheduleApplicationRender(this);
  }

  static async onAddProfile() {
    const profiles = deepClone(game.settings.get(MODULE_ID, SETTINGS.PROFILES) ?? []);
    const id = nextCustomId("custom-profile", profiles);
    profiles.push({ id, name: game.i18n.localize("GAG.Common.NewProfile"), description: "", expected: { min: 0, max: 3 }, levelRatings: ["expected", "accepted", "accepted", "disliked"], settlementTypes: [], serviceAvailability: [], automaticDirtGain: 0, social: {}, tracking: {}, narrativeKey: "" });
    await game.settings.set(MODULE_ID, SETTINGS.PROFILES, profiles);
    services.reloadWorldDefinitions();
    scheduleApplicationRender(this);
  }

  static async onAddContamination() {
    const definitions = deepClone(game.settings.get(MODULE_ID, SETTINGS.CONTAMINATIONS) ?? []);
    const id = nextCustomId("custom-contamination", definitions);
    definitions.push({ id, name: game.i18n.localize("GAG.Common.NewContamination"), icon: "assets/icons/chemical.svg", effectivePenalty: 1, scent: true, hiddenByDefault: false, createEffect: false });
    await game.settings.set(MODULE_ID, SETTINGS.CONTAMINATIONS, definitions);
    services.reloadWorldDefinitions();
    scheduleApplicationRender(this);
  }

  static async onRemoveDefinition(event, target) {
    const kind = target.dataset.kind;
    const id = target.dataset.id;
    const setting = kind === "method" ? SETTINGS.CLEANING_METHODS : kind === "profile" ? SETTINGS.PROFILES : SETTINGS.CONTAMINATIONS;
    const current = deepClone(game.settings.get(MODULE_ID, setting) ?? []);
    const definition = current.find((entry) => entry.id === id);
    if (!definition) return;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("GAG.Confirm.RemoveDefinitionTitle") },
      content: `<p>${foundry.utils.escapeHTML(game.i18n.format("GAG.Confirm.RemoveDefinitionText", { name: label(definition) }))}</p>`
    });
    if (!confirmed) return;
    const values = current.filter((entry) => entry.id !== id);
    await game.settings.set(MODULE_ID, setting, values);
    services.reloadWorldDefinitions();
    scheduleApplicationRender(this);
  }
}
