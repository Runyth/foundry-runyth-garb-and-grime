// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import { PERMISSIONS, SCHEMA_VERSION } from "./constants.mjs";

export const DEFAULT_STATE = Object.freeze({
  schema: SCHEMA_VERSION,
  dirtLevel: 0,
  body: { level: 0, clean: true },
  clothing: { level: 0, clean: true },
  contaminations: [],
  lastIncrease: null,
  lastCleaning: null,
  lastChange: null,
  lastChangeReason: "",
  autoMaintenance: false,
  maintenanceExempt: false,
  maintenanceDebt: 0,
  masking: [],
  groomedUntil: null,
  gmNotes: "",
  lastDailyGainDay: null,
  lastMaintenanceDay: null,
  transactionLog: []
});

export const DEFAULT_CONFIGURATION = Object.freeze({
  general: {
    showSheetIndicator: true,
    showIndicatorToPlayers: true,
    supportedActorTypes: ["character", "npc"],
    dashboardActorRegex: "",
    dashboardActorFolderIds: [],
    dashboardActorIncludeSubfolders: true,
    firstRunGuide: true
  },
  automation: {
    longRestEnabled: false,
    longRestGain: 0,
    combatEndEnabled: false,
    combatEndGain: 1,
    worldDayEnabled: false,
    worldDayGain: 1,
    oncePerDay: true,
    extremeBypassesDailyLimit: true
  },
  dirtGain: {
    normal: 1,
    extreme: 2,
    quietDay: 0
  },
  cleaning: {
    requireSoap: false,
    consumeSoap: true,
    soapQuantity: 1
  },
  dailyUpkeep: {
    enabled: false,
    partyDefault: false,
    cost: 2,
    currency: "Mark",
    paymentMode: "record",
    automaticDeduction: false,
    promptBeforePayment: false,
    settlementRequired: true,
    methodId: "daily-upkeep"
  },
  rolls: {
    enabled: true,
    mode: "advisory",
    skills: ["per", "dec", "itm", "prf", "ste", "sur"],
    dedupeSeconds: 10,
    notifyPlayers: true,
    notifyGm: true
  },
  actorSheets: {
    enabled: true,
    playerVisible: true
  },
  tokenHud: {
    enabled: true,
    showQuickActions: true
  },
  tokenLabels: {
    enabled: true,
    visibilityMode: "manual",
    shortcutEnabled: true,
    shortcutScope: "scene-pcs",
    playerScope: "characters",
    actorScope: "supported",
    audience: "gm",
    position: "above",
    format: "level-name",
    fontSize: 18,
    offset: 8,
    fontColor: "#ffffff",
    backgroundColor: "#111318",
    backgroundOpacity: 0.92,
    paddingX: 6,
    paddingY: 3
  },
  sceneControls: {
    enabled: true
  },
  sceneGuide: {
    enabled: true,
    showSceneControl: true,
    openOnSceneChange: false
  },
  effects: {
    enabled: false,
    includeContaminations: true
  },
  currency: {
    adapterId: "record-only",
    defaultLabel: "Mark",
    dnd5eDenomination: "",
    flagPath: "flags.garb-and-grime.wallet"
  },
  debugging: {
    enabled: false
  }
});

export const DEFAULT_PERMISSIONS = Object.freeze({
  roleMinimums: {
    [PERMISSIONS.VIEW_OWN]: 1,
    [PERMISSIONS.MODIFY_OWN_ACTIONS]: 1,
    [PERMISSIONS.USE_SERVICES]: 1,
    [PERMISSIONS.CONSUME_ITEMS]: 1,
    [PERMISSIONS.CHANGE_CLOTHES]: 1,
    [PERMISSIONS.VIEW_PARTY]: 3,
    [PERMISSIONS.VIEW_TOKEN_LABELS]: 5,
    [PERMISSIONS.VIEW_CLEANING_CHAT]: 1,
    [PERMISSIONS.VIEW_STATE_CHAT]: 4,
    [PERMISSIONS.MODIFY_OTHERS]: 4,
    [PERMISSIONS.CONFIGURE_CONTEXTS]: 4,
    [PERMISSIONS.MANAGE_METHODS]: 4,
    [PERMISSIONS.MANAGE_SETTINGS]: 4,
    [PERMISSIONS.VIEW_GM_DETAILS]: 4
  },
  userOverrides: {}
});

export const DEFAULT_CLEANING_METHODS = Object.freeze([
  {
    id: "water",
    nameKey: "GAG.Methods.Water.Name",
    descriptionKey: "GAG.Methods.Water.Description",
    time: { value: 30, unit: "minute" },
    cost: { amount: 0, currency: "Mark" },
    effect: { mode: "reduce", amount: 1, body: true, clothing: true },
    temporaryEffects: [],
    itemRequirements: [],
    settlementTypes: ["any"],
    playerUsable: true,
    enabled: true
  },
  {
    id: "soap",
    nameKey: "GAG.Methods.Soap.Name",
    descriptionKey: "GAG.Methods.Soap.Description",
    time: { value: 1, unit: "hour" },
    cost: { amount: 1, currency: "Mark" },
    effect: { mode: "set", level: 0, body: true, clothing: true },
    temporaryEffects: [],
    itemRequirements: [{ integrationId: "soap", quantity: 1, optional: true }],
    settlementTypes: ["any"],
    playerUsable: true,
    enabled: true
  },
  {
    id: "wash-house",
    nameKey: "GAG.Methods.WashHouse.Name",
    descriptionKey: "GAG.Methods.WashHouse.Description",
    time: { value: 4, unit: "hour" },
    cost: { amount: 2, currency: "Mark" },
    effect: { mode: "set", level: 0, body: true, clothing: true },
    temporaryEffects: [],
    itemRequirements: [],
    settlementTypes: ["village", "town", "city"],
    playerUsable: true,
    enabled: true
  },
  {
    id: "bathhouse",
    nameKey: "GAG.Methods.Bathhouse.Name",
    descriptionKey: "GAG.Methods.Bathhouse.Description",
    time: { value: 2, unit: "hour" },
    cost: { amount: 5, currency: "Mark" },
    effect: { mode: "set", level: 0, body: true, clothing: true },
    temporaryEffects: [{ id: "groomed", durationSeconds: 86400 }],
    itemRequirements: [],
    settlementTypes: ["town", "city", "court"],
    playerUsable: true,
    enabled: true
  },
  {
    id: "spare-clothing",
    nameKey: "GAG.Methods.SpareClothing.Name",
    descriptionKey: "GAG.Methods.SpareClothing.Description",
    time: { value: 1, unit: "minute" },
    cost: { amount: 0, currency: "Mark" },
    effect: { mode: "set", level: 0, body: false, clothing: true },
    temporaryEffects: [],
    itemRequirements: [{ integrationId: "spare-clothing", quantity: 1, optional: true }],
    settlementTypes: ["any"],
    playerUsable: true,
    enabled: true
  },
  {
    id: "daily-upkeep",
    nameKey: "GAG.Methods.DailyUpkeep.Name",
    descriptionKey: "GAG.Methods.DailyUpkeep.Description",
    time: { value: 1, unit: "day" },
    cost: { amount: 2, currency: "Mark" },
    effect: { mode: "set", level: 0, body: true, clothing: true },
    temporaryEffects: [],
    itemRequirements: [],
    settlementTypes: ["village", "town", "city", "military", "religious", "court"],
    playerUsable: false,
    enabled: true
  }
]);

export const DEFAULT_CONTAMINATIONS = Object.freeze([
  { id: "blood", nameKey: "GAG.Contamination.Blood", icon: "assets/icons/blood.svg", effectivePenalty: 1, scent: true, hiddenByDefault: false, createEffect: true },
  { id: "feces", nameKey: "GAG.Contamination.Feces", icon: "assets/icons/sewage.svg", effectivePenalty: 1, scent: true, hiddenByDefault: false, createEffect: true },
  { id: "decay", nameKey: "GAG.Contamination.Decay", icon: "assets/icons/decay.svg", effectivePenalty: 1, scent: true, hiddenByDefault: false, createEffect: true },
  { id: "chemicals", nameKey: "GAG.Contamination.Chemicals", icon: "assets/icons/chemical.svg", effectivePenalty: 1, scent: true, hiddenByDefault: false, createEffect: true },
  { id: "alchemical", nameKey: "GAG.Contamination.Alchemical", icon: "assets/icons/chemical.svg", effectivePenalty: 1, scent: true, hiddenByDefault: false, createEffect: true },
  { id: "sewage", nameKey: "GAG.Contamination.Sewage", icon: "assets/icons/sewage.svg", effectivePenalty: 1, scent: true, hiddenByDefault: false, createEffect: true }
]);

export const DEFAULT_ENVIRONMENT_PROFILES = Object.freeze([
  {
    id: "clean",
    nameKey: "GAG.Profiles.Clean.Name",
    descriptionKey: "GAG.Profiles.Clean.Description",
    expected: { min: 0, max: 1 },
    levelRatings: ["expected", "accepted", "disliked", "hated"],
    settlementTypes: ["town", "city", "wealthy"],
    serviceAvailability: ["wash-house", "bathhouse", "daily-upkeep"],
    automaticDirtGain: 0,
    social: { level2: "disadvantage-social", level3: "entry-refusal-or-disadvantage" },
    tracking: { level2: "normal", level3: "normal" },
    narrativeKey: "GAG.Profiles.Clean.Reaction"
  },
  {
    id: "ordinary",
    nameKey: "GAG.Profiles.Ordinary.Name",
    descriptionKey: "GAG.Profiles.Ordinary.Description",
    expected: { min: 0, max: 2 },
    levelRatings: ["accepted", "expected", "tolerated", "disliked"],
    settlementTypes: ["village", "town", "harbor", "barracks", "workshop"],
    serviceAvailability: ["wash-house", "daily-upkeep"],
    automaticDirtGain: 0,
    social: { level2: "normal", level3: "possible-disadvantage" },
    tracking: { level2: "normal", level3: "normal" },
    narrativeKey: "GAG.Profiles.Ordinary.Reaction"
  },
  {
    id: "poor-lawless",
    nameKey: "GAG.Profiles.PoorLawless.Name",
    descriptionKey: "GAG.Profiles.PoorLawless.Description",
    expected: { min: 1, max: 2 },
    levelRatings: ["hated", "tolerated", "expected", "accepted"],
    settlementTypes: ["slum", "lawless", "labor"],
    serviceAvailability: [],
    automaticDirtGain: 0,
    social: { level0: "possible-disadvantage-blend", level2: "possible-advantage-blend", level3: "normal" },
    tracking: { level2: "normal", level3: "normal" },
    narrativeKey: "GAG.Profiles.PoorLawless.Reaction"
  },
  {
    id: "wilderness",
    nameKey: "GAG.Profiles.Wilderness.Name",
    descriptionKey: "GAG.Profiles.Wilderness.Description",
    expected: { min: 1, max: 3 },
    levelRatings: ["disliked", "accepted", "expected", "tolerated"],
    settlementTypes: [],
    serviceAvailability: [],
    automaticDirtGain: 1,
    social: {},
    tracking: { level2: "scent-advantage", level3: "scent-stealth-impossible" },
    narrativeKey: "GAG.Profiles.Wilderness.Reaction"
  },
  {
    id: "military",
    nameKey: "GAG.Profiles.Military.Name",
    descriptionKey: "GAG.Profiles.Military.Description",
    expected: { min: 0, max: 2 },
    levelRatings: ["accepted", "expected", "accepted", "disliked"],
    settlementTypes: ["military", "barracks", "camp"],
    serviceAvailability: ["wash-house", "daily-upkeep"],
    automaticDirtGain: 0,
    social: { level3: "possible-disadvantage" },
    tracking: {},
    narrativeKey: "GAG.Profiles.Military.Reaction"
  },
  {
    id: "religious",
    nameKey: "GAG.Profiles.Religious.Name",
    descriptionKey: "GAG.Profiles.Religious.Description",
    expected: { min: 0, max: 1 },
    levelRatings: ["expected", "tolerated", "disliked", "hated"],
    settlementTypes: ["religious", "temple", "town", "city"],
    serviceAvailability: ["wash-house", "daily-upkeep"],
    automaticDirtGain: 0,
    social: { level2: "disadvantage-social", level3: "entry-refusal-or-disadvantage" },
    tracking: {},
    narrativeKey: "GAG.Profiles.Religious.Reaction"
  },
  {
    id: "court",
    nameKey: "GAG.Profiles.Court.Name",
    descriptionKey: "GAG.Profiles.Court.Description",
    expected: { min: 0, max: 0 },
    levelRatings: ["expected", "disliked", "hated", "hated"],
    settlementTypes: ["court", "city", "wealthy"],
    serviceAvailability: ["bathhouse", "daily-upkeep"],
    automaticDirtGain: 0,
    social: { level1: "possible-disadvantage", level2: "disadvantage-social", level3: "entry-refusal-or-disadvantage" },
    tracking: {},
    narrativeKey: "GAG.Profiles.Court.Reaction"
  },
  {
    id: "sewer",
    nameKey: "GAG.Profiles.Sewer.Name",
    descriptionKey: "GAG.Profiles.Sewer.Description",
    expected: { min: 2, max: 3 },
    levelRatings: ["hated", "disliked", "accepted", "expected"],
    settlementTypes: [],
    serviceAvailability: [],
    automaticDirtGain: 2,
    automaticContamination: ["sewage"],
    social: {},
    tracking: { level2: "scent-advantage", level3: "scent-stealth-impossible" },
    narrativeKey: "GAG.Profiles.Sewer.Reaction"
  },
  {
    id: "swamp",
    nameKey: "GAG.Profiles.Swamp.Name",
    descriptionKey: "GAG.Profiles.Swamp.Description",
    expected: { min: 2, max: 3 },
    levelRatings: ["disliked", "tolerated", "expected", "accepted"],
    settlementTypes: [],
    serviceAvailability: [],
    automaticDirtGain: 2,
    social: {},
    tracking: { level2: "scent-advantage", level3: "scent-stealth-impossible" },
    narrativeKey: "GAG.Profiles.Swamp.Reaction"
  },
  {
    id: "battlefield",
    nameKey: "GAG.Profiles.Battlefield.Name",
    descriptionKey: "GAG.Profiles.Battlefield.Description",
    expected: { min: 2, max: 3 },
    levelRatings: ["hated", "disliked", "tolerated", "expected"],
    settlementTypes: [],
    serviceAvailability: [],
    automaticDirtGain: 2,
    automaticContamination: ["blood"],
    social: {},
    tracking: { level2: "scent-advantage", level3: "scent-stealth-impossible" },
    narrativeKey: "GAG.Profiles.Battlefield.Reaction"
  }
]);

export const DEFAULT_ITEM_INTEGRATIONS = Object.freeze([
  { id: "soap", labelKey: "GAG.Items.Soap", methodId: "soap", consume: 1, aliases: ["soap", "seife"] },
  { id: "spare-clothing", labelKey: "GAG.Items.SpareClothing", methodId: "spare-clothing", consume: 0, aliases: ["clean clothes", "fresh clothes", "wechselkleidung"] },
  { id: "perfume", labelKey: "GAG.Items.Perfume", masking: { id: "perfume", durationSeconds: 14400 }, consume: 1, aliases: ["perfume", "parfüm", "parfum"] },
  { id: "scent-mask", labelKey: "GAG.Items.ScentMask", masking: { id: "scent-mask", durationSeconds: 14400 }, consume: 1, aliases: ["scent mask", "geruchstarnung"] },
  { id: "washing-kit", labelKey: "GAG.Items.WashingKit", methodId: "soap", consume: 0, aliases: ["washing kit", "waschset"] },
  { id: "towel", labelKey: "GAG.Items.Towel", methodId: "water", consume: 0, aliases: ["towel", "handtuch"] },
  { id: "laundry-voucher", labelKey: "GAG.Items.LaundryVoucher", methodId: "wash-house", consume: 1, waiveCost: true, aliases: ["laundry voucher", "wäschegutschein"] },
  { id: "magical-cleaning", labelKey: "GAG.Items.MagicalCleaning", methodId: "soap", consume: 0, waiveCost: true, aliases: ["magical cleaning", "magische reinigung"] }
]);
