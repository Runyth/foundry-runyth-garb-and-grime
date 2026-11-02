import { MODULE_ID, SETTINGS } from "./constants.mjs";
import {
  DEFAULT_CLEANING_METHODS,
  DEFAULT_CONFIGURATION,
  DEFAULT_CONTAMINATIONS,
  DEFAULT_ENVIRONMENT_PROFILES,
  DEFAULT_PERMISSIONS
} from "./defaults.mjs";
import { deepClone } from "./domain/state.mjs";

let configurationCache = null;
let configurationSource = null;
let configurationFingerprint = null;
let permissionsCache = null;
let permissionsSource = null;
let permissionsFingerprint = null;

function register(key, options) {
  game.settings.register(MODULE_ID, key, options);
}

function canTrustRegisteredOnChange(key) {
  const registry = game.settings?.settings;
  return Boolean(registry?.has?.(`${MODULE_ID}.${key}`));
}

function fallbackFingerprint(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

export function registerSettings({ managerClass, settingsClass }) {
  register(SETTINGS.CONFIG, {
    name: "GAG.Settings.Configuration.Name",
    scope: "world",
    config: false,
    type: Object,
    default: deepClone(DEFAULT_CONFIGURATION),
    onChange: () => invalidateSettingsCache(SETTINGS.CONFIG)
  });
  register(SETTINGS.CLEANING_METHODS, {
    name: "GAG.Settings.CleaningMethods.Name",
    scope: "world",
    config: false,
    type: Array,
    default: deepClone(DEFAULT_CLEANING_METHODS)
  });
  register(SETTINGS.CONTAMINATIONS, {
    name: "GAG.Settings.Contaminations.Name",
    scope: "world",
    config: false,
    type: Array,
    default: deepClone(DEFAULT_CONTAMINATIONS)
  });
  register(SETTINGS.PROFILES, {
    name: "GAG.Settings.Profiles.Name",
    scope: "world",
    config: false,
    type: Array,
    default: deepClone(DEFAULT_ENVIRONMENT_PROFILES)
  });
  register(SETTINGS.PROFILE_RATINGS_VERSION, {
    name: "GAG.Settings.Profiles.Name",
    scope: "world",
    config: false,
    type: Number,
    default: 0
  });
  register(SETTINGS.PERMISSIONS, {
    name: "GAG.Settings.Permissions.Name",
    scope: "world",
    config: false,
    type: Object,
    default: deepClone(DEFAULT_PERMISSIONS),
    onChange: () => invalidateSettingsCache(SETTINGS.PERMISSIONS)
  });
  register(SETTINGS.TRANSACTION_LOG, {
    name: "GAG.Settings.TransactionLog.Name",
    scope: "world",
    config: false,
    type: Array,
    default: []
  });
  register(SETTINGS.LAST_WORLD_DAY, {
    name: "GAG.Settings.LastWorldDay.Name",
    scope: "world",
    config: false,
    type: Number,
    default: -1
  });
  register(SETTINGS.UI_STATE, {
    name: "GAG.Settings.UiState.Name",
    scope: "client",
    config: false,
    type: Object,
    default: { activeTab: "overview", search: "", searchMode: "text", folderId: "all", includeSubfolders: true, actorType: "all", selectionMode: "all", level: "all", sort: "name", direction: "asc", actorPage: 1, actorPageSize: 40, selectedActorUuids: [] }
  });
  register(SETTINGS.WINDOW_STATE, {
    name: "GAG.Settings.WindowState.Name",
    scope: "client",
    config: false,
    type: Object,
    default: {}
  });
  register(SETTINGS.LAST_SEEN_VERSION, {
    name: "GAG.Settings.LastSeenVersion.Name",
    scope: "client",
    config: false,
    type: String,
    default: ""
  });
  register(SETTINGS.TOKEN_LABELS_VERSION, {
    name: "GAG.Settings.TokenLabelsVisible.Name",
    scope: "world",
    config: false,
    type: Number,
    default: 0
  });
  register(SETTINGS.CHAT_PERMISSIONS_VERSION, {
    name: "GAG.Settings.Permissions.Name",
    scope: "world",
    config: false,
    type: Number,
    default: 0
  });
  register(SETTINGS.TOKEN_LABELS_VISIBLE, {
    name: "GAG.Settings.TokenLabelsVisible.Name",
    scope: "client",
    config: false,
    type: Boolean,
    default: false
  });
  register(SETTINGS.TOKEN_LABEL_VIEW_MODE, {
    name: "GAG.Settings.TokenLabelViewerMode.Name",
    hint: "GAG.Settings.TokenLabelViewerMode.Hint",
    scope: "client",
    config: false,
    type: String,
    default: "inherit"
  });
  register(SETTINGS.TOKEN_LABEL_VIEW_POSITION, {
    name: "GAG.Settings.TokenLabelViewerPosition.Name",
    hint: "GAG.Settings.TokenLabelViewerPosition.Hint",
    scope: "client",
    config: false,
    type: String,
    default: "inherit"
  });
  register(SETTINGS.SCENE_GUIDE_VISIBLE, {
    name: "GAG.Settings.SceneGuideVisible.Name",
    scope: "client",
    config: false,
    type: Boolean,
    default: false
  });
  register(SETTINGS.DEBUG, {
    name: "GAG.Settings.Debug.Name",
    hint: "GAG.Settings.Debug.Hint",
    scope: "world",
    config: true,
    restricted: true,
    type: Boolean,
    default: false
  });

  game.settings.registerMenu(MODULE_ID, "openManager", {
    name: "GAG.Settings.OpenManager.Name",
    label: "GAG.Settings.OpenManager.Label",
    hint: "GAG.Settings.OpenManager.Hint",
    icon: "fa-solid fa-shirt",
    type: managerClass,
    restricted: false
  });

  game.settings.registerMenu(MODULE_ID, "configurationHub", {
    name: "GAG.Settings.ConfigurationHub.Name",
    label: "GAG.Settings.ConfigurationHub.Label",
    hint: "GAG.Settings.ConfigurationHub.Hint",
    icon: "fa-solid fa-sliders",
    type: settingsClass,
    restricted: true
  });
}

export function getConfiguration() {
  const source = game.settings.get(MODULE_ID, SETTINGS.CONFIG) ?? {};
  const trustOnChange = canTrustRegisteredOnChange(SETTINGS.CONFIG);
  const fingerprint = trustOnChange ? null : fallbackFingerprint(source);
  const cacheValid = configurationCache
    && source === configurationSource
    && (trustOnChange || fingerprint === configurationFingerprint);
  if (!cacheValid) {
    configurationSource = source;
    configurationFingerprint = fingerprint;
    configurationCache = foundry.utils.mergeObject(deepClone(DEFAULT_CONFIGURATION), source, {
      inplace: false,
      insertKeys: true,
      insertValues: true,
      overwrite: true
    });
  }
  return configurationCache;
}

export async function setConfiguration(configuration) {
  // Invalidate before the write so callers which repaint immediately after an
  // awaited save cannot observe the previous merged configuration while the
  // Foundry onChange callback is still queued. Invalidate again after the
  // write to remain correct for custom settings backends which mutate or reuse
  // the stored object identity.
  invalidateSettingsCache(SETTINGS.CONFIG);
  const result = await game.settings.set(MODULE_ID, SETTINGS.CONFIG, configuration);
  invalidateSettingsCache(SETTINGS.CONFIG);
  return result;
}

export function getPermissionsSetting() {
  const source = game.settings.get(MODULE_ID, SETTINGS.PERMISSIONS) ?? {};
  const trustOnChange = canTrustRegisteredOnChange(SETTINGS.PERMISSIONS);
  const fingerprint = trustOnChange ? null : fallbackFingerprint(source);
  const cacheValid = permissionsCache
    && source === permissionsSource
    && (trustOnChange || fingerprint === permissionsFingerprint);
  if (!cacheValid) {
    permissionsSource = source;
    permissionsFingerprint = fingerprint;
    permissionsCache = foundry.utils.mergeObject(deepClone(DEFAULT_PERMISSIONS), source, {
      inplace: false,
      insertKeys: true,
      insertValues: true,
      overwrite: true
    });
  }
  return permissionsCache;
}

export function invalidateSettingsCache(key = null) {
  if (!key || key === SETTINGS.CONFIG) {
    configurationCache = null;
    configurationSource = null;
    configurationFingerprint = null;
  }
  if (!key || key === SETTINGS.PERMISSIONS) {
    permissionsCache = null;
    permissionsSource = null;
    permissionsFingerprint = null;
  }
}
