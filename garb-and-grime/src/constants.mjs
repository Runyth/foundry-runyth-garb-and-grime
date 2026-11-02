export const MODULE_ID = "garb-and-grime";
export const MODULE_TITLE = "Garb & Grime";
export const MODULE_VERSION = "1.2.9";
export const API_VERSION = "1.3.0";
export const SCHEMA_VERSION = 1;
export const SOCKET_NAME = `module.${MODULE_ID}`;

export const FLAGS = Object.freeze({
  STATE: "state",
  SCENE_CONTEXT: "context",
  SCENE_GUIDE: "sceneGuide",
  ITEM_INTEGRATION: "itemIntegration",
  EFFECT_KIND: "effectKind",
  TOKEN_LABEL_MODE: "tokenLabelMode",
  TOKEN_LABEL_POSITION: "tokenLabelPosition"
});

export const SETTINGS = Object.freeze({
  CONFIG: "configuration",
  CLEANING_METHODS: "cleaningMethods",
  CONTAMINATIONS: "contaminations",
  PROFILES: "environmentProfiles",
  PROFILE_RATINGS_VERSION: "profileRatingsVersion",
  PERMISSIONS: "permissions",
  UI_STATE: "uiState",
  WINDOW_STATE: "windowState",
  TRANSACTION_LOG: "transactionLog",
  LAST_WORLD_DAY: "lastWorldDay",
  LAST_SEEN_VERSION: "lastSeenVersion",
  TOKEN_LABELS_VISIBLE: "tokenLabelsVisible",
  TOKEN_LABEL_VIEW_MODE: "tokenLabelViewerMode",
  TOKEN_LABEL_VIEW_POSITION: "tokenLabelViewerPosition",
  TOKEN_LABELS_VERSION: "tokenLabelsVersion",
  CHAT_PERMISSIONS_VERSION: "chatPermissionsVersion",
  SCENE_GUIDE_VISIBLE: "sceneGuideVisible",
  DEBUG: "debug"
});

export const PERMISSIONS = Object.freeze({
  VIEW_OWN: "viewOwn",
  MODIFY_OWN_ACTIONS: "modifyOwnActions",
  USE_SERVICES: "useServices",
  CONSUME_ITEMS: "consumeItems",
  CHANGE_CLOTHES: "changeClothes",
  VIEW_PARTY: "viewParty",
  VIEW_TOKEN_LABELS: "viewTokenLabels",
  VIEW_CLEANING_CHAT: "viewCleaningChat",
  VIEW_STATE_CHAT: "viewStateChat",
  MODIFY_OTHERS: "modifyOthers",
  CONFIGURE_CONTEXTS: "configureContexts",
  MANAGE_METHODS: "manageMethods",
  MANAGE_SETTINGS: "manageSettings",
  VIEW_GM_DETAILS: "viewGmDetails"
});

export const HOOKS = Object.freeze({
  API_READY: `${MODULE_ID}.apiReady`,
  PRE_STATE_CHANGE: `${MODULE_ID}.preStateChange`,
  STATE_CHANGED: `${MODULE_ID}.stateChanged`,
  PRE_CLEAN: `${MODULE_ID}.preCleanActor`,
  CLEANED: `${MODULE_ID}.actorCleaned`,
  PRE_CONTAMINATION: `${MODULE_ID}.preApplyContamination`,
  CONTAMINATION_APPLIED: `${MODULE_ID}.contaminationApplied`,
  CONTEXT_CHANGED: `${MODULE_ID}.contextChanged`,
  MAINTENANCE_PROCESSED: `${MODULE_ID}.maintenanceProcessed`,
  ROLL_EVALUATED: `${MODULE_ID}.rollEvaluated`
});

export const DIRT_LEVELS = Object.freeze([0, 1, 2, 3]);
export const ACTOR_TYPES = Object.freeze(["character", "npc"]);

export const SCENE_LEVEL_RATINGS = Object.freeze(["expected", "accepted", "tolerated", "disliked", "hated"]);
