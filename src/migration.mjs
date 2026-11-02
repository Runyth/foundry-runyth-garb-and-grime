import { MODULE_ID, PERMISSIONS, SETTINGS } from "./constants.mjs";
import { DEFAULT_ENVIRONMENT_PROFILES } from "./defaults.mjs";
import { normalizeLevelRatings } from "./context-service.mjs";
import { deepClone } from "./domain/state.mjs";
import { mapWithConcurrency } from "./util.mjs";

const PROFILE_RATINGS_VERSION = 1;
const TOKEN_LABELS_VERSION = 3;
const CHAT_PERMISSIONS_VERSION = 1;
const ALL_EXPECTED = Object.freeze(["expected", "expected", "expected", "expected"]);
const LEGACY_PRESET_RATINGS = new Map([
  ["ordinary", ["accepted", "expected", "accepted", "disliked"]],
  ["religious", ["expected", "accepted", "disliked", "hated"]],
  ["swamp", ["hated", "disliked", "accepted", "expected"]],
  ["battlefield", ["hated", "disliked", "accepted", "expected"]]
]);

function sameRatings(left, right) {
  return Array.isArray(left) && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

export async function runMigrations(stateService) {
  if (!game.user.isGM) return { migrated: 0, profileRatingsMigrated: 0, tokenLabelsMigrated: false, chatPermissionsMigrated: false, definitionsChanged: false };
  const profileMigration = await migrateProfileRatings();
  const tokenLabelMigration = await migrateTokenLabelSettings();
  const chatPermissionsMigration = await migrateChatPermissions();
  const results = await mapWithConcurrency(game.actors, (actor) => stateService.migrateActor(actor));
  return {
    migrated: results.filter((result) => result.migrated).length,
    profileRatingsMigrated: profileMigration.migrated,
    tokenLabelsMigrated: tokenLabelMigration.changed,
    chatPermissionsMigrated: chatPermissionsMigration.changed,
    definitionsChanged: profileMigration.changed
  };
}


export async function migrateChatPermissions() {
  if (!game.user.isGM) return { changed: false };
  const currentVersion = Number(game.settings.get(MODULE_ID, SETTINGS.CHAT_PERMISSIONS_VERSION) ?? 0);
  if (currentVersion >= CHAT_PERMISSIONS_VERSION) return { changed: false };

  const rawConfiguration = deepClone(game.settings.get(MODULE_ID, SETTINGS.CONFIG) ?? {});
  const rawPermissions = deepClone(game.settings.get(MODULE_ID, SETTINGS.PERMISSIONS) ?? {});
  rawPermissions.roleMinimums ??= {};
  rawPermissions.userOverrides ??= {};
  let configurationChanged = false;
  let permissionsChanged = false;

  // Chat routing used to be configured independently through configuration.chat.
  // Permissions are now the single source of truth, so remove the legacy branch.
  if (Object.hasOwn(rawConfiguration, "chat")) {
    delete rawConfiguration.chat;
    configurationChanged = true;
  }
  if (!Number.isFinite(Number(rawPermissions.roleMinimums[PERMISSIONS.VIEW_CLEANING_CHAT]))) {
    rawPermissions.roleMinimums[PERMISSIONS.VIEW_CLEANING_CHAT] = 1;
    permissionsChanged = true;
  }
  if (!Number.isFinite(Number(rawPermissions.roleMinimums[PERMISSIONS.VIEW_STATE_CHAT]))) {
    rawPermissions.roleMinimums[PERMISSIONS.VIEW_STATE_CHAT] = 4;
    permissionsChanged = true;
  }

  if (configurationChanged) await game.settings.set(MODULE_ID, SETTINGS.CONFIG, rawConfiguration);
  if (permissionsChanged) await game.settings.set(MODULE_ID, SETTINGS.PERMISSIONS, rawPermissions);
  await game.settings.set(MODULE_ID, SETTINGS.CHAT_PERMISSIONS_VERSION, CHAT_PERMISSIONS_VERSION);
  return { changed: configurationChanged || permissionsChanged };
}


export async function migrateTokenLabelSettings() {
  if (!game.user.isGM) return { changed: false };
  const currentVersion = Number(game.settings.get(MODULE_ID, SETTINGS.TOKEN_LABELS_VERSION) ?? 0);
  if (currentVersion >= TOKEN_LABELS_VERSION) return { changed: false };

  const rawConfiguration = deepClone(game.settings.get(MODULE_ID, SETTINGS.CONFIG) ?? {});
  const rawPermissions = deepClone(game.settings.get(MODULE_ID, SETTINGS.PERMISSIONS) ?? {});
  rawConfiguration.tokenLabels ??= {};
  rawPermissions.roleMinimums ??= {};
  rawPermissions.userOverrides ??= {};

  let configurationChanged = false;
  let permissionsChanged = false;
  const legacyAudience = String(rawConfiguration.tokenLabels.audience ?? "gm");

  if (!rawConfiguration.tokenLabels.visibilityMode) {
    rawConfiguration.tokenLabels.visibilityMode = "manual";
    configurationChanged = true;
  }
  if (!rawConfiguration.tokenLabels.actorScope) {
    rawConfiguration.tokenLabels.actorScope = "supported";
    configurationChanged = true;
  }
  if (!rawConfiguration.tokenLabels.playerScope) {
    rawConfiguration.tokenLabels.playerScope = legacyAudience === "owners" ? "owned" : legacyAudience === "everyone" ? "all" : "characters";
    configurationChanged = true;
  }
  // Player authorization is now exclusively controlled by Permissions.
  // The legacy "disabled" scope duplicated that authorization and could make an
  // explicitly permitted player unable to see labels, so normalize it to the
  // safe PC-only scope.
  if (rawConfiguration.tokenLabels.playerScope === "disabled") {
    rawConfiguration.tokenLabels.playerScope = "characters";
    configurationChanged = true;
  }

  // v3 adopts a smaller default label footprint. Only migrate the exact old
  // visual defaults so deliberate user styling is never overwritten.
  if (currentVersion < 3) {
    const labels = rawConfiguration.tokenLabels;
    const usesOldVisualDefaults = Number(labels.fontSize ?? 22) === 22
      && Number(labels.offset ?? 10) === 10
      && String(labels.fontColor ?? "#ffffff").toLowerCase() === "#ffffff"
      && String(labels.backgroundColor ?? "#111318").toLowerCase() === "#111318"
      && Number(labels.backgroundOpacity ?? 0.92) === 0.92
      && Number(labels.paddingX ?? 8) === 8
      && Number(labels.paddingY ?? 4) === 4;
    if (usesOldVisualDefaults) {
      labels.fontSize = 18;
      labels.offset = 8;
      labels.paddingX = 6;
      labels.paddingY = 3;
      configurationChanged = true;
    }
  }

  if (!Number.isFinite(Number(rawPermissions.roleMinimums[PERMISSIONS.VIEW_TOKEN_LABELS]))) {
    // Preserve legacy worlds which deliberately exposed labels to players while
    // making fresh/default GM-only worlds deny player visibility by default.
    rawPermissions.roleMinimums[PERMISSIONS.VIEW_TOKEN_LABELS] = legacyAudience === "owners" || legacyAudience === "everyone" ? 1 : 5;
    permissionsChanged = true;
  }

  if (configurationChanged) await game.settings.set(MODULE_ID, SETTINGS.CONFIG, rawConfiguration);
  if (permissionsChanged) await game.settings.set(MODULE_ID, SETTINGS.PERMISSIONS, rawPermissions);
  await game.settings.set(MODULE_ID, SETTINGS.TOKEN_LABELS_VERSION, TOKEN_LABELS_VERSION);
  return { changed: configurationChanged || permissionsChanged };
}

export async function migrateProfileRatings() {
  if (!game.user.isGM) return { migrated: 0, changed: false };
  const currentVersion = Number(game.settings.get(MODULE_ID, SETTINGS.PROFILE_RATINGS_VERSION) ?? 0);
  if (currentVersion >= PROFILE_RATINGS_VERSION) return { migrated: 0, changed: false };

  const defaultsById = new Map(DEFAULT_ENVIRONMENT_PROFILES.map((profile) => [profile.id, profile]));
  const profiles = deepClone(game.settings.get(MODULE_ID, SETTINGS.PROFILES) ?? []);
  let migrated = 0;

  for (const profile of profiles) {
    const preset = defaultsById.get(profile?.id);
    if (!preset || profile?.levelRatingsSource === "custom") continue;
    const ratings = normalizeLevelRatings(profile.levelRatings);
    const legacyAllExpected = sameRatings(ratings, ALL_EXPECTED);
    const legacyPreset = sameRatings(ratings, LEGACY_PRESET_RATINGS.get(profile.id));
    if (ratings && !legacyAllExpected && !legacyPreset) continue;
    profile.levelRatings = deepClone(preset.levelRatings);
    profile.levelRatingsSource = "preset";
    migrated += 1;
  }

  if (migrated > 0) await game.settings.set(MODULE_ID, SETTINGS.PROFILES, profiles);
  await game.settings.set(MODULE_ID, SETTINGS.PROFILE_RATINGS_VERSION, PROFILE_RATINGS_VERSION);
  return { migrated, changed: migrated > 0 };
}

export async function showFirstRunGuide(openManager, openSettings) {
  const module = game.modules.get(MODULE_ID);
  const last = game.settings.get(MODULE_ID, SETTINGS.LAST_SEEN_VERSION);
  if (last === module.version) return;
  await game.settings.set(MODULE_ID, SETTINGS.LAST_SEEN_VERSION, module.version);

  const content = `<section class="gag-first-run garb-and-grime">
    <h2>${escape(game.i18n.localize("GAG.FirstRun.Title"))}</h2>
    <p>${escape(game.i18n.localize("GAG.FirstRun.Text"))}</p>
    <ul>
      <li>${escape(game.i18n.localize("GAG.FirstRun.Entry1"))}</li>
      <li>${escape(game.i18n.localize("GAG.FirstRun.Entry2"))}</li>
      <li>${escape(game.i18n.localize("GAG.FirstRun.Entry3"))}</li>
    </ul>
  </section>`;

  try {
    const choice = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize("GAG.FirstRun.Title") },
      content,
      buttons: [
        {
          action: "manager",
          label: game.i18n.localize("GAG.Manager.Open"),
          icon: "fa-solid fa-shirt",
          default: true,
          callback: () => "manager"
        },
        {
          action: "settings",
          label: game.i18n.localize("GAG.FirstRun.OpenSettings"),
          icon: "fa-solid fa-sliders",
          callback: () => "settings"
        },
        {
          action: "close",
          label: game.i18n.localize("Close"),
          callback: () => null
        }
      ]
    });
    if (choice === "manager") openManager();
    if (choice === "settings") openSettings();
  } catch (error) {
    console.error(`[${MODULE_ID}] First-run guide failed.`, error);
    ui.notifications.info(game.i18n.localize("GAG.FirstRun.Text"), { permanent: true });
  }
}

function escape(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}
